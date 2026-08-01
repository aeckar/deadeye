//! Aggregation of exports to a single file evades circular dependency issues.
//!
//! Non-primitive objects should be frozen to enforce immutability at runtime.
export const CURLIES = Object.freeze(['OPEN_CURLY', 'CLOSE_CURLY'] as const)
export const ANGLES = Object.freeze(['OPEN_ANGLE', 'CLOSE_ANGLE'] as const)
export const PARENS = Object.freeze(['OPEN_PAREN', 'CLOSE_PAREN'] as const)
export const TRIVIA = Object.freeze(['LINE_COMMENT', 'BLOCK_COMMENT'] as const)
export const ALPHA = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
export const DIGIT = '0123456789'
export const EXTENSION_NAME = 'Deadeye'

export const CLOSE_BRACKETS: Readonly<Record<string, string>> = Object.freeze({
    '(': ')',
    '[': ']',
    '{': '}',
    '<': '>',
    '|': '|',
})

/** Codicon `$(chevron-right)` was considered as a replacement, but was too wide. */
export const BREADCRUMB_SEP = Object.freeze('\u276f')
