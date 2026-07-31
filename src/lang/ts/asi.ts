import { Token, TokenKind } from '@/api/language_api'
import tsLanguage from './language'
import { AsiResolver } from '@/services/language_info_service'

type BraceRole = 'block' | 'object'

const STATEMENT_END_KINDS = new Set([
    // __C_ID
    'ID',

    // tsLanguage
    'NUMBER',
    'STRING_SINGLE',
    'STRING_DOUBLE',

    // __C_PUNT
    'CLOSE_PAREN',
    'CLOSE_BRAC',
    'CLOSE_CURLY',

    // __BOOL_LOGIC
    'TRUE',
    'FALSE',

    // STRICT_KEYWORDS
    'NULL',
    'THIS',
    'SUPER',
    'RETURN',
    'THROW',
    'BREAK',
    'CONTINUE',
    'YIELD',
])

const CONTINUATION_KINDS = new Set([
    // Member/call/index access
    'DOT',
    'OPTIONAL_CHAIN',
    'OPEN_PAREN',
    'OPEN_BRAC',

    // Binary/logical/bitwise operators (__ARITH, __BIT_OPS, __BOOL_LOGIC)
    'PLUS',
    'MINUS',
    'ASTERISK',
    'SLASH',
    'REM',
    'AND',
    'OR',
    'XOR',
    'SHL',
    'SHR',
    'AND_AND',
    'OR_OR',
    'EQ_EQ',
    'NOT_EQ',
    'LE',
    'GE',
    'OPEN_ANGLE',
    'CLOSE_ANGLE',

    // Assignment operators (__ARITH_ASSIGN, __REM_ASSIGN, __BIT_OPS_ASSIGN, __C_PUNCT)
    'EQUALS',
    'PLUS_ASSIGN',
    'MINUS_ASSIGN',
    'MULT_ASSIGN',
    'DIV_ASSIGN',
    'REM_ASSIGN',
    'AND_ASSIGN',
    'OR_ASSIGN',
    'XOR_ASSIGN',
    'SHL_ASSIGN',
    'SHR_ASSIGN',

    // TS-specific (tsLanguage)
    'FAT_ARROW',
    'QMARK',
    'COLON',
    'COMMA',
    'NULLISH_COALESCING',
    'SPREAD_OR_REST',
])

/** What can precede `{` such that it's an object literal, not a block. */
const OBJECT_PRECEDING_KINDS = new Set([
    'EQUALS',
    'OPEN_PAREN',
    'OPEN_BRAC',
    'COMMA',
    'COLON',
    'RETURN',
    'TYPEOF',
    'IN',
    'SPREAD_OR_REST',
    'PLUS',
    'MINUS',
    'ASTERISK',
    'SLASH',
    'REM',
    'AND_AND',
    'OR_OR',
    'BANG',
    'FAT_ARROW', // `() => ({...})` still has parens, but `x.map(v => ({...}))`
])

function braceRole(prevKind: string | undefined): BraceRole {
    if (prevKind === undefined) return 'block' // start of file/statement list
    if (OBJECT_PRECEDING_KINDS.has(prevKind)) return 'object'
    return 'block'
}

/**
 * Checks for a newline in the given range without instantiating an intermediate string.
 *
 * Assumes `end` is less than or equal to `text.length`.
 */
function hasNewlineBetween(text: string, start: number, end: number): boolean {
    for (let idx = start; idx < end; ++idx) {
        if (text[idx] === '\n') {
            return true
        }
    }
    return false
}

const tsAsi: AsiResolver = (text, tokens) => {
    const out: Token[] = []
    const braceStack: BraceRole[] = []
    for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i]
        if (tok.kind === 'OPEN_CURLY') {
            const prev = out[out.length - 1]
            braceStack.push(braceRole(prev?.kind))
        }
        out.push(tok)
        const next = tokens[i + 1]
        if (tok.kind === 'CLOSE_CURLY') {
            braceStack.pop()
        }
        const semicolon = 'SEMICOLON' as TokenKind
        const tag = tsLanguage.tagForKind(semicolon)!
        if (tok.kind === semicolon) {
            continue
        }
        if (!next) {
            if (STATEMENT_END_KINDS.has(tok.kind)) {
                out.push(Token.newInstance(tok.end, 0, tag, semicolon))
            }
            continue
        }
        if (next.kind === semicolon) {
            continue
        }
        const nl = hasNewlineBetween(text, tok.end, next.begin)
        if (['RETURN', 'THROW', 'BREAK', 'CONTINUE', 'YIELD'].includes(tok.kind) && nl) {
            out.push(Token.newInstance(tok.end, 0, tag, semicolon))
            continue
        }
        if (nl && (next.kind === 'INC' || next.kind === 'DEC')) {
            out.push(Token.newInstance(tok.end, 0, tag, semicolon))
            continue
        }
        // `}` closing an actual block always ends the statement before it, newline or not
        if (
            next.kind === 'CLOSE_CURLY' &&
            braceStack[braceStack.length - 1] === 'block' &&
            STATEMENT_END_KINDS.has(tok.kind)
        ) {
            out.push(Token.newInstance(tok.end, 0, tag, semicolon))
            continue
        }
        if (nl && STATEMENT_END_KINDS.has(tok.kind) && !CONTINUATION_KINDS.has(next.kind)) {
            out.push(Token.newInstance(tok.end, 0, tag, semicolon))
        }
    }
    return out
}

export default tsAsi
