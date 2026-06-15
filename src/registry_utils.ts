//! Data structures and algorithms used to match completion snippets.
import { MarkdownString, Position, Range, TextEditor, window } from 'vscode';

import Tape from './tape';
import { Brackets } from './text_utils';

export const MAX_TOKEN_SEEK = 50;
export const MAX_LINE_SEEK = 50;
export const MAX_CHAR_SEEK = 2500;

type FlagChar =
    | 'a'
    | 'b'
    | 'c'
    | 'd'
    | 'e'
    | 'f'
    | 'g'
    | 'h'
    | 'i'
    | 'j'
    | 'k'
    | 'l'
    | 'm'
    | 'n'
    | 'o'
    | 'p'
    | 'q'
    | 'r'
    | 's'
    | 't'
    | 'u'
    | 'v'
    | 'w'
    | 'x'
    | 'y'
    | 'z'
    | '!';

/**
 * A flag for some shorthand, representing a single lowercase letter or symbol.
 *
 * Can represent a range of characters by prepending a '-' and declaring two characters.
 */
export type Flag = FlagChar | `-${FlagChar}${FlagChar}`;

/**
 * The key used to trigger a completion.
 *
 * Triggers are not considered part of a completion, and this is helpful
 * because it allows the completion itself to be highlighted and show suggestions before
 * being fired.
 *
 * If provided, a trigger must take the form of either:
 * - ` `
 * - `;`:
 * - (enter)
 *
 * A `null` trigger means there is no set trigger key,
 * and the completion will fire as soon as it is matched.
 */
export type Trigger = ' ' | ';' | 'enter' | null;

/** Returned as values in the map returned by `Tape.consumeFlags`. */
export type FlagMatch = {
    readonly expansion: string;
    readonly range: Range;
};

/**
 * A shorthand for a programming language element.
 *
 * Once a shorthand is detected, the user must key in a trigger (space, by default) to replace the
 * shorthand with its completion.
 *
 * Unlike chords or motions, shorthands always recognize a trigger. If the user has configured
 * the trigger to be an empty string, the default is used. This is due to the large vocabulary
 * of language-level shorthands, which makes collisions almost guaranteed.
 *
 * @param docs A short description in Markdown, generated dynamically
 * to explain to user exactly what the shorthand does when triggered. This documentation appears
 * next to the cursor shortly after the shorthand is detected but before it is triggered.
 * @param minLookbehind The minimum number of previous, consecutive character insertions
 * for a match to this shorthand to be valid. This is an optimization, often the minimum number
 * of characters for the base case. Can be assigned `NaN` so this shorthand is always checked.
 * @param trigger The key that triggers the completion.
 * If not provided, is inferred to be space (` `).
 * @param scoping The possible scope trees required for this shorthand to match.
 * Nested scopes are not required to be adjacent; they must simply be present in the same order.
 * If not provided, this matches in all scopes.
 * An empty array is considered to be the top-level scope.
 */
export type CompletionFamily<ScopeKind extends string> = {
    readonly docs: MarkdownString;
    readonly minLookbehind: number;
    readonly trigger?: Trigger;
    readonly scoping?: (ScopeKind | `...${ScopeKind}`)[][];
    readonly resolver: (
        ctx: ScopedCompletionContext<ScopeKind>,
    ) => Completion | undefined;
};

/** The result of {@link CompletionFamily.resolver}. */
export class Completion {
    /**
     * A short description of what the completion of the shorthand does.
     *
     * This is created after each match to describe **exactly** how the code is modified.
     * This contrasts with {@link CompletionFamily.docs}, which is a general description of
     * the shorthand or family of shorthands.
     *
     * This is through `expandTabStops` before rendering.
     *
     * This must be given for every completion, even if {@link CompletionFamily.trigger} is `null`,
     * in case future APIs use expose this functionality to the user.
     */
    readonly preview: MarkdownString;

    /** The location of the actual shorthand, which is replaced. */
    readonly target: Range;

    /** The snippet that replaces the {@link target}. */
    readonly snippet: string;

    /**
     * The ranges in the source file within `target` that represent tokens
     * in the shorthand that would be replaced with illegal language constructs if triggered.
     *
     * If the trigger is pressed, the completion will fire according to the
     * all parts of the shorthand that are not highlighted as errors, as
     * enforced by the completion resolver.
     */
    readonly errors?: Range[];

    /**
     * The ranges in the source file within `target`
     * that represent unoptimal tokens in the shorthand.
     *
     * If the trigger is pressed, the completion will fire according to the
     * all parts of the shorthand that are not highlighted as errors, as
     * enforced by the completion resolver.
     */
    readonly warnings?: Range[];

    /**
     * If defined, is the position of the snippet to be inserted. Otherwise,
     * the snippet is inserted at the position of the cursor after the target is deleted.
     */
    readonly insertAt?: Position;

    /** The final position of the cursor after the snippet has been inserted. */
    readonly endCursorPos?: Position;

    constructor(args: {
        preview: MarkdownString;
        target: Range;
        snippet: string;
        errors?: Range[];
        insertAt?: Position;
        endCursorPos?: Position;
    }) {
        if (args.errors) {
            const invalid = args.errors.filter(e => !args.target.contains(e));
            if (invalid.length > 0) {
                const strings = invalid
                    .map(e => {
                        return (
                            `[${e.start.line}:${e.start.character}` +
                            `-${e.end.line}:${e.end.character}]`
                        );
                    })
                    .join(', ');
                window.showWarningMessage(
                    `Deadeye: Error range(s) outside of target: ${strings}`,
                );
                this.errors = args.errors.filter(e => args.target.contains(e));
            } else {
                this.errors = args.errors;
            }
        }
        this.preview = args.preview;
        this.target = args.target;
        this.snippet = args.snippet;
        this.insertAt = args.insertAt;
        this.endCursorPos = args.endCursorPos;
    }
}

/**
 * Created and stored after a shorthand is matched, and recalled once the trigger is pressed.
 *
 * @param position the position of the cursor the instance this object was created.
 */
export type CompletionStrategy = {
    readonly family: CompletionFamily<any>;
    readonly completion: Completion;
    readonly position: Position;
};

/**
 * Used to resolve {@link Scope scopes}.
 *
 * {@link Completion Completions} are {@link CompletionFamily.resolver resolved}
 * use the child class {@link ScopedCompletionContext}, since it contains the
 * scope tree for the current position of the cursor.
 */
export class CompletionContext {
    readonly line: Tape;
    readonly cursor: Position;
    readonly editor: TextEditor;
    protected readonly keyIn: string;

    constructor(keyIn: string, cursor: Position, editor: TextEditor) {
        this.line = Tape.over(editor.document.lineAt(cursor.line).text + keyIn);
        this.cursor = cursor;
        this.editor = editor;
        this.keyIn = keyIn;
    }

    toScoped<ScopeKind extends string>(resolver: ScopeResolver<ScopeKind>) {
        return ScopedCompletionContext.withResolver(
            this.keyIn,
            this.cursor,
            this.editor,
            resolver,
        );
    }

    /** Returns a tape over the current line up to the cursor. */
    leftOfCursor(): Tape {
        return this.line.before(this.cursor);
    }

    /** Returns a tape over the current line after the cursor. */
    rightOfCursor(): Tape {
        return this.line.after(this.cursor);
    }

    seekOpener(brackets: Brackets): Position | undefined {
        return this.seekOpenerRecursive(brackets, this.cursor, true);
    }

    seekCloser(brackets: Brackets): Position | undefined {
        return this.seekCloserRecursive(brackets, this.cursor, true);
    }

    fileUpToCursor(): Tape {
        return Tape.over(
            this.editor.document.getText(
                new Range(new Position(0, 0), this.cursor),
            ),
        );
    }

    private static OTHER_BRACKETS: Record<string, string> = {
        ')': '}]>',
        '}': ')]>',
        ']': ')}>',
        '>': ')}]',
        '(': '{[<',
        '{': '([<',
        '[': '({<',
        '<': '({[',
    };

    private seekOpenerRecursive(
        brackets: Brackets,
        start: Position,
        recur: boolean,
    ): Position | undefined {
        let depth = 0;
        let lineLookbehind = 0;
        const [open, closed] = brackets;
        for (let line = start.line; line >= 0; line--, lineLookbehind++) {
            if (lineLookbehind > MAX_LINE_SEEK) {
                return undefined;
            }
            const text = this.editor.document.lineAt(line).text;
            const end = line === start.line ? start.character : text.length;
            for (let character = end - 1; character >= 0; character--) {
                const ch = text[character];
                if (recur) {
                    if (CompletionContext.OTHER_BRACKETS[open].includes(ch)) {
                        // missing closer for other type of bracket
                        return undefined;
                    }
                    if (CompletionContext.OTHER_BRACKETS[closed].includes(ch)) {
                        const openPos = this.seekOpenerRecursive(
                            (ch === ')'
                                ? '('
                                : String.fromCharCode(
                                      ch.charCodeAt(0) - 2,
                                  )) as Brackets,
                            new Position(line, character),
                            false,
                        );
                        if (!openPos) {
                            return undefined;
                        }
                        line = openPos.line;
                        character = openPos.character;
                        continue;
                    }
                } else if (ch === open) {
                    if (depth === 0) {
                        return new Position(line, character + 1);
                    }
                    depth--;
                } else if (ch === closed) {
                    depth++;
                }
            }
        }
        return undefined;
    }

    private seekCloserRecursive(
        brackets: Brackets,
        start: Position,
        recur: boolean,
    ): Position | undefined {
        let depth = 0;
        let lineLookbehind = 0;
        const doc = this.editor.document;
        const [open, closed] = brackets;
        for (
            let line = start.line;
            line < doc.lineCount;
            line++, lineLookbehind++
        ) {
            if (lineLookbehind > MAX_LINE_SEEK) {
                return undefined;
            }
            const text = doc.lineAt(line).text;
            const end = line === start.line ? start.character : text.length;
            for (let character = 0; character < end; character++) {
                const ch = text[character];
                if (recur) {
                    if (CompletionContext.OTHER_BRACKETS[closed].includes(ch)) {
                        // missing closer for other type of bracket
                        return undefined;
                    }
                    if (CompletionContext.OTHER_BRACKETS[open].includes(ch)) {
                        const closedPos = this.seekCloserRecursive(
                            (ch === ')'
                                ? '('
                                : String.fromCharCode(
                                      ch.charCodeAt(0) - 2,
                                  )) as Brackets,
                            new Position(line, character),
                            false,
                        );
                        if (!closedPos) {
                            return undefined;
                        }
                        line = closedPos.line;
                        character = closedPos.character;
                        continue;
                    }
                } else if (ch === closed) {
                    if (depth === 0) {
                        return new Position(line, character + 1);
                    }
                    depth--;
                } else if (ch === open) {
                    depth++;
                }
            }
        }
        return undefined;
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
 * Represents a member in the scope tree at a particular position in a file.
 *
 * @param kind the type of scope, as defined in `lang/<langId>/scopes.ts`
 * @param markerPos the position of the first character of the scope marker
 * (`if`, `fn`, `impl`, `mod`, etc.), which is primarily useful to hot completions
 * that modify the scope signature.
 * @param openPos the position of the opening bracket that denotes this scope.
 */
export type Scope<ScopeKind extends string> = {
    readonly kind: ScopeKind;
    readonly markerPos: Position;
    readonly openPos: Position;
};

/**
 * Contains the scope tree for the current cursor position.
 *
 * {@link Completion Completions} are {@link CompletionFamily.resolver resolved}
 * using instances of this class.
 *
 * @see CompletionContext
 */
export class ScopedCompletionContext<
    ScopeKind extends string,
> extends CompletionContext {
    readonly scopes: Scope<ScopeKind>[];

    constructor(
        keyIn: string,
        cursor: Position,
        editor: TextEditor,
        scopes: Scope<ScopeKind>[],
    ) {
        super(keyIn, cursor, editor);
        this.scopes = scopes;
    }

    static withResolver<ScopeKind extends string>(
        keyIn: string,
        cursor: Position,
        editor: TextEditor,
        resolver: ScopeResolver<ScopeKind>,
    ) {
        return new ScopedCompletionContext(
            keyIn,
            cursor,
            editor,
            resolver(new CompletionContext(keyIn, cursor, editor)),
        );
    }

    clone(): ScopedCompletionContext<ScopeKind> {
        return new ScopedCompletionContext(
            this.keyIn,
            this.cursor,
            this.editor,
            this.scopes,
        );
    }
}
