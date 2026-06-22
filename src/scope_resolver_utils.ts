import { Position, TextEditor } from 'vscode';
import { CompletionContext } from './completion_registry_utils';
import { Token } from './language_utils';
import { Span } from './misc';
import { IdentifierRule } from './text_utils';

/**
 * A possible configuration of nested scopes.
 *
 * Scope kinds may be prefixed by `...` to indicate any sequence of scopes leading to that one.
 *
 * Nested scopes are not required to be adjacent; they must simply be present in the same order.
 * If not provided as an argument, the completion is matched in all scopes.
 * Passing an empty array is considered to be the top-level scope.
 */
export type ScopeTree<ScopeKind extends string> = (
    | ScopeKind
    | `...${ScopeKind}`
)[];

/** A member in the scope tree at a particular position in a file. */
export class Scope<ScopeKind extends string> extends Span {
    constructor(
        /** The type of scope, as defined in `lang/<langId>/scopes.ts`. */
        readonly kind: ScopeKind,

        /**
         * The position of the first character of the scope marker
         * (`if`, `fn`, `impl`, `mod`, etc.), which is primarily useful to hot completions
         * that modify the scope signature.
         */
        readonly markerPos: number,
        begin: number,
        end: number,
    ) {
        super(begin, end);
    }
}

/**
 * Contains all scopes present within a file.
 * 
 * # Implementation
 * 
 * For simple lookup, a flat list is most optimal when compared with a heap or search tree.
 */
export class FileScopeMap<ScopeKind extends string> {
    private tree: Scope<ScopeKind>[] = [];

    // push(kind: ScopeKind, length: number) {
    //     if (this.tree.length === 0) {
    //         this.tree.push(new ScopeSpan(kind, 0, length));
    //         return;
    //     }
    //     const begin = this.tree.at(-1)!.end;
    //     this.tree.push(new ScopeSpan(kind, begin, begin + length));
    // }

    push(scope: Scope<ScopeKind>) {
        this.tree.push(scope);
    }
}

/**
 * Implemented by a top-level constant for each language,
 * which is then be passed as an entry to `scopeResolvers` (`lang/scope_resolvers.ts`).
 * This then provides scope resolution for a given `langId`.
 */
export type ScopeResolver<ScopeKind extends string> = (
    ctx: CompletionContext,
) => Scope<ScopeKind>[];

/**
 * Contains the scope tree for the current cursor position.
 *
 * {@link Completion Completions} and completion prefixes are resolved
 * using instances of this class.
 *
 * @see CompletionContext
 */
export class ScopedCompletionContext<
    ScopeKind extends string,
> extends CompletionContext {
    readonly scopes: Scope<ScopeKind>[];

    /** Users should create a {@link CompletionContext} first, then call {@link toScoped}. */
    private constructor(
        keyIn: string,
        cursor: Position,
        editor: TextEditor,
        boundary: IdentifierRule,
        scopes: Scope<ScopeKind>[],
    ) {
        super(keyIn, cursor, editor, boundary);
        this.scopes = scopes;
    }

    static withResolver<ScopeKind extends string>(
        keyIn: string,
        cursor: Position,
        editor: TextEditor,
        identifiers: IdentifierRule,
        resolver: ScopeResolver<ScopeKind>,
    ) {
        return new ScopedCompletionContext(
            keyIn,
            cursor,
            editor,
            identifiers,
            resolver(new CompletionContext(keyIn, cursor, editor, identifiers)),
        );
    }

    clone(): ScopedCompletionContext<ScopeKind> {
        return new ScopedCompletionContext(
            this.keyIn,
            this.cursor,
            this.editor,
            this.identifiers,
            this.scopes,
        );
    }
}

export class IncompleteScope<ScopeKind extends string> {
    constructor(
        readonly kind: ScopeKind,
        readonly markerPos: number,
        readonly begin: number,
        readonly boundaryMarkers: BoundaryMarkers,
        readonly flatten: boolean,
    ) {}

    finish(end: number): Scope<ScopeKind> {
        return new Scope(this.kind, this.markerPos, this.begin, end);
    }
}

/**
 * The boundaries of a scope.
 *
 * - If `open` is the same token as the scope marker,
 * the scope is opened immediately instead of being primed first.
 * - If `open` is unassigned, this scope will be primed (recorded, but not active)
 * until it is closed.
 * - If both `open` and `close` are assigned, the scope is primed as soon as the marker is
 * matched, is opened when `open` is matched, and closed when `close` is matched.
 */
export class BoundaryMarkers {
    constructor(
        readonly open: string | null,
        readonly close: string,
        readonly attribute: BoundaryAttribute,
    ) {}

    static of<ScopeKind extends string>(
        scope: ScopeKind,
        arg: Boundaries<ScopeKind>,
    ): BoundaryMarkers[] {
        const boundaryMarkers: BoundaryMarkers[] = [];
        for (const boundary of arg) {
            if (typeof boundary === 'string') {
                boundaryMarkers.push(
                    new BoundaryMarkers(scope.toUpperCase(), boundary, 'none'),
                );
                continue;
            }
            if (boundary instanceof AlwaysOpen) {
                boundaryMarkers.push(
                    new BoundaryMarkers(null, boundary.close, 'always-open'),
                );
                continue;
            }
            boundaryMarkers.push(
                new BoundaryMarkers(
                    null,
                    (boundary as AlwaysPrimed).close,
                    'always-primed',
                ),
            );
        }
        return boundaryMarkers;
    }
}

export type BoundaryAttribute = 'always-open' | 'always-primed' | 'none';

export class AlwaysOpen {
    constructor(readonly close: string) {}
}

export class AlwaysPrimed {
    constructor(readonly close: string) {}
}

/** Configuration form of {@link BoundaryMarkers}. */
export type Boundaries<ScopeKind extends string> = (
    | [ScopeKind, ScopeKind]
    | AlwaysOpen
    | AlwaysPrimed
)[];

export type ScopeQueryCfg<ScopeKind extends string> = {
    scope: ScopeKind;
    scopeMarkers?: string[];
    boundaries: Boundaries<ScopeKind>;
    flatten?: boolean;
    outerScope?: ScopeKind;
    outerScopeMarker?: ScopeKind;
};

export class ScopeQuery<ScopeKind extends string> {
    private constructor(
        readonly scope: ScopeKind,
        readonly scopeMarkers: string[],
        readonly boundaryMarkers: BoundaryMarkers[],
        readonly flatten: boolean,
        readonly outerScope?: ScopeKind,
        readonly outerScopeMarker?: ScopeKind,
    ) {}

    static newInstance<ScopeKind extends string>(
        cfg: ScopeQueryCfg<ScopeKind>,
    ): ScopeQuery<ScopeKind> {
        return new ScopeQuery(
            cfg.scope,
            cfg.scopeMarkers ?? [cfg.scope.toUpperCase()],
            BoundaryMarkers.of(cfg.scope, cfg.boundaries),
            cfg.flatten ?? false,
            cfg.outerScope,
            cfg.outerScopeMarker,
        );
    }
}

/** A cursor over a token stream to extract scope information. */
export class ScopeStream<ScopeKind extends string> {
    readonly scopeMap: FileScopeMap<ScopeKind>;
    readonly primed: IncompleteScope<ScopeKind>[];
    private readonly open: IncompleteScope<ScopeKind>[];

    private _cur: Token;

    constructor(begin: Token) {
        this._cur = begin.isHead() ? begin.next : begin;
        this.scopeMap = new FileScopeMap();
        this.primed = [];
        this.open = [];
    }
    /** The token currently being pointed to. */
    cur(): Token {
        return this._cur;
    }

    /** Assigns the next token as the current one. */
    adv() {
        this._cur = this._cur.next;
    }

    /** Returns true if the current token is the tail. */
    isExhausted(): boolean {
        return this._cur.kind === '';
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
     * For each entry in the `boundaries` array:
     * - If opener is `n
     *
     * @returns `true` if the scope signature was matched.
     */
    parseScope(query: ScopeQuery<ScopeKind>): boolean {
        const {
            scope,
            scopeMarkers,
            boundaryMarkers,
            flatten,
            outerScope,
            outerScopeMarker,
        } = query;
        const start = this._cur;
        const { primed, open } = this;
        if (
            start.isHead() ||
            !scopeMarkers.includes(start.kind!) ||
            (outerScopeMarker !== undefined &&
                primed.at(-1)?.kind !== outerScopeMarker) ||
            (outerScope !== undefined && open.at(-1)?.kind !== outerScope)
        ) {
            return false;
        }
        const begin = this._cur.span.begin;
        while (true) {
            this.adv();
            for (const marker of boundaryMarkers) {
                if (this._cur.prev.kind === marker.open) {
                }
            }
        }
        while (
            boundaryMarkers.find(
                e => e !== undefined && this.cur().isNotKindNorTail(e.open),
            )
        );
        this._cur = start.next;
        this.primed.push(
            new IncompleteScope(scope, begin, boundaryMarkers, flatten),
        );
        return true;
    }

    /**
     * Opens the current scopes or closes the current scope (as well as any flattened scopes),
     * depending on the current token.
     */
    parseElse() {
        const cur = this._cur;
        if (cur.isHead()) {
            return;
        }
        let matched = false;
        const { primed, open } = this;
        for (let idx = primed.length - 1; idx >= 0; idx--) {
            const query = primed[idx];
            if (cur.kind === query.boundaryMarkers.open) {
                primed.pop();
                while (primed.at(-1)!.flatten) {
                    open.push(primed.pop()!);
                }
                open.push(query);
                matched = true;
            }
        }
        if (matched) {
            return;
        }
        const scopeEnd = cur.span.end;
        for (let idx = this.open.length - 1; idx >= 0; idx--) {
            const query = open[idx];
            if (cur.kind === query.boundaryMarkers.close) {
                open.pop();
                while (open.at(-1)!.flatten) {
                    this.scopeMap.push(open.pop()!.finish(scopeEnd));
                }
                this.scopeMap.push(query.finish(scopeEnd));
            }
        }
    }
}
