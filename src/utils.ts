export type Replacement = {
    length: number;
    snippet: string;
};

type FormatterRegistry = {
    [key: string]: (chunks: string[]) => string;
};

function capitalize(s: string): string {
    if (!s) {
        return '';
    }
    return s[0].toUpperCase() + s.slice(1);
}

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
