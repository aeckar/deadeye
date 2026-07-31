//! Aggregation of exports to a single file evades many module loading order issues.
export const CURLIES = ['OPEN_CURLY', 'CLOSE_CURLY'] as const
export const PARENS = ['OPEN_PAREN', 'CLOSE_PAREN'] as const
export const ALPHA = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' as const
export const DIGIT = '0123456789' as const

export const CLOSE_BRACKETS: Record<string, string> = {
    '(': ')',
    '[': ']',
    '{': '}',
    '<': '>',
    '|': '|',
}

/** Codicon `$(chevron-right)` was considered as a replacement, but was too wide. */
export const BREADCRUMB_SEP = '\u276f' as const