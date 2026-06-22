import { Position, TextEditor } from 'vscode';
import { CompletionContext } from './completion_registry_utils';
import { Token } from './language_utils';
import { Span } from './misc';
import { Boundary } from './text_utils';

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

export class ScopedSpan<ScopeKind extends string> extends Span {
    readonly kind: ScopeKind;

    constructor(kind: ScopeKind, begin: number, end: number) {
        super(begin, end);
        this.kind = kind;
    }
}

// flat list is most optimal, surprisingly
export class FileScopeMap<ScopeKind extends string> {
    private tree: ScopedSpan<ScopeKind>[] = [];

    // push(kind: ScopeKind, length: number) {
    //     if (this.tree.length === 0) {
    //         this.tree.push(new ScopeSpan(kind, 0, length));
    //         return;
    //     }
    //     const begin = this.tree.at(-1)!.end;
    //     this.tree.push(new ScopeSpan(kind, begin, begin + length));
    // }

    push(span: ScopedSpan<ScopeKind>) {
        this.tree.push(span);
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

/** Represents a member in the scope tree at a particular position in a file. */
export type Scope<ScopeKind extends string> = {
    /** The type of scope, as defined in `lang/<langId>/scopes.ts`. */
    readonly kind: ScopeKind;

    /**
     * The position of the first character of the scope marker
     * (`if`, `fn`, `impl`, `mod`, etc.), which is primarily useful to hot completions
     * that modify the scope signature.
     */
    readonly markerPos: Position;

    /** The position of the opening bracket that denotes this scope. */
    readonly openPos: Position;
};

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
        boundary: Boundary,
        scopes: Scope<ScopeKind>[],
    ) {
        super(keyIn, cursor, editor, boundary);
        this.scopes = scopes;
    }

    static withResolver<ScopeKind extends string>(
        keyIn: string,
        cursor: Position,
        editor: TextEditor,
        boundary: Boundary,
        resolver: ScopeResolver<ScopeKind>,
    ) {
        return new ScopedCompletionContext(
            keyIn,
            cursor,
            editor,
            boundary,
            resolver(new CompletionContext(keyIn, cursor, editor, boundary)),
        );
    }

    clone(): ScopedCompletionContext<ScopeKind> {
        return new ScopedCompletionContext(
            this.keyIn,
            this.cursor,
            this.editor,
            this.boundary,
            this.scopes,
        );
    }
}

/** Denotes where a scope begins. */
export class ScopeQuery<ScopeKind extends string> {
    readonly kind: ScopeKind;
    readonly begin: number;
    readonly opener: ScopeKind;
    readonly closer: ScopeKind;
    readonly flatten: boolean;

    constructor(
        kind: ScopeKind,
        begin: number,
        opener: ScopeKind,
        closer: ScopeKind,
        flatten: boolean,
    ) {
        this.kind = kind;
        this.begin = begin;
        this.opener = opener;
        this.closer = closer;
        this.flatten = flatten;
    }

    close(end: number): ScopedSpan<ScopeKind> {
        return new ScopedSpan(this.kind, this.begin, end);
    }
}

/** A cursor over a token stream to extract scope information. */
export class ScopeStream<ScopeKind extends string> {
    readonly scopeMap: FileScopeMap<ScopeKind>;
    readonly primed: ScopeQuery<ScopeKind>[];
    private readonly open: ScopeQuery<ScopeKind>[];

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
     * Consumes the next scope signature (marker + attributes + sentinel) up to,
     * and including, the terminator (typically an open bracket).
     *
     * If the signature was matched, it is primed to be added to the underlying scope map.
     * Scopes that are flattened share the opener-closer pair of the next scope.
     * As a result, they are primed and closed at the same time. Flattened scopes can be
     * stacked.
     *
     * @returns `true` if the scope signature was matched.
     */
    consumeSignature(
        kind: ScopeKind,
        possibleMarkerKinds: string[],
        opener: ScopeKind,
        closer: ScopeKind,
        flatten: boolean = false,
    ): boolean {
        if (
            this._cur.isHead() ||
            !possibleMarkerKinds.includes(this._cur.kind!)
        ) {
            return false;
        }
        const begin = this._cur.span.begin;
        do {
            this.adv();
        } while (this.cur().notKindNorTail(opener));
        if (!this._cur.isTail()) {
            this.adv();
        }
        this.primed.push(new ScopeQuery(kind, begin, opener, closer, flatten));
        return true;
    }

    /**
     * Opens the current scopes or closes the current scope (as well as any flattened scopes),
     * depending on the current token.
     */
    consumeElse() {
        const cur = this._cur;
        if (cur.isHead()) {
            return;
        }
        let matched = false;
        const primed = this.primed;
        const open = this.open;
        for (let idx = primed.length - 1; idx >= 0; idx--) {
            const query = primed[idx];
            if (cur.kind === query.opener) {
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
            if (cur.kind === query.closer) {
                open.pop();
                while (open.at(-1)!.flatten) {
                    this.scopeMap.push(open.pop()!.close(scopeEnd));
                }
                this.scopeMap.push(query.close(scopeEnd));
            }
        }
    }
}
