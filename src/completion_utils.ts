import { Position } from "vscode";

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

/** todo doc */
export type Replacement = {
    target: Range;
    snippet: string;
    insertAt?: Position;
    newCursorPos?: Position;
};
