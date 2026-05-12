import {
    MarkdownString as Markdown,
    Position,
    Range,
    TextEditor,
} from 'vscode';

import Tape from './tape';

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
 * of characters for the base case.
 * @param scope A 
 * @param exactScope
 *
requiretrigger: always true for language chords, toggle for motions, toggle for actions
scope: if not provided, scope doesnt matter (not total scope stack, just any combo, in order)
exactscope: defaults to false;; expects scope to be defined
 */
export type Shorthand<K extends string> = {
    docs: Markdown;
    minLookbehind: number;
    scope?: K[];
    exactScope?: boolean;
    match: (ctx: CompletionContext) => Completion | undefined;
};

/**
 * todo
 */
export type Completion = {
    shortDescription: string;
    target: Range;
    snippet: string;
    insertAt?: Position;
    newCursorPos?: Position;
};

/**
 * todo
 */
export type Substitition = {
    shortDescription: string;
    docs: Markdown;
    shorthand: string;
    snippet: string;
};

export class CompletionContext {
    line: Tape;
    cursor: Position;
    editor: TextEditor;

    constructor(curLine: Tape, cursor: Position, editor: TextEditor) {
        this.line = curLine;
        this.cursor = cursor;
        this.editor = editor;
    }

    downFromCursor(): Tape {
        return this.line.before(this.cursor);
    }

    findPrecedingClosingBrace(): Position | undefined {
        let braceDepth = 0;
        for (let i = this.cursor.line; i >= 0; i--) {
            const text = this.editor.document.lineAt(i).text;
            const end =
                i === this.cursor.line ? this.cursor.character : text.length;

            for (let j = end - 1; j >= 0; j--) {
                const ch = text[j];
                if (ch === '}') {
                    if (braceDepth === 0) {
                        return new Position(i, j + 1);
                    }
                    braceDepth++;
                } else if (ch === '{') {
                    braceDepth--;
                }
            }
        }
        return undefined;
    }
}
