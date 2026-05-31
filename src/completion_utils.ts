import { MarkdownString, Position, Range, Selection, TextEditor } from 'vscode';



import Tape from './tape';
import { Brackets } from './utils';





















export const MAX_LINE_SEEK = 50;

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
 * @param scope The scope or nested scope required for this shorthand to match. Nested scopes
 * are not required to be adjacent; they must simply be present in the same order. If not provided,
 * this matches in all scopes.
 * @param exactScope If true, the entire scope stack must equal {@link Shorthand["scope"]|scope},
 * not just a part of it. If not provided, behaves as if it were `false`.
 */
export type Shorthand<K extends string> = {
    readonly docs: MarkdownString;
    readonly minLookbehind: number;
    readonly scope?: (K | `...${K}`)[][];
    readonly resolver: (ctx: CompletionContext) => Completion | undefined;
}; 

/**
 * The result of {@link Shorthand.resolver}.
 *
 * @param title A short description of what the completion of the shorthand does.
 * This is dynamically created to describe **exactly** how the code is modified. This contrasts
 * with {@link Shorthand.docs}, which is a general description of the shorthand or family of shorthands.
 * @param target The location of the actual shorthand, which is deleted.
 * most likely due to fast typing.
 * @param snippet The snippet to be inserted.
 * @param insertAt If defined, is the position of the snippet to be inserted. Otherwise,
 * the snippet is inserted at the position of the cursor after the target is deleted.
 * @param newCursorPos The final position of the cursor after the snippet has been inserted.
 */
export type Completion = {
    readonly title: MarkdownString | string;
    readonly target: Range;
    readonly snippet: string;
    readonly insertAt?: Position;
    readonly endCursorPos?: Position;
};

/**
 * A simplified completion, which always runs for a typed character sequence.
 *
 * For a given language, substitutions are todo
 *
 * @param title See {@link Completion.title}.
 * @param docs See {@link Shorthand.docs}.
 * @param target The character sequence to be matched.
 * @param snippet See {@link Completion.snippet}.
 */
export type Substitition = {
    readonly title: MarkdownString | string;
    readonly docs?: MarkdownString;
    readonly target: string;
    readonly snippet: string;
};

/**
 * Created and stored after a shorthand is matched, and recalled once the trigger is pressed.
 *
 * @param position the position of the cursor the instance this object was created.
 */
export type CompletionStrategy = {
    readonly shorthand: Shorthand<any>;
    readonly completion: Completion;
    readonly position: Position;
};

export type BracketType = 'curly' | 'square' | 'round' | 'angle';

/** Passed to {@link Shorthand.resolver}. */
export class CompletionContext {
    readonly line: Tape;
    readonly cursor: Position;
    readonly editor: TextEditor;

    constructor(curLine: Tape, cursor: Position, editor: TextEditor) {
        this.line = curLine;
        this.cursor = cursor;
        this.editor = editor;
    }

    /** Returns a tape moving left from the cursor over the current line. */
    leftOfCursor(): Tape {
        return this.line.before(this.cursor);
    }

    seekOpener(brackets: Brackets): Position | undefined {
        return this.seekOpenerRecursive(brackets, this.cursor, true);
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

    seekCloser(brackets: Brackets): Position | undefined {
        return this.seekCloserRecursive(brackets, this.cursor, true);
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
