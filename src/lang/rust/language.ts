import { isLetter } from '../../completions'
import { IdRule, Language } from '../../languages'
import Tape from '../../tape'

// Shared nesting state for `|params|` — a single depth flag is sufficient because
// Rust's grammar never lets one closure's parameter list contain another bare `|`
// (closure *types* in signatures use `Fn(..) -> ..`, not sigil form).
export const { openClosureParams, closeClosureParams } = (() => {
    let depth = 0

    // Heuristic: tokens/keywords after which `|` starts a new expression
    // (and therefore opens params) rather than continuing one as bitwise-or.
    const EXPR_START_SYMBOLS = ['=>', '&&', '||', '=', '(', ',', '{', ';', ':'] as const
    const EXPR_START_KEYWORDS = ['return', 'move'] as const

    function expectsExpr(tape: Tape): boolean {
        let i = tape.pos - 1
        while (i >= 0 && Tape.isWs(tape.raw[i])) {
            i -= 1
        }
        if (i < 0) {
            // start of source
            return true
        }
        for (const sym of EXPR_START_SYMBOLS) {
            if (tape.raw.startsWith(sym, i - sym.length + 1)) {
                return true
            }
        }
        for (const kword of EXPR_START_KEYWORDS) {
            const kwordStart = i - kword.length + 1
            if (kwordStart >= 0 && tape.raw.startsWith(kword, kwordStart)) {
                const before = tape.raw[kwordStart - 1]
                if (before === undefined || !isLetter(before)) {
                    return true
                }
            }
        }
        return false
    }

    // Excludes `||` (empty-param closure / bool-or, handled elsewhere) and `|=`.
    function isBarePipe(tape: Tape): boolean {
        return tape.isAt('|') && !tape.isAt('||') && !tape.isAt('|=')
    }

    return {
        openClosureParams(tape: Tape): string {
            if (tape.pos === 0) {
                // reset for each fresh tokenize() pass
                depth = 0
            }
            if (depth > 0 || !isBarePipe(tape) || !expectsExpr(tape)) {
                return ''
            }
            depth += 1
            return tape.consumeAt('|')
        },
        closeClosureParams(tape: Tape): string {
            if (depth === 0 || !isBarePipe(tape)) {
                return ''
            }
            depth -= 1
            return tape.consumeAt('|')
        },
    }
})()

/**
 * Nesting-aware block comment.
 *
 * Rust nests `／* *／`, unlike C.
 */
// ／ = U+FF0F
export function blockComment(tape: Tape): string {
    if (!tape.isAt('/*')) {
        return ''
    }
    const start = tape.pos
    tape.pos += 2
    let depth = 1
    while (depth > 0 && !tape.isExhausted()) {
        if (tape.isAt('/*')) {
            depth += 1
            tape.pos += 2
        } else if (tape.isAt('*/')) {
            depth -= 1
            tape.pos += 2
        } else {
            tape.adv()
        }
    }

    // Unterminated: consume to EOF rather than fail, so recovery doesn't
    // re-tokenize whatever's inside the dangling comment as code.
    return tape.raw.slice(start, tape.pos)
}

export const rustLanguage = Language.newInstance({
    $idRule: [
        IdRule.resolve('C_LIKE').startPool,
        IdRule.resolve('C_LIKE').partPool + '#', // `#` for raw identifiers
    ],
    $ignore: /\s*/y,
    keywords: [
        'as',
        'async',
        'await',
        'break',
        'const',
        'continue',
        'crate',
        'dyn',
        'else',
        'enum',
        'extern',
        'false',
        'fn',
        'for',
        'if',
        'impl',
        'in',
        'let',
        'loop',
        'match',
        'mod',
        'move',
        'mut',
        'pub',
        'ref',
        'return',
        'self',
        'static',
        'struct',
        'super',
        'trait',
        'true',
        'type',
        'unsafe',
        'use',
        'where',
        'while',
        'abstract',
        'become',
        'box',
        'do',
        'final',
        'macro',
        'override',
        'priv',
        'try',
        'typeof',
        'unsized',
        'virtual',
        'yield',
        'union',
    ],
    declare: {
        SELF_TY: 'Self',
        MACRO_RULES: 'macro_rules!',
        FAT_ARROW: '=>',
        THIN_ARROW: '->',
        PATH_SEP: '::',
        QMARK: '?',
        RANGE_INCL: '..=',
        RANGE: '..',
        FLOAT: /[0-9_]+\.[0-9_]+(?:[eE][-+]?[0-9_]+)?(?:f(?:16|32|64|128))?|[0-9_]+[eE][-+]?[0-9_]+(?:f(?:16|32|64|128))?/y,
        LIFETIME: /'[a-zA-Z_][a-zA-Z0-9_]*(?!')/y,
        RAW_IDENT: /r#[a-zA-Z_][a-zA-Z0-9_]*/y,
        DOLLAR: '$',
        LINE_COMMENT: /\/\/.*/y,
        // Patterns safely bypass escaped interior quotes, \" and \'
        STRING: /"(?:[^"\\]|\\.)*"/y,
        BYTE_STRING: /b"(?:[^"\\]|\\.)*"/y,
        BYTE_CHAR: /b'(?:[^'\\]|\\.)'/y,

        // Raw strings: r"...", r#"..."#, r##"..."##, and their byte-string forms.
        // Backreference to `#{1,}` isn't possible in a single sticky regex,
        // so this caps at a reasonable number of `#` fences (adjust if you need more).
        RAW_STRING: /r#{0,8}"[\s\S]*?"#{0,8}/y,
        RAW_BYTE_STRING: /r?b#{0,8}"[\s\S]*?"#{0,8}/y,

        // Hex/Binary/Octal checked BEFORE base-10 to prevent early '0' cutoff
        INTEGER: /(?:0x[0-9a-fA-F_]+|0b[01_]+|0o[0-7_]+|[0-9_]+)(?:[iu](?:8|16|32|64|128))?/y,

        OPEN_CLOSURE_PARAMS: openClosureParams,
        CLOSE_CLOSURE_PARAMS: closeClosureParams,
        BLOCK_COMMENT: blockComment,
    },
    inherit: [
        'BRACKETS',
        'ARITH_ASSIGN',
        'REM_ASSIGN',
        'BIT_OPS_ASSIGN',
        'BOOL_LOGIC',
        'C_COMMENTS',
        'C_PUNCT',
        'C_ID',
        'C_CHAR',
    ],
})

export default rustLanguage
