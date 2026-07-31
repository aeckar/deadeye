import { Token, UnknownTokenKind } from '@/api/language_api'
import rustLanguage from './language'

// Must defer these due to circular dependency!
// @\services\language_info_service -> @\api\completion_api -> @\services\document_info_service
let STOP: number[] | undefined
let SIGIL: number[] | undefined

function getStopTokens(): number[] {
    return (STOP ??= ['EQUALS', 'COMMA', 'OPEN_CURLY', 'CLOSE_CURLY', 'SEMICOLON'].map(e =>
        rustLanguage.tagForKind(e as UnknownTokenKind)!,
    ))
}

function getSigilTokens(): number[] {
    return (SIGIL ??= ['AND', 'ASTERISK', 'BANG', 'PLUS', 'MINUS'].map(e =>
        rustLanguage.tagForKind(e as UnknownTokenKind)!,
    ))
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
    while (idx < tokens.length) {
        const tok = tokens[idx]
        if (getStopTokens().includes(tok.tag) || getSigilTokens().includes(tok.tag)) {
            break
        }
        if (tok.isOpenBracket()) {
            idx = tok.findCloseBracket(tokens, idx + 1)
            idx += 1
            continue
        }
        if (tok.isCloseBracket()) {
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
    while (idx >= 0) {
        const tok = tokens[idx]
        if (getStopTokens().includes(tok.tag) || getSigilTokens().includes(tok.tag)) {
            break
        }
        if (tok.isCloseBracket()) {
            idx = tok.findOpenBracket(tokens, idx - 1)
            idx -= 1
            continue
        }
        if (tok.isOpenBracket()) {
            // past the start of the target
            break
        }
    }
    return docText.slice(tokens[idx].end, tokens[begin].end)
}
