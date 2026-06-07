//! Data structures and algorithms used to match completion snippets.
import { MarkdownString, Position, Range, TextEditor, window } from 'vscode';

import { Scope } from './scoping_utils';
import Tape from './tape';
import { Brackets } from './text_utils';

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
 */
export type CompletionFamily<ScopeKind extends string> = {
    readonly docs: MarkdownString;
    readonly minLookbehind: number;
    readonly trigger?: Trigger;
    readonly scoping?: (ScopeKind | `...${ScopeKind}`)[][];
    readonly resolver: (
        ctx: CompletionContext<ScopeKind>,
    ) => Completion | undefined;
};

// Use U+FF0F to escape `*/` in doc comment
/**
 * The result of {@link CompletionFamily.resolver}.
 *
 * @param preview A short description of what the completion of the shorthand does.
 * This is dynamically created to describe **exactly** how the code is modified. This contrasts
 * with {@link CompletionFamily.docs}, which is a general description of
 * the shorthand or family of shorthands. Ran through `expandTabStops` before rendering.
 * @param target The location of the actual shorthand, which is deleted.
 * most likely due to fast typing.
 * @param snippet The snippet to be inserted.
 * @param errors The ranges in the source file within `target`
 * that represent malformed auxillary constructs in the matched completion.
 * If the trigger is pressed, the completion will fire according to the
 * portion of the completion that is well-formed.
 * @param insertAt If defined, is the position of the snippet to be inserted. Otherwise,
 * the snippet is inserted at the position of the cursor after the target is deleted.
 * @param newCursorPos The final position of the cursor after the snippet has been inserted.
 */
export class Completion {
    readonly preview: MarkdownString;
    readonly target: Range;
    readonly snippet: string;
    readonly errors?: Range[];
    readonly insertAt?: Position;
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
                    .map(
                        r =>
                            `[${r.start.line}:${r.start.character}-${r.end.line}:${r.end.character}]`,
                    )
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

/** Passed to {@link CompletionFamily.resolver}. */
export class CompletionContext<ScopeKind extends string> {
    readonly line: Tape;
    readonly cursor: Position;
    readonly editor: TextEditor;
    readonly scopeTree?: Scope<ScopeKind>[];

    constructor(
        curLine: Tape,
        cursor: Position,
        editor: TextEditor,
        scopeTree?: Scope<ScopeKind>[],
    ) {
        this.line = curLine;
        this.cursor = cursor;
        this.editor = editor;
        this.scopeTree = scopeTree;
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
