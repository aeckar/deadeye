//! Scope API and utilities.
//!
//! Unlike `scope_utils.ts`, contains logic for scope analysis.
import { Language, Tag, Token, UnknownTokenKind } from '@/api/language_api'
import { logger } from '@/logger'
import { Scope } from '@/scope'
import IntervalTreeService, { IntervalTree } from '@/services/interval_tree_service'
import { entries } from '@/utils/collections'
import { TRIVIA } from '@/utils/constants'

// =============================================================================================
// Scope Predicates
// =============================================================================================

export type ScopePredicate = (
    tokens: readonly Token[],
    pos: number,
    stream: ScopeStream<UnknownScopeKind>,
    info: ScopeInfo<UnknownScopeKind>,
) => boolean

/** Satisfied when any of the given tokens are the current one being pointed to. */
export function at(...pool: readonly UnknownTokenKind[]): ScopePredicate {
    return (tokens, pos) => {
        return pool.includes(tokens[pos].kind)
    }
}

/**
 * Satisfied when any of the given tokens
 * is the next non-trivial token (not ending in '_COMMENT').
 */
export function before(...pool: readonly UnknownTokenKind[]): ScopePredicate {
    return (tokens, pos) => {
        let idx = pos + 1
        while (idx < tokens.length) {
            // skip trivia
            if ((TRIVIA as readonly UnknownTokenKind[]).includes(tokens[idx].kind)) {
                idx += 1
                continue
            }
            break
        }
        return pool.includes(tokens[idx].kind)
    }
}

/** Satisfied when any one of the given scopes is primed. */
export function primed(...pool: readonly UnknownScopeKind[]): ScopePredicate {
    return (_, __, stream, info) => {
        const target = stream.unclosed.find(u => !u.isOpen && pool.some(p => p === u.query.kind))
        const result =
            target !== undefined && !(info.once && target.deactivated.includes(info.kind))
        if (info.once) {
            stream.constrainOnce(target)
        }
        return result
    }
}

/** Satisfied when all of the given scopes are not primed. */
export function excludePrimed(...scopes: readonly UnknownScopeKind[]): ScopePredicate {
    return (_, __, stream) => {
        const target = stream.unclosed.find(u => !u.isOpen && scopes.some(p => p === u.query.kind))
        return target === undefined
    }
}

/** Satisfied when any one of the given scopes is open. */
export function open(...pool: readonly UnknownScopeKind[]): ScopePredicate {
    return (_, __, stream, info) => {
        const target = stream.unclosed.find(u => u.isOpen && pool.some(p => p === u.query.kind))
        const result =
            target !== undefined && !(info.once && target.deactivated.includes(info.kind))
        if (info.once) {
            stream.constrainOnce(target)
        }
        return result
    }
}

/** Satisfied when all of the given scopes are not open. */
export function excludeOpen(...scopes: readonly UnknownScopeKind[]): ScopePredicate {
    return (_, __, stream) => {
        const target = stream.unclosed.find(u => u.isOpen && scopes.some(p => p === u.query.kind))
        return target === undefined
    }
}

/**
 * Satisfied when any of the given scopes is the most previous unclosed scope.
 *
 * A scope of `'*'` signifies top-level.
 */
export function parent(...pool: readonly UnknownScopeKind[]): ScopePredicate {
    return (_, __, stream, info) => {
        const top = stream.unclosed.at(-1)
        if (!top) {
            return pool.includes('*')
        }
        if (info.once) {
            stream.constrainOnce(top)
        }
        return pool.some(e => e === top.query.kind)
    }
}

/** Satisfied when none of the given scopes are the most previous unclosed scope. */
export function excludeParent(...scopes: readonly UnknownScopeKind[]): ScopePredicate {
    return (_, __, stream) => {
        const top = stream.unclosed.at(-1)
        return top !== undefined && !scopes.some(e => e === top.query.kind)
    }
}

// =============================================================================================
// Scope Description
// =============================================================================================

export type UnknownScopeKind = string

/**
 * Extracts the string union containing all scope kinds from the scope registry type.
 *
 * Usage should resemble `Scopes<typeof scopes>`.
 */
export type ScopeKind<T> = T extends ScopeRegistry<infer U> ? U : never

export type BoundariesPool = (readonly [UnknownTokenKind, UnknownTokenKind] | UnknownTokenKind)[]

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
        for (const entry of pool) {
            if (typeof entry === 'string') {
                let tag: Tag
                try {
                    tag = lang.tagForKind(entry)!
                } catch (e) {
                    logger.appendLine(`[Error] Language does not contain token '${entry}'`)
                    throw e
                }
                boundaryMarkers.push(new Boundaries(tag, tag))
            } else {
                const [open, close] = entry
                boundaryMarkers.push(
                    new Boundaries(
                        open ? lang.tagForKind(open) : undefined,
                        lang.tagForKind(close)!,
                    ),
                )
            }
        }
        return boundaryMarkers
    }
}

/** Assumes automatic semicolon insertion (ASI) has already been processed. */
export type ScopeInfoConfig<ScopeKind extends string> = {
    /** @see {@link ScopeInfo.boundariesPool} */
    readonly boundaries: BoundariesPool

    /** @see {@link ScopeInfo.terminatorPool} */
    readonly terminators?: readonly UnknownTokenKind[]

    /** @see {@link ScopeInfo.flatten} */
    readonly flatten?: ScopeKind[]

    /** @see {@link ScopeInfo.once} */
    readonly once?: boolean

    /** @see {@link ScopeInfo.predicates} */
    readonly require: ScopePredicate[]
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
         * Additionally, opening any subsequent scope also opens
         * this one, and so on for other scopes where `flatten` is true.
         */
        readonly flatten: readonly ScopeKind[] | undefined,

        /**
         * If true, a scope dependency (e.g. `open`, `primed`, `parent` predicates)
         * can only be used to recognize this scope once for a given instance of that scope.
         */
        readonly once: boolean,

        /** Closing token kinds, cached for easy access if open by default. */
        readonly closeKinds: readonly Tag[] | undefined,

        /**
         * Guards whether the scope can be recognized,
         * even if all other constraints are satisfied.
         */
        readonly predicates: ScopePredicate[],
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
        const boundaries = Boundaries.newInstancePool(lang, cfg.boundaries)
        const isOpenByDefault = boundaries.find(e => e.open === undefined)
        return new this(
            scopeKind,
            boundaries,
            cfg.terminators?.map(e => lang.tagForKind(e)!) ?? [],
            cfg.flatten,
            cfg.once ?? false,
            isOpenByDefault ? boundaries.map(e => e.close) : undefined,
            cfg.require,
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
            return Scope.newInstance(
                this.query.kind,
                this.markerPos,
                this.markerTokenPos,
                this.begin!,
                end,
            )
        }
        return Scope.newInstance(
            this.query.kind,
            this.markerPos,
            this.markerTokenPos,
            this.markerPos,
            end,
        )
    }
}

/**
 * A cursor over a token stream to extract scope information.
 *
 * Unlike a `Tape`, the position always starts at 0 and can only be incremented.
 */
export class ScopeStream<ScopeKind extends string> {
    readonly closed: IntervalTree<Scope<ScopeKind>>
    private _pos = 0
    private readonly deactivationQueue: UnclosedScope<ScopeKind>[] = []

    /** Permitted to be mutable when passed to predicates. */
    readonly unclosed: UnclosedScope<ScopeKind>[]

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

    constrainOnce(target: UnclosedScope<ScopeKind> | undefined) {
        if (!target) {
            return
        }
        this.deactivationQueue.push(target)
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
    parse(info: ScopeInfo<ScopeKind>): boolean {
        if (this.isExhausted()) {
            return false
        }
        const { predicates } = info
        const cur = this.tokens[this.pos]
        for (const pred of predicates) {
            if (!pred(this.tokens, this.pos, this, info)) {
                return false
            }
        }
        const scope = UnclosedScope.newInstance(info, cur, this.pos)
        this.unclosed.push(scope)
        if (info.once) {
            for (const target of this.deactivationQueue) {
                target.deactivate(info.kind)
            }
        }
        return true
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
     * Opens or closes the topmost scope (as well as any flattened scopes)
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
                    for (idx -= 1; idx >= 0; --idx) {
                        if (!unclosed.at(idx)?.query.flatten?.includes(scope.query.kind)) {
                            break
                        }
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
                    for (idx -= 1; idx >= 0; --idx) {
                        if (!unclosed.at(-1)?.query.flatten?.includes(s.kind)) {
                            break
                        }
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
                        for (idx -= 1; idx >= 0; --idx) {
                            if (!unclosed.at(-1)?.query.flatten?.includes(s.kind)) {
                                break
                            }
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
