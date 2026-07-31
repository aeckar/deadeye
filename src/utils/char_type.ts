import { Range } from 'vscode'

export type FlagChar =
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
    | '!'

/**
 * A flag for some shorthand, representing a single lowercase letter or symbol.
 *
 * Can represent a range of characters by prepending a '-' and declaring two characters.
 */
export type Flag = FlagChar | `-${FlagChar}${FlagChar}`

/** Returned as values in the map returned by `Tape.consumeFlags`. */
export type FlagMatch = {
    readonly expansion: string
    readonly range: Range
}

/**
 * The key used to trigger a completion.
 *
 * Triggers are not considered part of a completion, and this is helpful
 * because it allows the completion itself to be highlighted and show suggestions before
 * being fired.
 *
 * If provided, a trigger must take the form of either:
 * - ` `
 * - `;`
 * - [ENTER]
 *
 * An empty string means there is no set trigger key,
 * and the completion will fire as soon as it is matched.
 */
export type Trigger = '' | ' ' | ';' | '.' | 'enter'

/** Concatenates the strings and applies PascalCase. */
export function toPascalCase(chunks: string[]): string {
    return chunks.map(capitalize).join('')
}

/** Concatenates the strings and applies SCREAMING_SNAKE_CASE. */
export function toScreamCase(chunks: string[]): string {
    return chunks.map(s => s.toUpperCase()).join('_')
}

/** Concatenates the strings and applies snake_case. */
export function toSnakeCase(chunks: string[]): string {
    return chunks.map(s => s.toLowerCase()).join('_')
}

/** Concatenates the strings and applies camelCase. */
export function toCamelCase(chunks: string[]): string {
    return chunks.map((s, idx) => (idx === 0 ? s.toLowerCase() : capitalize(s))).join('')
}

/** Concatenates the strings and applies kebab-case. */
export function toKebabCase(chunks: string[]): string {
    return chunks.map(s => s.toLowerCase()).join('-')
}

/** Returns the same string with the first character capitalized. */
export function capitalize(s: string): string {
    if (!s) {
        return ''
    }
    return s[0].toUpperCase() + s.slice(1)
}

/** Returns true if the character is a digit. */
export function isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9'
}

/** Returns true if the character is an uppercase letter. */
export function isUpperLetter(ch: string): boolean {
    return ch >= 'A' && ch <= 'Z'
}

/** Returns true if the character is a lowercase letter. */
export function isLowerLetter(ch: string): boolean {
    return ch >= 'a' && ch <= 'z'
}

/** Returns true if the character is an uppercase or lowercase letter. */
export function isLetter(ch: string): boolean {
    return isLowerLetter(ch) || isUpperLetter(ch)
}
