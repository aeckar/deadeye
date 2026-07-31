import { IdRule, Language } from '@/api/language_api'
import Tape from '@/tape'

/**
 * Keywords that cannot be used as variable/type names,
 * but can be property names (e.g., `obj.for`).
 */
const STRICT_KEYWORDS = [
    'break',
    'case',
    'catch',
    'class',
    'const',
    'continue',
    'debugger',
    'default',
    'delete',
    'do',
    'else',
    'enum',
    'export',
    'extends',
    'false',
    'finally',
    'for',
    'function',
    'if',
    'import',
    'in',
    'instanceof',
    'let',
    'new',
    'null',
    'return',
    'super',
    'switch',
    'this',
    'throw',
    'true',
    'try',
    'typeof',
    'var',
    'void',
    'while',
    'with',
    'yield',
]

/**
 * Keywords that are recognized as such in declarative contexts,
 * but can be variable/type/property names
 */
const SOFT_KEYWORDS = [
    'abstract',
    'as',
    'async',
    'await',
    'declare',
    'get',
    'implements',
    'interface',
    'is',
    'keyof',
    'module',
    'namespace',
    'override',
    'private',
    'protected',
    'public',
    'readonly',
    'satisfies',
    'set',
    'type',
    'unknown',
]

/**
 * Checks if the identifier is being accessed as a member (`.` or `?.`),
 * demoting any keyword (strict or soft) into an identifier.
 */
function isMemberAccess(tape: Tape): boolean {
    const start = tape.pos
    if (!tape.seekBack(Tape.isWs)) {
        return false
    }
    const res = tape.cur() === '.'
    tape.pos = start
    return res
}

/** Checks if a word boundary exists immediately following the target word. */
function hasWordBoundary(tape: Tape, word: string): boolean {
    const nextChar = tape.raw[tape.pos + word.length]
    return nextChar === undefined || !/[a-zA-Z0-9_$]/.test(nextChar)
}

/** Matches the keyword unless it is a member of being accessed. */
function newStrictKeywordMatcher(keyword: string): (tape: Tape) => string {
    return (tape: Tape) => {
        if (!tape.isAt(keyword) || !hasWordBoundary(tape, keyword)) {
            return ''
        }
        if (isMemberAccess(tape)) {
            return '' // demote to identifier
        }
        return tape.consumeAt(keyword)
    }
}

const BOUNDARY_SYMBOLS = [';', '{', '}', ',', '(', '=>', ':', '='] as const

/**
 * Matches the keyword for all of the following:
 *
 * - Not a member access
 * - Preceded by expression/statement boundaries.
 */
function newSoftKeywordMatcher(keyword: string): (tape: Tape) => string {
    return (tape: Tape) => {
        if (!tape.isAt(keyword) || !hasWordBoundary(tape, keyword)) {
            return ''
        }
        if (isMemberAccess(tape)) {
            return '' // demote to identifier
        }

        //todo FIX THIS AI SLOP
        // Lookbehind to check context
        let i = tape.pos - 1
        while (i >= 0 && Tape.isWs(tape.raw[i])) {
            i -= 1
        }

        // Start of source or structural boundary indicates true contextual keyword position
        if (i < 0) {
            return tape.consumeAt(keyword)
        }

        for (const sym of BOUNDARY_SYMBOLS) {
            if (tape.raw.startsWith(sym, i - sym.length + 1)) {
                return tape.consumeAt(keyword)
            }
        }

        return '' // demote to identifier
    }
}

const declareKeywords: Record<string, (tape: Tape) => string> = {}

{
    for (const kword of STRICT_KEYWORDS) {
        declareKeywords[kword.toUpperCase()] = newStrictKeywordMatcher(kword)
    }
    for (const kword of SOFT_KEYWORDS) {
        declareKeywords[kword.toUpperCase()] = newSoftKeywordMatcher(kword)
    }
}

export const tsLanguage = Language.newInstance({
    $idRule: [IdRule.resolve('C_LIKE').startPool + '$', IdRule.resolve('C_LIKE').partPool + '$'],
    $ignore: /\s*/y,
    declare: {
        ...declareKeywords,

        FAT_ARROW: '=>',
        OPTIONAL_CHAIN: '?.',
        NULLISH_COALESCING: '??',
        SPREAD_OR_REST: '...',
        QMARK: '?',
        COLON: ':',
        SEMICOLON: ';',
        COMMA: ',',
        DOT: '.',
        AT: '@',
        LINE_COMMENT: /\/\/.*/y,
        STRING_SINGLE: /'(?:[^'\\]|\\.)*'/y,
        STRING_DOUBLE: /"(?:[^"\\]|\\.)*"/y,
        NUMBER: /(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|[0-9_]+(?:\.[0-9_]+)?(?:[eE][-+]?[0-9_]+)?n?)/y,
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
    ],
})

export default tsLanguage
