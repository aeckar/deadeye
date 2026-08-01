//! General utilities related to text manipulation.
//!
//! For tokenization and language-specific functionality, refer to `language_utils.ts`.
import dedent from 'dedent-js'
import { MarkdownString } from 'vscode'
import { INDENT_SIZE } from '@/utils/constants'

/**
 * Returns a Markdown string, which can be used for documentation.
 *
 * This function should be used as a raw string prefix (e.g. `md`text``).
 */
// ` = U+1FEF
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
 *
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

/**
 * Returns the name of the caller function.
 *
 * Creates a stack trace on every invocation, so this function should only be used
 * when the log level is `Debug` or `Trace`.
 */
export function getCallerName(): string {
    try {
        throw new Error()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        const stackLines = e.stack.split('\n')

        // 0: error message
        // 1: current function (getCallerName)
        // 2: function that called `getCallerName`
        // 3: the function that called caller
        const callerLine = stackLines[3]

        // Regex extracts the function name from the stack frame format
        const match = callerLine.match(/at\s+([^\s(]+)/)

        return match ? match[1] : 'anonymous'
    }
}

/**
 * Returns a pretty-printed string of the given array.
 * The returned string is printed on a new line if not empty.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function beautify(arr: any[]): string {
    const indent = ' '.repeat(INDENT_SIZE)
    if (arr.length === 0) {
        return '[]'
    }
    if (arr.length === 1) {
        return `[${arr[0]}]`
    }
    const pretty = arr.map(e => `${indent}${e.toString()}`).join('\n')
    return `\n[\n${pretty}\n]\n`
}
