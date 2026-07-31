//! Scope API and utilities.
//!
//! Unlike `scope_utils.ts`, contains logic for scope analysis.
import { Scope } from '@/scope'
import IntervalTreeService, { IntervalTree } from '@/services/interval_tree_service'
import { entries } from '@/utils/collections'
import { Language, Tag, Token, UnknownTokenKind } from './language_api'

// =============================================================================================
// Scope Description
// =============================================================================================

/**
 * Extracts the string union containing all scope kinds from the scope registry type.
 *
 * Usage should resemble `Scopes<typeof scopes>`.
 */
export type ScopeKind<T> = T extends ScopeRegistry<infer U> ? U : never

export type BoundariesPool = (readonly [UnknownTokenKind | null, UnknownTokenKind])[]

/** The boundaries of a scope. */
export class Boundaries {
    constructor(
        readonly open: Tag | undefined,
        readonly close: Tag,
    ) {}

    toString(): string {
        return `[${this.open}, ${this.close}]`
    }

    static newInstancePool(lang: Language, pool: BoundariesPool): Boundaries[] {
        const boundaryMarkers: Boundaries[] = []
        for (const [open, close] of pool) {
            boundaryMarkers.push(
                new Boundaries(open ? lang.tagForKind(open) : undefined, lang.tagForKind(close)!),
            )
        }
        return boundaryMarkers
    }
}

export type ScopeInfoConfig<ScopeKind extends string> = {
    /** @see {@link ScopeInfo.boundariesPool} */
    readonly boundariesPool: BoundariesPool

    /** @see {@link ScopeInfo.markerPool} */
    readonly markerPool?: readonly UnknownTokenKind[]

    /** @see {@link ScopeInfo.terminatorPool} */
    readonly terminatorPool?: readonly UnknownTokenKind[]

    /** @see {@link ScopeInfo.flatten} */
    readonly flatten?: boolean

    /** @see {@link ScopeInfo.once} */
    readonly once?: boolean

    /** @see {@link ScopeInfo.openScopePool} */
    readonly openScopePool?: ScopeKind[]

    /** @see {@link ScopeInfo.primedScopePool} */
    readonly primedScopePool?: ScopeKind[]
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
        readonly kind: ScopeKind,

        /** Tags of marker tokens that can be matched as the start of this scope. */
        readonly markerPool: readonly Tag[],

        /**
         * The tags of the tokens that can be matched to open and close a scope, respectively.
         *
         * Each open-close pairing is represented as a `Boundaries` instance.
         * If `open` is undefined for any element, the scope does not require an opening
         * token to become open. Instead, it becomes open by default.
         */
        readonly boundariesPool: readonly Boundaries[],

        /**
         * The tags of the tokens that can be matched to unconditionally close a scope,
         * including if it has not been opened yet.
         *
         * If the scope was never opened, the region the scope covers extends to the scope marker.
         */
        readonly terminatorPool: readonly Tag[],

        /**
         * If true, while this scope is not closed, closing any subsequent scope also closes
         * this one, and so on for other scopes where `flatten` is true.
         */
        readonly flatten: boolean,

        /**
         * If true, the outer primed or open scope can only be used to permit a match to the
         * marker token once, respectively.
         *
         * @see {@link primedScopePool}
         * @see {@link openScopePool}
         */
        readonly once: boolean,

        /**
         * If defined, this scope must be open when the scope marker is matched
         * for the scope to be recognized.
         *
         * @see {@link primedScopePool}
         * @see {@link once}
         */
        readonly openScopePool?: ScopeKind[],

        /**
         * If defined, this scope must be primed when the scope marker is matched
         * for the scope to be recognized.
         *
         * @see {@link openScopePool}
         * @see {@link once}
         */
        readonly primedScopePool?: ScopeKind[],

        /** Closing token kinds, cached for easy access if open by default. */
        readonly closeKinds?: readonly Tag[],
    ) {}

    get isOpenByDefault(): boolean {
        return this.closeKinds !== undefined
    }

    toString(): string {
        return `ScopeInfo(${this.kind})`
    }

    static newInstance<ScopeKind extends string>(
        lang: Language,
        scopeKind: ScopeKind,
        cfg: ScopeInfoConfig<ScopeKind>,
    ): ScopeInfo<ScopeKind> {
        const boundaries = Boundaries.newInstancePool(lang, cfg.boundariesPool)
        const isOpenByDefault = boundaries.find(e => e.open === undefined)
        return new this(
            scopeKind,
            cfg.markerPool?.map(e => lang.tagForKind(e)!) ?? [
                lang.tagForKind(scopeKind.toUpperCase() as Uppercase<string>)!,
            ],
            boundaries,
            cfg.terminatorPool?.map(e => lang.tagForKind(e)!) ?? [],
            cfg.flatten ?? false,
            cfg.once ?? false,
            cfg.openScopePool,
            cfg.primedScopePool,
            isOpenByDefault ? boundaries.map(e => e.close) : undefined,
        )
    }
}

/**
 * Configuration parameter for {@link ScopeRegistry}.
 * @see {@link ScopeRegistry.newInstance}
 */
export type ScopeRegistryConfig<ScopeKind extends string> = {
    readonly [K in ScopeKind]: ScopeInfoConfig<ScopeKind>
}

/**
 * Top-level data structure mapping every unique scope for a given language
 * to its details.
 *
 * @see {@link ScopeRegistry.newInstance}
 * @see {@link extractScopes}
 */
export class ScopeRegistry<ScopeKind extends string> {
    private _entries?: ScopeInfo<ScopeKind>[]

    private constructor(
        private readonly langCallback: () => Language,
        private readonly cfg: ScopeRegistryConfig<ScopeKind>,
    ) {}

    /**
     * The corresponding `Language` is passed as a callback to circumvent JavaScript module loading
     * order issues.
     *
     * Scopes are evaluated in the order they are declared.
     * 
     * # Type Parameter
     *
     * Callers should always infer `Config`.
     *
     * Extraction of the congifuration object type to a type parameter enables automatic extraction of
     * the key string union type. This allows callers to define a scope registry without first
     * defining a string union of the keys (`ScopeKind` variants).
     */
    static newInstance<Config extends ScopeRegistryConfig<string>>(
        langCallback: () => Language,
        cfg: Config,
    ): ScopeRegistry<keyof Config & string> {
        return new this(langCallback, cfg)
    }

    get entries(): readonly ScopeInfo<ScopeKind>[] {
        if (!this._entries) {
            this._entries = []
            const lang = this.langCallback()
            for (const [key, val] of entries(this.cfg)) {
                this._entries.push(ScopeInfo.newInstance(lang, key, val))
            }
        }
        return this._entries
    }

    /**
     * Returns all valid scopes found in the token stream.
     *
     * `begin` may be the head of a token stream. If it is not, that token is the first one
     * checked for a match to a scope marker.
     */
    extractScopes(tokens: readonly Token[]): IntervalTree<Scope<ScopeKind>> {
        const stream = new ScopeStream<ScopeKind>(tokens)
        while (!stream.isExhausted()) {
            for (const query of this.entries) {
                if (stream.parse(query)) break
            }
            stream.collect()
        }
        stream.finish()
        return stream.closed
    }
}

// =============================================================================================
// Scope Analysis
// =============================================================================================

/** A scope in the `unclosed` stack of {@link ScopeStream} */
export class UnclosedScope<ScopeKind extends string> {
    private _begin?: number
    private _expectedClose?: readonly Tag[]
    private _isOpen: boolean = false
    private _isReopened: boolean = false
    private _deactivated: ScopeKind[] = []

    private constructor(
        readonly query: ScopeInfo<ScopeKind>,
        readonly markerPos: number,
        readonly markerTokenPos: number,
    ) {}

    static newInstance<ScopeKind extends string>(
        query: ScopeInfo<ScopeKind>,
        marker: Token,
        markerTokenPos: number,
    ): UnclosedScope<ScopeKind> {
        const self = new this(query, marker.begin, markerTokenPos)
        if (query.isOpenByDefault) {
            self.open(marker.end, query.closeKinds!)
        }
        return self
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

    get deactivated(): readonly ScopeKind[] {
        return this._deactivated
    }

    toString(): string {
        return `${this.query.kind} ${this.isOpen ? '🟢' : '🔴'}`
    }

    deactivate(innerScope: ScopeKind) {
        this._deactivated.push(innerScope)
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
            return new Scope(this.query.kind, this.markerPos, this.markerTokenPos, this.begin!, end)
        }
        return new Scope(this.query.kind, this.markerPos, this.markerTokenPos, this.markerPos, end)
    }
}

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
        const { markerPool, openScopePool, primedScopePool } = query
        const { unclosed } = this
        const cur = this.tokens[this.pos]
        if (
            !markerPool.includes(cur.tag) ||
            !isSatisfied(primedScopePool) ||
            !isSatisfied(openScopePool)
        ) {
            return false
        }
        const scope = UnclosedScope.newInstance(query, cur, this.pos)
        this.unclosed.push(scope)
        return true

        function isSatisfied(scopePool: ScopeKind[] | undefined): boolean {
            if (scopePool !== undefined) {
                const outer = unclosed.find(scope => scopePool.some(e => e === scope.query.kind))
                if (!outer) {
                    return false
                }
                if (query.once) {
                    if (outer.deactivated.includes(query.kind)) {
                        return false
                    }
                    outer.deactivate(query.kind)
                }
            }
            return true
        }
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
                while (unclosed.at(-1)?.query.flatten) {
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
            for (const boundaries of scope.query.boundariesPool) {
                // Attempt to open scope by matching to opener
                if (tag === boundaries.open && (!scope.isOpen || !scope.isReopened)) {
                    scope.open(start.end, [boundaries.close])
                    for (idx -= 1; idx >= 0 && unclosed[idx]?.query.flatten; --idx) {
                        unclosed[idx].open(start.end, [boundaries.close])
                    }
                    modified = true
                    break
                }

                // Attempt to close scope by matching to any closer
                // Scope is always-open or always-primed
                if (tag === boundaries.close && (scope.isOpen || boundaries.open === undefined)) {
                    const s = unclosed.pop()!.close(start.begin)
                    closed.insert(s.interval, s)
                    for (idx -= 1; idx >= 0 && unclosed.at(-1)?.query.flatten; --idx) {
                        const fs = unclosed.pop()!.close(start.begin)
                        closed.insert(fs.interval, fs)
                    }
                    discardCount = unclosed.length - idx - 1
                    modified = true
                    break
                }
            }
            if (!modified && !scope.isOpen) {
                for (const terminator of scope.query.terminatorPool) {
                    if (tag === terminator) {
                        const s = scope.close(start.begin)
                        closed.insert(s.interval, s)
                        for (idx -= 1; idx >= 0 && unclosed.at(-1)?.query.flatten; --idx) {
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
