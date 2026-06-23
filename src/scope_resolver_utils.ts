import { Position, TextEditor } from 'vscode';
import { CompletionContext } from './completion_registry_utils';
import { Token, TokenKind } from './language_utils';
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

    /**
     * Registers a scope.
     *
     * This method does not need to be called in any particular order.
     */
    push(scope: Scope<ScopeKind>) {
        this.tree.push(scope);
    }

    //todo sort then expose tree
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
        identifiers: IdentifierRule,
        scopes: Scope<ScopeKind>[],
    ) {
        super(keyIn, cursor, editor, identifiers);
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

export class IncompleteScope<
    ScopeKind extends string,
> implements IncompleteScope<ScopeKind> {
    private _begin?: number;
    private _expectedClose?: TokenKind[];
    private _isOpen: boolean = false;

    constructor(
        readonly kind: ScopeKind,
        readonly markerPos: number,
        readonly possibleBoundaries: Boundaries[],
        readonly flatten: boolean,
    ) {}

    get begin(): number | undefined {
        return this._begin;
    }

    get expectedClose(): TokenKind[] | undefined {
        return this._expectedClose;
    }

    get isOpen(): boolean {
        return this._isOpen;
    }

    open(begin: number, expectedClose: TokenKind[]) {
        this._begin = begin;
        this._expectedClose = expectedClose;
        this._isOpen = true;
    }

    close(end: number): Scope<ScopeKind> {
        if (this.begin !== undefined) {
            return new Scope(this.kind, this.markerPos, this.begin!, end);
        }
        return new Scope(this.kind, this.markerPos, this.markerPos, end);
    }
}

export type BoundariesCfg = [TokenKind | undefined, TokenKind][];

/**
 * The boundaries of a scope.
 *
 * - **`startOpen` + `open === undefined`:** `<scope-marker> ...open... <primed>`
 * - **`open === undefined`:** `<scope-marker> ...primed... <close>`
 * - **`open !== undefined`:** `<scope-marker> ...primed... <open> ...open... <close>`
 */
export class Boundaries {
    constructor(
        readonly open: TokenKind | undefined,
        readonly close: TokenKind,
    ) {}

    static newInstance(cfg: BoundariesCfg): Boundaries[] {
        const boundaryMarkers: Boundaries[] = [];
        for (const [open, close] of cfg) {
            boundaryMarkers.push(new Boundaries(open, close));
        }
        return boundaryMarkers;
    }
}

export type ScopeQueryCfg<ScopeKind extends string> = {
    scopeKind: ScopeKind;
    markers?: string[];
    possibleBoundaries: BoundariesCfg;
    flatten?: boolean;
    startOpen?: boolean;
    outerOpenScope?: ScopeKind;
    outerPrimedScope?: ScopeKind;
};

export class ScopeQuery<ScopeKind extends string> {
    private constructor(
        readonly scopeKind: ScopeKind,
        readonly markers: string[],
        readonly possibleBoundaries: Boundaries[],
        readonly flatten: boolean,
        readonly startOpen: boolean,
        readonly outerOpenScope?: ScopeKind,
        readonly outerPrimedScope?: ScopeKind,

        /** A cached array of closing token kinds, assigned if `startOpen === true`. */
        readonly closeKinds?: TokenKind[],
    ) {}

    static newInstance<ScopeKind extends string>(
        cfg: ScopeQueryCfg<ScopeKind>,
    ): ScopeQuery<ScopeKind> {
        const boundaries = Boundaries.newInstance(cfg.possibleBoundaries);
        return new ScopeQuery(
            cfg.scopeKind,
            cfg.markers ?? [cfg.scopeKind.toUpperCase()],
            boundaries,
            cfg.flatten ?? false,
            cfg.startOpen ?? false,
            cfg.outerOpenScope,
            cfg.outerPrimedScope,
            cfg.startOpen ? boundaries.map(e => e.close) : undefined,
        );
    }
}

/** A cursor over a token stream to extract scope information. */
export class ScopeStream<ScopeKind extends string> {
    readonly complete: FileScopeMap<ScopeKind>;
    private readonly incomplete: IncompleteScope<ScopeKind>[];

    private _cur: Token;

    constructor(begin: Token) {
        this._cur = begin.isHead() ? begin.next : begin;
        this.complete = new FileScopeMap();
        this.incomplete = [];
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
            scopeKind,
            markers,
            possibleBoundaries,
            flatten,
            outerOpenScope,
            outerPrimedScope,
        } = query;
        const start = this._cur;
        const { incomplete } = this;
        if (
            start.isHead() ||
            !markers.includes(start.kind!) ||
            (outerPrimedScope !== undefined &&
                !incomplete.find(
                    scope => !scope.isOpen && scope?.kind !== outerPrimedScope,
                )) ||
            (outerOpenScope !== undefined &&
                !incomplete.find(
                    scope => scope.isOpen && scope?.kind !== outerOpenScope,
                ))
        ) {
            return false;
        }
        this._cur = start.next;
        const scope = new IncompleteScope(
            scopeKind,
            start.begin,
            possibleBoundaries,
            flatten,
        );
        if (query.startOpen) {
            scope.open(start.end, query.closeKinds!);
        }
        this.incomplete.push(scope);
        return true;
    }

    /**
     * Opens the current scope or closes the current scope (as well as any flattened scopes),
     * depending on the current token.
     *
     * This function should be called at the end of every iteration
     * of the scanner execution loop.
     */
    parseElse() {
        const start = this._cur;
        const { incomplete, complete } = this;
        if (start.isHead() || incomplete.length === 0) {
            // if `start.isHead()`, then `start.kind === undefined`
            return;
        }
        const scope = incomplete.at(-1)!;
        if (scope.isOpen) {
            if (scope.expectedClose?.includes(start.kind!)) {
                complete.push(incomplete.pop()!.close(start.begin));
                while (incomplete.at(-1)?.flatten) {
                    complete.push(incomplete.pop()!.close(start.begin));
                }
            }
            return;
        }
        for (const boundaries of scope.possibleBoundaries) {
            if (start.kind === boundaries.open && !scope.isOpen) {
                scope.open(start.end, [boundaries.open!]);
                let idx = incomplete.length - 2;
                while (idx >= 0 && incomplete[idx]?.flatten) {
                    incomplete[idx].open(start.end, [boundaries.open!]);
                }
                return;
            }
            if (
                start.kind === boundaries.close &&
                (scope.isOpen || boundaries.open === undefined)
            ) {
                complete.push(incomplete.pop()!.close(start.begin));
                while (incomplete.at(-1)?.flatten) {
                    complete.push(incomplete.pop()!.close(start.begin));
                }
                return;
            }
        }
    }
}
