//! Miscellaneous utilities.
import * as vscode from 'vscode';

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

export type NonEmptyString = `${any}${string}`;

/**
 * Displacement of the cursor.
 *
 * If any property is omitted, it is interpreted as being 0.
 */
export type Displacement = {
    line?: number;
    char?: number;
};

export type Replacement = {
    target: vscode.Range;
    snippet: string;
    displacement?: Displacement;
};

export function pascal(chunks: string[]): string {
    return chunks.map(capitalize).join('');
}

export function scream(chunks: string[]): string {
    return chunks.map(s => s.toUpperCase()).join('_');
}

export function snake(chunks: string[]): string {
    return chunks.map(s => s.toLowerCase()).join('_');
}

export function camel(chunks: string[]): string {
    return chunks
        .map((s, idx) => (idx === 0 ? s.toLowerCase() : capitalize(s)))
        .join('');
}

export function kebab(chunks: string[]): string {
    return chunks.map(s => s.toLowerCase()).join('-');
}

export function capitalize(s: string): string {
    if (!s) {
        return '';
    }
    return s[0].toUpperCase() + s.slice(1);
}

export function isUpperLetter(ch: string): boolean {
    return ch >= 'A' && ch <= 'Z';
}

export function isLowerLetter(ch: string): boolean {
    return ch >= 'a' && ch <= 'z';
}

export function isLetter(ch: string): boolean {
    return isLowerLetter(ch) || isUpperLetter(ch);
}
