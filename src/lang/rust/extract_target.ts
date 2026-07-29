import { Tag, Token } from '../../languages'
import rustVocab from './language'

const STOP = ['EQUALS', 'COMMA', 'OPEN_CURLY', 'CLOSE_CURLY', 'SEMICOLON'].map(e =>
    rustVocab.tagForKind(e as Uppercase<string>)!,
)
const SIGIL = ['AND', 'ASTERISK', 'BANG', 'PLUS', 'MINUS'].map(e =>
    rustVocab.tagForKind(e as Uppercase<string>)!,
)

function skipBalanced(tokens: readonly Token[], begin: number, open: Tag, close: Tag): number {
    let depth = 0
    for (let idx = begin; idx < tokens.length; ++idx) {
        if (tokens[idx].tag === open) {
            depth += 1
        } else if (tokens[idx].tag === close) {
            depth -= 1
            if (depth === 0) {
                return idx
            }
        }
    }
    return tokens.length - 1
}

function skipBalancedReverse(
    tokens: readonly Token[],
    begin: number,
    open: Tag,
    close: Tag,
): number {
    let depth = 0
    for (let idx = begin; idx >= 0; --idx) {
        if (tokens[idx].tag === close) {
            depth += 1
        } else if (tokens[idx].tag === open) {
            depth -= 1
            if (depth === 0) {
                return idx
            }
        }
    }
    return 0
}

/**
 * Consumes a Rust type/path target from the current tape position.
 *
 * Handles:
 * - Paths and identifiers: `foo`, `foo::bar`, `foo::<T>`
 * - Balanced delimiters: `<T, U>`, `(A, B)`, `[T]`
 * - Chained access: `foo.bar`, `foo.0`
 * - Reversed tape (reads right-to-left, mirroring all delimiter logic)
 *
 * Stops before:
 * - Sigils that prefix a new target: `&`, `&mut`, `*`, `!`, `+`, `-`
 * - Separators and block openers: `=`, `,`, `{`, `}`, `;`
 * - Whitespace not followed by a path continuation (`::` or `<`)
 *
 * @todo Check for edge cases: `->` in fn pointers, lifetimes (`'a`), `impl`/`dyn` bounds
 */
export function extractTarget(docText: string, tokens: readonly Token[], begin: number): string {
    let idx = begin
    for (; idx < tokens.length; ++idx) {
        const tag = tokens[idx].tag
        if (STOP.includes(tag) || SIGIL.includes(tag)) {
            break
        }
        const close = rustVocab.matchingCloseTag(tag)
        if (close) {
            idx = skipBalanced(tokens, idx, tag, close)
            continue
        }
        if (rustVocab.matchingOpenTag(tag)) {
            // past the end of the target
            break
        }
    }
    return docText.slice(tokens[begin].begin, tokens[idx].begin)
}

export function extractRustTargetReversed(
    docText: string,
    tokens: readonly Token[],
    begin: number,
): string {
    let idx = begin
    for (; idx >= 0; --idx) {
        const tag = tokens[idx].tag
        if (STOP.includes(tag) || SIGIL.includes(tag)) {
            break
        }
        const open = rustVocab.matchingOpenTag(tag)
        if (open !== undefined) {
            idx = skipBalancedReverse(tokens, idx, open, tag)
            continue
        }
        if (rustVocab.matchingCloseTag(tag) !== undefined) {
            // past the start of the target
            break
        }
    }
    return docText.slice(tokens[idx].end, tokens[begin].end)
}
