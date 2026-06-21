//! General utilities related to text manipulation.
//!
//! For tokenization and language-specific functionality, refer to `language_utils.ts`.
import dedent from 'dedent-js';
import { MarkdownString } from 'vscode';

// ` = U+1FEF
/**
 * Returns a Markdown string, which can be used for documentation.
 *
 * This function should be used as a raw string prefix (e.g. `md`text``).
 */
export function toMarkdown(
    s: string | TemplateStringsArray,
    ...values: readonly any[]
): MarkdownString {
    return new MarkdownString(dedent(s, values));
}

/** Returns a copy of this string when reversed. */
export function reverse(s: string): string {
    return s.split('').reverse().join('');
}

/** Contains the possible chars for the first and subsequent characters in an identifier. */
export class IdentifierBounds {
    possibleStart: string;
    possiblePart: string;

    constructor(possibleStart: string, possiblePart: string) {
        this.possibleStart = possibleStart;
        this.possiblePart = possiblePart;
    }

    isStart(ch: string): boolean {
        return this.possibleStart.includes(ch);
    }

    isPart(ch: string): boolean {
        return this.possiblePart.includes(ch);
    }
}

export namespace IdentifierBounds {
    export const EXACT = new IdentifierBounds('', '');
}

/* ==================================== Scannerless Parsing ==================================== */

export type Brackets = (typeof BRACKETS)[number];
export type OpenBracket = (typeof OPEN_BRACKETS)[number];
export type CloseBracket = (typeof CLOSE_BRACKETS)[number];

export const BRACKETS = ['()', '{}', '[]', '<>'] as const;

/** Each element is analogous to that in `CLOSE_BRACKETS`. */
export const OPEN_BRACKETS = ['(', '{', '[', '<'] as const;

/** Each element is analogous to that in `OPEN_BRACKETS`. */
export const CLOSE_BRACKETS = [')', '}', ']', '>'] as const;

/**
 * Returns the appropriate closing bracket, or `undefined`
 * if the given character is not an opener.
 * @see getOpenBracket
 */
export function getCloseBracket(open: string): CloseBracket | undefined {
    const idx = OPEN_BRACKETS.indexOf(open as OpenBracket);
    if (idx === undefined) {
        return undefined;
    }
    return CLOSE_BRACKETS[idx];
}

/**
 * Returns the appropriate opening bracket, or `undefined`
 * if the given character is not a closer.
 *
 * @see getCloseBracket
 */
export function getOpenBracket(close: string): OpenBracket | undefined {
    const idx = CLOSE_BRACKETS.indexOf(close as CloseBracket);
    if (idx === undefined) {
        return undefined;
    }
    return OPEN_BRACKETS[idx];
}

/** Expands each tab stop (`$0`, `${1:C}) to a more descriptive form. */
export function expandTabStops(s: MarkdownString): MarkdownString {
    return new MarkdownString(
        s.value
            .replace('$0', '/* stop here */')
            .replace(/\$\{?(\d)(?::.*?\})?/, '/* placeholder $1 */'),
    );
}

/* ==================================== Diagnostics ==================================== */

/**
 * Returns the same string formatted in HTML as a distinct paragraph containing red text.
 * Prefixes the error message with `Error: `.
 *
 * # Implementation
 *
 * An attempt was made to pass the cause of errors to a property in `Completion`,
 * but the abstraction caused more work than it saved. Therefore, errors should be
 * constructed manually and listed at the end of the `preview` string.

 * @see warnHtml
 */
export function errorHtml(cause: string): string {
    return `<p><span style="color:#e06c75">Error: ${cause}</span></p>`;
}

/**
 * Returns the same string formatted in HTML as a distinct paragraph containing amber text.
 * Prefixes the warning message with `Warning: `.
 *
 * @see errorHtml
 */
export function warnHtml(cause: string): string {
    return `<p><span style="color:#e5a550">Warning: ${cause}</span></p>`;
}

/**
 * Returns the index of the first occurrence of `query`
 * that is not appended or prepended to a sequence of letters.
 */
export function findWord(s: string, query: string): number {
    if (!query) {
        return -1;
    }
    let index = s.indexOf(query);
    while (index !== -1) {
        let isMatch = true;

        // === Check boundary before match ===
        if (isLetter(query[0])) {
            const prevCharIndex = index - 1;
            if (prevCharIndex >= 0 && isLetter(s[prevCharIndex])) {
                isMatch = false;
            }
        }

        // === Check boundary after match ===
        if (isMatch && isLetter(query[query.length - 1])) {
            const nextCharIndex = index + query.length;
            if (nextCharIndex < s.length && isLetter(s[nextCharIndex])) {
                isMatch = false;
            }
        }

        if (isMatch) {
            return index;
        }

        // === Move past current index to find next occurrence ===
        index = s.indexOf(query, index + 1);
    }
    return -1;
}

/* ==================================== Letter Case ==================================== */

/** Concatenates the strings and applies PascalCase. */
export function toPascalCase(chunks: string[]): string {
    return chunks.map(capitalize).join('');
}

/** Concatenates the strings and applies SCREAMING_SNAKE_CASE. */
export function toScreamCase(chunks: string[]): string {
    return chunks.map(s => s.toUpperCase()).join('_');
}

/** Concatenates the strings and applies snake_case. */
export function toSnakeCase(chunks: string[]): string {
    return chunks.map(s => s.toLowerCase()).join('_');
}

/** Concatenates the strings and applies camelCase. */
export function toCamelCase(chunks: string[]): string {
    return chunks
        .map((s, idx) => (idx === 0 ? s.toLowerCase() : capitalize(s)))
        .join('');
}

/** Concatenates the strings and applies kebab-case. */
export function toKebabCase(chunks: string[]): string {
    return chunks.map(s => s.toLowerCase()).join('-');
}

/** Returns the same string with the first character capitalized. */
export function capitalize(s: string): string {
    if (!s) {
        return '';
    }
    return s[0].toUpperCase() + s.slice(1);
}

/** Returns true if the character is a digit. */
export function isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
}

/** Returns true if the character is an uppercase letter. */
export function isUpperLetter(ch: string): boolean {
    return ch >= 'A' && ch <= 'Z';
}

/** Returns true if the character is a lowercase letter. */
export function isLowerLetter(ch: string): boolean {
    return ch >= 'a' && ch <= 'z';
}

/** Returns true if the character is an uppercase or lowercase letter. */
export function isLetter(ch: string): boolean {
    return isLowerLetter(ch) || isUpperLetter(ch);
}
