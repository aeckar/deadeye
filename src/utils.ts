//! General utilities.
import dedent from 'dedent-js';
import { MarkdownString, Position, Range } from 'vscode';

export type NonEmptyString = `${any}${string}`;

const BRACKETS = ['()', '{}', '[]', '<>'] as const;
export type Brackets = (typeof BRACKETS)[number];


export function findWord(s: string, query: NonEmptyString): number {
    if (!query) {
        return -1;
    }
    let index = s.indexOf(query);
    while (index !== -1) {
        let isMatch = true;

        // Check boundary before match
        if (isLetter(query[0])) {
            const prevCharIndex = index - 1;
            if (prevCharIndex >= 0 && isLetter(s[prevCharIndex])) {
                isMatch = false;
            }
        }

        // Check boundary after match
        if (isMatch && isLetter(query[query.length - 1])) {
            const nextCharIndex = index + query.length;
            if (nextCharIndex < s.length && isLetter(s[nextCharIndex])) {
                isMatch = false;
            }
        }

        if (isMatch) {
            return index;
        }

        // Move past current index to find next occurrence
        index = s.indexOf(query, index + 1);
    }
    return -1;
}

export function rangeBefore(cursor: Position, from: number = cursor.character): Range {
    return new Range(
        new Position(cursor.line, cursor.character - from),
        new Position(cursor.line, cursor.character),
    );
}

export function after(cursor: Position, skip: number = 0): Position {
    return new Position(cursor.line, cursor.character + skip + 1);
}

export function markdown(s: string | TemplateStringsArray, ...values: any[]): MarkdownString {
    return new MarkdownString(dedent(s, values));
}

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
