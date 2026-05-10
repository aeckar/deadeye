//! General utilities.

export type NonEmptyString = `${any}${string}`;

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
