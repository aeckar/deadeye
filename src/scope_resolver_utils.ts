import { Position, TextEditor } from 'vscode';
import { CompletionContext } from './completion_registry_utils';
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

export class ScopeSpan<ScopeKind extends string> extends Span {
    readonly kind: ScopeKind;

    constructor(kind: ScopeKind, begin: number, end: number) {
        super(begin, end);
        this.kind = kind;
    }
}

// flat list is most optimal, surprisingly
export class Scopes<ScopeKind extends string> {
    private tree: ScopeSpan<ScopeKind>[] = [];

    push(kind: ScopeKind, length: number) {
        if (this.tree.length === 0) {
            this.tree.push(new ScopeSpan(kind, 0, length));
            return;
        }
        const begin = this.tree.at(-1)!.end;
        this.tree.push(new ScopeSpan(kind, begin, begin + length));
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
