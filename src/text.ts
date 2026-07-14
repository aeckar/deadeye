//! General utilities related to text manipulation.
//!
//! For tokenization and language-specific functionality, refer to `language_utils.ts`.
import dedent from 'dedent-js'
import { MarkdownString } from 'vscode'



// =============================================================================================
// Miscellaneous
// =============================================================================================

// ` = U+1FEF

/**
 * Returns a Markdown string, which can be used for documentation.
 *
 * This function should be used as a raw string prefix (e.g. `md`text``).
 */
export function md(
    s: string | TemplateStringsArray,
    ...values: readonly unknown[]
): MarkdownString {
    return new MarkdownString(dedent(s, values))
}

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
    return `<p><span style="color:#e06c75">Error: ${cause}</span></p>`
}

/**
 * Returns the same string formatted in HTML as a distinct paragraph containing amber text.
 * Prefixes the warning message with `Warning: `.
 *
 * @see errorHtml
 */
export function warnHtml(cause: string): string {
    return `<p><span style="color:#e5a550">Warning: ${cause}</span></p>`
}