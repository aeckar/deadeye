import * as vscode from 'vscode';

type FormatterRegistry = {
    [key: string]: (chunks: string[]) => string;
};

function capitalize(s: string): string {
    if (!s) {
        return '';
    }
    return s[0].toUpperCase() + s.slice(1);
}

export type Replacement = {
    target: vscode.Range;
    snippet: string;
};

export type Letter =
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
export type Flag = Letter | `-${Letter}${Letter}`;

export type NonEmptyString = `${any}${string}`;

export const format: FormatterRegistry = {
    pascal: chunks => chunks.map(capitalize).join(''),
    scream: chunks => chunks.map(s => s.toUpperCase()).join('_'),
    snake: chunks => chunks.map(s => s.toLowerCase).join('_'),
    camel: chunks =>
        chunks
            .map((s, idx) => (idx === 0 ? s.toLowerCase() : capitalize(s)))
            .join(''),
    kebab: chunks => chunks.map(s => s.toLowerCase()).join(''),
};

export function isUpperLetter(ch: string): boolean {
    return ch >= 'A' && ch <= 'Z';
}

export function isLowerLetter(ch: string): boolean {
    return ch >= 'a' && ch <= 'z';
}

export function isLetter(ch: string): boolean {
    return isLowerLetter(ch) || isUpperLetter(ch);
}
