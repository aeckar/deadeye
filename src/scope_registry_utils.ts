//! Scope registry API and utilities.
//!
//! todo explain vocab
import { IntervalTree, IntervalTreeService } from './interval_tree'
import { Token, TokenKind } from './language_utils'
import { properties } from './misc'
import { Scope } from './scope_utils'

export class UnclosedScope<ScopeKind extends string> {
    private _begin?: number
    private _expectedClose?: TokenKind[]
    private _isOpen: boolean = false
    private _isReopened: boolean = false

    constructor(
        readonly kind: ScopeKind,
        readonly markerPos: number,
        readonly possibleBoundaries: Boundaries[],
        readonly flatten: boolean,
    ) {}

    get begin(): number | undefined {
        return this._begin
    }

    get expectedClose(): TokenKind[] | undefined {
        return this._expectedClose
    }

    get isOpen(): boolean {
        return this._isOpen
    }

    get isReopened(): boolean {
        return this._isReopened
    }

    /** Can be called a second time to declare a scope to be open at a later token. */
    open(begin: number, expectedClose: TokenKind[]) {
        if (this._isOpen) {
            this._isReopened = true
        }
        this._begin = begin
        this._expectedClose = expectedClose
        this._isOpen = true
    }

    close(end: number): Scope<ScopeKind> {
        if (this.begin !== undefined) {
            return new Scope(this.kind, this.markerPos, this.begin!, end)
        }
        return new Scope(this.kind, this.markerPos, this.markerPos, end)
    }
}

export type BoundariesCfg = ([string | null, string] | string)[]

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
        readonly open: TokenKind | undefined,
        readonly close: TokenKind,
    ) {}

    static newInstance(cfg: BoundariesCfg): Boundaries[] {
        const boundaryMarkers: Boundaries[] = []
        for (const boundaries of cfg) {
            if (typeof boundaries === 'string') {
                boundaryMarkers.push(
                    Boundaries.unchecked(
                        'OPEN_' + boundaries,
                        'CLOSE_' + boundaries,
                    ),
                )
                continue
            }
            const [open, close] = boundaries
            boundaryMarkers.push(Boundaries.unchecked(open, close))
        }
        return boundaryMarkers
    }

    static unchecked(open: string | null, close: string): Boundaries {
        return new Boundaries(
            (open ? open : undefined) as TokenKind,
            close as TokenKind,
        )
    }
}

export type ScopeInfoCfg<ScopeKind extends string> = {
    possibleBoundaries: BoundariesCfg
    possibleMarkers?: string[]
    flatten?: boolean
    outerOpenScope?: ScopeKind
    outerPrimedScope?: ScopeKind
}

export class ScopeInfo<ScopeKind extends string> {
    private constructor(
        readonly scopeKind: ScopeKind,
        readonly possibleMarkers: string[],
        readonly possibleBoundaries: Boundaries[],
        readonly flatten: boolean,
        readonly outerOpenScope?: ScopeKind,
        readonly outerPrimedScope?: ScopeKind,

        /** A cached array of closing token kinds. */
        readonly closeKinds?: TokenKind[],
    ) {}

    get isOpenByDefault(): boolean {
        return this.closeKinds !== undefined
    }

    static newInstance<ScopeKind extends string>(
        scopeKind: ScopeKind,
        cfg: ScopeInfoCfg<ScopeKind>,
    ): ScopeInfo<ScopeKind> {
        const boundaries = Boundaries.newInstance(cfg.possibleBoundaries)
        const startOpen = boundaries.find(e => e.open === undefined)
        return new ScopeInfo(
            scopeKind,
            cfg.possibleMarkers ?? [scopeKind.toUpperCase()],
            boundaries,
            cfg.flatten ?? false,
            cfg.outerOpenScope,
            cfg.outerPrimedScope,
            startOpen ? boundaries.map(e => e.close) : undefined,
        )
    }
}

/** A cursor over a token stream to extract scope information. */
export class ScopeStream<ScopeKind extends string> {
    readonly closed: IntervalTree<Scope<ScopeKind>>
    private readonly unclosed: UnclosedScope<ScopeKind>[]

    private _cur: Token

    constructor(begin: Token) {
        this._cur = begin.isHead() ? begin.next : begin
        this.closed = IntervalTreeService.newInstance<Scope<ScopeKind>>()
        this.unclosed = []
    }
    /** The token currently being pointed to. */
    cur(): Token {
        return this._cur
    }

    /** Assigns the next token as the current one. */
    adv() {
        this._cur = this._cur.next
    }

    /** Returns true if the current token is the tail. */
    isExhausted(): boolean {
        return this._cur.kind === ''
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
        const {
            scopeKind,
            possibleMarkers,
            possibleBoundaries,
            flatten,
            outerOpenScope,
            outerPrimedScope,
        } = query
        const start = this._cur
        const { unclosed } = this
        if (
            start.isHead() ||
            !possibleMarkers.includes(start.kind!) ||
            (outerPrimedScope !== undefined &&
                !unclosed.find(
                    scope => !scope.isOpen && scope?.kind !== outerPrimedScope,
                )) ||
            (outerOpenScope !== undefined &&
                !unclosed.find(
                    scope => scope.isOpen && scope?.kind !== outerOpenScope,
                ))
        ) {
            return false
        }
        this._cur = start.next
        const scope = new UnclosedScope(
            scopeKind,
            start.begin,
            possibleBoundaries,
            flatten,
        )
        if (query.isOpenByDefault) {
            scope.open(start.end, query.closeKinds!)
        }
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
     * Unexpected openers or closers belonginging to any incomplete scope that is
     * not the top scope should close/open that scope and discard all that are above.
     */
    collect() {
        const start = this._cur
        const { unclosed, closed } = this
        if (start.isHead() || unclosed.length === 0) {
            // if `start.isHead()`, then `start.kind === undefined`
            return
        }
        const token = start.kind
        const top = unclosed.at(-1)!

        // Attempt to close top scope by matching to any expected closer
        // Top scope was opened by previous call
        if (top.isOpen) {
            if (top.expectedClose?.includes(token!)) {
                closed.insert(unclosed.pop()!.close(start.begin))
                while (unclosed.at(-1)?.flatten) {
                    // cascade changes to adjacent flat scopes
                    closed.insert(unclosed.pop()!.close(start.begin))
                }
            }
            return
        }

        // Find topmost scope that can be resolved, then discard all that are above
        let discardCount = 0
        let idx = unclosed.length - 1
        while (idx >= 0) {
            const scope = unclosed[idx]
            for (const boundaries of scope.possibleBoundaries) {
                // Attempt to open scope by matching to opener
                if (
                    token === boundaries.open &&
                    (!scope.isOpen || !scope.isReopened)
                ) {
                    scope.open(start.end, [boundaries.open!])
                    for (idx--; idx >= 0 && unclosed[idx]?.flatten; idx--) {
                        unclosed[idx].open(start.end, [boundaries.open!])
                    }
                    discardCount = unclosed.length - 1 - idx
                    break
                }

                // Attempt to close scope by matching to any closer
                // Scope is always-open or always-primed
                if (
                    token === boundaries.close &&
                    (scope.isOpen || boundaries.open === undefined)
                ) {
                    closed.insert(unclosed.pop()!.close(start.begin))
                    for (--idx; idx >= 0 && unclosed.at(-1)?.flatten; idx--) {
                        closed.insert(unclosed.pop()!.close(start.begin))
                    }
                    discardCount = unclosed.length - 1 - idx
                    break
                }
            }
            idx--
        }
        if (discardCount > 0) {
            unclosed.splice(idx + 1, discardCount)
        }
    }
}

export type ScopeRegistryCfg<ScopeKind extends string> = {
    [K in ScopeKind]: ScopeInfoCfg<ScopeKind>
}

export type ScopeRegistry<ScopeKind extends string> = Map<
    ScopeKind,
    ScopeInfo<ScopeKind>
> & { __brand: 'CompletionRegistry' }

export function newScopeRegistry<ScopeKind extends string>(
    cfg: ScopeRegistryCfg<ScopeKind>,
): ScopeRegistry<ScopeKind> {
    const registry = new Map<ScopeKind, ScopeInfo<ScopeKind>>()
    for (const { key, value } of properties(cfg)) {
        registry.set(key, ScopeInfo.newInstance(key, value))
    }
    return registry as ScopeRegistry<ScopeKind>
}