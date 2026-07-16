import { Tag, Token } from '../../languages'
import rustLanguage from './language'

const STOP = ['EQUALS', 'COMMA', 'OPEN_CURLY', 'CLOSE_CURLY', 'SEMICOLON'].map(
    e => rustLanguage.tagForKind(e)!,
)
const SIGIL = ['AND', 'ASTERISK', 'BANG', 'PLUS', 'MINUS'].map(e =>
    rustLanguage.tagForKind(e)!,
)

function skipBalanced(begin: Token, open: Tag, close: Tag): [Token, number] {
    let node = begin
    let depth = 0
    let length = 0
    while (!node.isTail) {
        length += node.length
        if (node.tag === open) {
            depth += 1
        } else if (node.tag === close) {
            depth -= 1
            if (depth === 0) {
                break
            }
        }
        node = node.next
    }
    return [node, length]
}

function skipBalancedReverse(
    begin: Token,
    open: Tag,
    close: Tag,
): [Token, number] {
    let node = begin
    let depth = 0
    let length = 0
    while (!node.isHead) {
        length += node.length
        if (node.tag === close) {
            depth += 1
        } else if (node.tag === open) {
            depth -= 1
            if (depth === 0) {
                break
            }
        }
        node = node.prev
    }
    return [node, length]
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
export function extractRustTarget(docText: string, begin: Token): string {
    let node = begin.next
    let length = 0
    while (!node.isTail) {
        const tag = node.tag
        if (STOP.includes(tag) || SIGIL.includes(tag)) {
            break
        }
        const close = rustLanguage.matchingCloseTag(tag)
        if (close !== undefined) {
            const [next, n] = skipBalanced(node, tag, close)
            length += n
            node = next.isTail ? next : next.next
            continue
        }
        if (rustLanguage.matchingOpenTag(tag) !== undefined) {
            // past the end of the target
            break
        }
        length += node.length
        node = node.next
    }
    
    return docText.slice(begin.end, begin.end + length)
}

export function extractRustTargetReversed(docText: string, begin: Token): string {
    let node = begin.prev
    let length = 0
    while (!node.isHead) {
        const tag = node.tag
        if (STOP.includes(tag) || SIGIL.includes(tag)) {
            break
        }
        const open = rustLanguage.matchingOpenTag(tag)
        if (open !== undefined) {
            const [prev, n] = skipBalancedReverse(node, open, tag)
            length += n
            node = prev.isHead ? prev : prev.prev
            continue
        }
        if (rustLanguage.matchingCloseTag(tag) !== undefined) {
            // past the start of the target
            break
        }
        length += node.length
        node = node.prev
    }
    return docText.slice(begin.begin - length, begin.begin)
}
