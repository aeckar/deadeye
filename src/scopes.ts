//! Scope registry API and utilities.
//!
//! Unlike `scope_utils.ts`, contains logic for scope analysis.
import { IntervalTree, IntervalTreeService } from './interval_tree'
import { Language, Tag, Token, UnknownTokenKind } from './languages'
import { properties } from './misc'
import { Scope } from './scopes_base'

// =============================================================================================
// Scope Description API
// =============================================================================================

export type BoundariesPool = (readonly [
    UnknownTokenKind | null,
    UnknownTokenKind,
])[]

/**
 * The boundaries of a scope.
 *
 * Possibilties:
 * - **`openByDefault` + `open === undefined`:** `<scope-marker> ...open... <primed>`
 * - **`open === undefined`:** `<scope-marker> ...primed... <close>`
 * - **`open !== undefined`:** `<scope-marker> ...primed... <open> ...open... <close>`
 *
 * A scope starts open if any of its possible boundaries have an undefined open token.
 */
export class Boundaries {
    // explicit passing of `undefined` allowable here, since it is also a declaration
    constructor(
        readonly open: Tag | undefined,
        readonly close: Tag,
    ) {}

    toString(): string {
        return `[${this.open}, ${this.close}]`
    }

    static newInstancePool(lang: Language, pool: BoundariesPool): Boundaries[] {
        const boundaryMarkers: Boundaries[] = []
        for (const boundaries of pool) {
            const [open, close] = boundaries
            boundaryMarkers.push(
                new Boundaries(
                    open ? lang.tagForKind(open) : undefined,
                    lang.tagForKind(close)!,
                ),
            )
        }
        return boundaryMarkers
    }
}

export type ScopeInfoCfg<ScopeKind extends string> = {
    /** @see {@link ScopeInfo.boundariesPool} */
    readonly boundariesPool: BoundariesPool

    /** @see {@link ScopeInfo.markerPool} */
    readonly markerPool?: readonly UnknownTokenKind[]

    /** @see {@link ScopeInfo.terminatorPool} */
    readonly terminatorPool?: readonly UnknownTokenKind[]

    /** @see {@link ScopeInfo.flatten} */
    readonly flatten?: boolean

    /** @see {@link ScopeInfo.outerOpenScope} */
    readonly outerOpenScope?: ScopeKind

    /** @see {@link ScopeInfo.outerPrimedScope} */
    readonly outerPrimedScope?: ScopeKind
}

/**
 * Contains specification details for a given scope.
 *
 * The type of each value in a {@link ScopeRegistry}.
 *
 * @see {@link ScopeStream}
 */
export class ScopeInfo<ScopeKind extends string> {
    private constructor(
        /** The scope ID. */
        readonly scopeKind: ScopeKind,

        /**
         * All possible marker tokens that may be matched
         * to successfully parse the start of this scope.
         */
        readonly markerPool: readonly Tag[],

        /**
         * A
         */
        readonly boundariesPool: readonly Boundaries[],
        readonly terminatorPool: readonly Tag[],
        readonly flatten: boolean,
        readonly outerOpenScope?: ScopeKind,
        readonly outerPrimedScope?: ScopeKind,

        /** Closing token kinds, cached for easy access if open by default. */
        readonly closeKinds?: readonly Tag[],
    ) {}

    get isOpenByDefault(): boolean {
        return this.closeKinds !== undefined
    }

    toString(): string {
        return `ScopeInfo(${this.scopeKind})`
    }

    static newInstance<ScopeKind extends string>(
        lang: Language,
        scopeKind: ScopeKind,
        cfg: ScopeInfoCfg<ScopeKind>,
    ): ScopeInfo<ScopeKind> {
        const boundaries = Boundaries.newInstancePool(lang, cfg.boundariesPool)
        const isOpenByDefault = boundaries.find(e => e.open === undefined)
        return new ScopeInfo(
            scopeKind,
            cfg.markerPool?.map(e => lang.tagForKind(e)!) ?? [
                lang.tagForKind(scopeKind.toUpperCase())!,
            ],
            boundaries,
            cfg.terminatorPool?.map(e => lang.tagForKind(e)!) ?? [],
            cfg.flatten ?? false,
            cfg.outerOpenScope,
            cfg.outerPrimedScope,
            isOpenByDefault ? boundaries.map(e => e.close) : undefined,
        )
    }
}

/**
 * Configuration parameter for {@link ScopeRegistry}.
 * @see {@link newScopeRegistry}
 */
export type ScopeRegistryCfg<ScopeKind extends string> = {
    readonly [K in ScopeKind]: ScopeInfoCfg<ScopeKind>
}

/**
 * Top-level data structure mapping every unique scope for a given language
 * to its {@link ScopeInfo details}.
 *
 * This type is a branded {@link Map}.
 *
 * @see {@link newScopeRegistry}
 * @see {@link extractScopes}
 */
export type ScopeRegistry<ScopeKind extends string> = Map<
    ScopeKind,
    ScopeInfo<ScopeKind>
> & { __brand: 'CompletionRegistry' }

export function newScopeRegistry<ScopeKind extends string>(
    lang: Language,
    cfg: ScopeRegistryCfg<ScopeKind>,
): ScopeRegistry<ScopeKind> {
    const registry = new Map<ScopeKind, ScopeInfo<ScopeKind>>()
    for (const { key, value } of properties(cfg)) {
        registry.set(key, ScopeInfo.newInstance(lang, key, value))
    }
    return registry as ScopeRegistry<ScopeKind>
}

// =============================================================================================
// Scope Analysis API
// =============================================================================================

/**
 * Returns all valid scopes found in the token stream.
 *
 * `begin` may be the head of a token stream. If it is not, that token is the first one
 * checked for a match to a scope marker.
 */
export function extractScopes<ScopeKind extends string>(
    tokens: readonly Token[],
    registry: ScopeRegistry<ScopeKind>,
): IntervalTree<Scope<ScopeKind>> {
    const stream = new ScopeStream<ScopeKind>(tokens)
    while (!stream.isExhausted()) {
        for (const query of registry.values()) {
            if (stream.parse(query)) break
        }
        stream.collect()
    }
    stream.finish()
    return stream.closed
}

/** A scope in the `unclosed` stack of {@link ScopeStream} */
export class UnclosedScope<ScopeKind extends string> {
    private _begin?: number
    private _expectedClose?: readonly Tag[]
    private _isOpen: boolean = false
    private _isReopened: boolean = false

    private constructor(
        readonly kind: ScopeKind,
        readonly markerPos: number,
        readonly markerTokenPos: number,
        readonly boundariesPool: readonly Boundaries[],
        readonly terminatorPool: readonly Tag[],
        readonly flatten: boolean,
    ) {}

    static newInstance<ScopeKind extends string>(
        query: ScopeInfo<ScopeKind>,
        marker: Token,
        markerTokenPos: number,
    ): UnclosedScope<ScopeKind> {
        const { scopeKind, boundariesPool, terminatorPool, flatten } = query
        const scope = new UnclosedScope(
            scopeKind,
            marker.begin,
            markerTokenPos,
            boundariesPool,
            terminatorPool,
            flatten,
        )
        if (query.isOpenByDefault) {
            scope.open(marker.end, query.closeKinds!)
        }
        return scope
    }

    get begin(): number | undefined {
        return this._begin
    }

    get expectedClose(): readonly Tag[] | undefined {
        return this._expectedClose
    }

    get isOpen(): boolean {
        return this._isOpen
    }

    get isReopened(): boolean {
        return this._isReopened
    }

    toString(): string {
        return `${this.kind} ${this.isOpen ? '🟢' : '🔴'}`
    }

    /** Can be called a second time to declare a scope to be open at a later token. */
    open(begin: number, expectedClose: readonly Tag[]) {
        if (this._isOpen) {
            this._isReopened = true
        }
        this._begin = begin
        this._expectedClose = expectedClose
        this._isOpen = true
    }

    close(end: number): Scope<ScopeKind> {
        if (this.begin !== undefined) {
            return new Scope(
                this.kind,
                this.markerPos,
                this.markerTokenPos,
                this.begin!,
                end,
            )
        }
        return new Scope(
            this.kind,
            this.markerPos,
            this.markerTokenPos,
            this.markerPos,
            end,
        )
    }
}

//todo
//Any token or boundary that exists after the cursor cannot possibly affect the scope nesting

/**
 * A cursor over a token stream to extract scope information.
 *
 * Unlike a `Tape`, the position always starts at 0 and can only be incremented.
 */
export class ScopeStream<ScopeKind extends string> {
    readonly closed: IntervalTree<Scope<ScopeKind>>
    private readonly unclosed: UnclosedScope<ScopeKind>[]
    private _pos = 0

    constructor(readonly tokens: readonly Token[]) {
        this.closed = IntervalTreeService.newInstance<Scope<ScopeKind>>()
        this.unclosed = []
    }

    toString(): string {
        const closed = this.closed.items.map(({ key: _, value }) => value)
        return `[${this.cur()}]: [${this.unclosed}] -> [${closed}]`
    }

    get pos(): number {
        return this._pos
    }

    /** The token currently being pointed to. */
    cur(): Token | undefined {
        return this.isExhausted() ? this.tokens[this._pos] : undefined
    }

    /** Advances the current position by 1. */
    adv() {
        this._pos += 1
    }

    /** Returns true if the current token is the tail. */
    isExhausted(): boolean {
        return this._pos >= this.tokens.length
    }

    /**
     * Parses the next scope signature (marker + attributes + sentinel) up to,
     * and including, the terminator (typically an open bracket).
     *
     * If the signature was matched, it is primed to be added to the underlying scope map.
     * Scopes that are flattened share the opener-closer pair of the next scope.
     * As a result, they are primed and closed at the same time.
     * Multiple scopes can be flattened to the same opener-closer pair.
     *
     * If the match was successful, consumes the current token.
     *
     * @returns `true` if the scope signature was matched.
     */
    parse(query: ScopeInfo<ScopeKind>): boolean {
        if (this.isExhausted()) {
            return false
        }
        const { markerPool, outerOpenScope, outerPrimedScope } = query
        const { unclosed } = this
        const cur = this.tokens[this.pos]
        if (
            !markerPool.includes(cur.tag) ||
            (outerPrimedScope !== undefined &&
                !unclosed.find(
                    scope => !scope.isOpen && scope.kind === outerPrimedScope,
                )) ||
            (outerOpenScope !== undefined &&
                !unclosed.find(
                    scope => scope.isOpen && scope.kind === outerOpenScope,
                ))
        ) {
            return false
        }
        const scope = UnclosedScope.newInstance(query, cur, this.pos)
        this.unclosed.push(scope)
        return true
    }

    /**
     * Opens or closes the current scope (as well as any flattened scopes)
     * depending on the current token.
     *
     * This function should be called at the end of every iteration
     * of the scope extraction loop.
     *
     * Unexpected openers or closers belonging to any incomplete scope that is
     * not the top scope should close/open that scope and discard all that are above.
     *
     * Advances the token stream before returning.
     */
    collect() {
        do {
            continue
        } while (this._collect())
        this.adv()
    }

    /**  Closes all opened scopes and discards all primed scopes. */
    finish() {
        const end = this.tokens[this.pos - 1].end
        for (const scope of this.unclosed) {
            if (scope.isOpen) {
                const s = scope.close(end)
                this.closed.insert(s.interval, s)
            }
        }
        this.unclosed.length = 0
    }

    /** Returns `true` if any element in `unclosed` was modified. */
    private _collect(): boolean {
        const start = this.tokens[this.pos]
        const { unclosed, closed } = this
        if (unclosed.length === 0) {
            return false
        }
        const tag = start.tag
        const top = unclosed.at(-1)!

        // Attempt to close top scope by matching to any expected closer
        // Top scope was opened by previous call
        if (top.isOpen) {
            if (top.expectedClose?.includes(tag!)) {
                const s = unclosed.pop()!.close(start.begin)
                closed.insert([s.begin, s.end], s)
                while (unclosed.at(-1)?.flatten) {
                    // cascade changes to adjacent flat scopes
                    const fs = unclosed.pop()!.close(start.begin)
                    closed.insert([fs.begin, fs.end], fs)
                }
                return true
            }
            return false
        }

        // Find topmost scope that can be resolved, then discard all that are above
        let discardCount = 0
        let idx = unclosed.length - 1
        let modified = false
        while (idx >= 0) {
            const scope = unclosed[idx]
            for (const boundaries of scope.boundariesPool) {
                // Attempt to open scope by matching to opener
                if (
                    tag === boundaries.open &&
                    (!scope.isOpen || !scope.isReopened)
                ) {
                    scope.open(start.end, [boundaries.close])
                    for (idx -= 1; idx >= 0 && unclosed[idx]?.flatten; --idx) {
                        unclosed[idx].open(start.end, [boundaries.close])
                    }
                    modified = true
                    break
                }

                // Attempt to close scope by matching to any closer
                // Scope is always-open or always-primed
                if (
                    tag === boundaries.close &&
                    (scope.isOpen || boundaries.open === undefined)
                ) {
                    const s = unclosed.pop()!.close(start.begin)
                    closed.insert(s.interval, s)
                    for (
                        idx -= 1;
                        idx >= 0 && unclosed.at(-1)?.flatten;
                        --idx
                    ) {
                        const fs = unclosed.pop()!.close(start.begin)
                        closed.insert(fs.interval, fs)
                    }
                    discardCount = unclosed.length - idx - 1
                    modified = true
                    break
                }
            }
            if (!modified && !scope.isOpen) {
                for (const terminator of scope.terminatorPool) {
                    if (tag === terminator) {
                        const s = scope.close(start.begin)
                        closed.insert(s.interval, s)
                        for (
                            idx -= 1;
                            idx >= 0 && unclosed.at(-1)?.flatten;
                            --idx
                        ) {
                            const fs = unclosed.pop()!.close(start.begin)
                            closed.insert(fs.interval, fs)
                        }
                        discardCount = unclosed.length - idx - 1
                        modified = true
                        break
                    }
                }
            }
            idx -= 1
        }
        if (discardCount > 0) {
            unclosed.length = unclosed.length - discardCount
        }
        return modified
    }
}
