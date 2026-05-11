import { Position, Range, TextEditor } from 'vscode';

import { Scope } from './scope_utils';
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

// todo Put cords in a separate file. Especially when you want to give hints before a trigger
/**
 * A flag for some shorthand, representing a single lowercase letter or symbol.
 *
 * Can represent a range of characters by prepending a '-' and declaring two characters.
 */
export type Flag = FlagChar | `-${FlagChar}${FlagChar}`;

/* todo doc 
docs are in markdown
name is resolved dynamically once completion is matched
requiretrigger: always true for language chords, toggle for motions, toggle for actions
scope: if not provided, scope doesnt matter (not total scope stack, just any combo, in order)
exactscope: defaults to false;; expects scope to be defined
*/
export type Completion<K extends string> = {
    docs: string;
    minLookbehind: number;
    scope?: K[];
    exactScope?: boolean;
    match: (ctx: CompletionContext) => Replacement | undefined;
};

/** todo doc */
export type Replacement = {
    name: string;
    target: Range;
    snippet: string;
    insertAt?: Position;
    newCursorPos?: Position;
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
