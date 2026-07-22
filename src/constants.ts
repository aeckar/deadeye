//! Aggregation of exports to a single file evades many module loading order issues.
export const SUPPORTED_LANGUAGES = ['rust'] as const
export const CURLIES = ['OPEN_CURLY', 'CLOSE_CURLY'] as const
export const PARENS = ['OPEN_PAREN', 'CLOSE_PAREN'] as const
export const ALPHA = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' as const
export const DIGIT = '0123456789' as const

/** Codicon `$(chevron-right)` was considered as a replacement, but was deemed too wide. */
export const BREADCRUMB_SEP = '\u276f' as const

export const MAX_TOKEN_SEEK = 50
export const MAX_LINE_SEEK = 50
export const MAX_CHAR_SEEK = 2500