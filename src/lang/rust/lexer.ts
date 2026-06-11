import { map, sortBy } from '../../misc';
import Tape from '../../tape';
import { Token, Vocabulary } from '../lexer_utils';

export const KEYWORD_LIST = [
    // Strict Keywords
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
    'Self',
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
    'macro_rules!',

    // Reserved Keywords
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

    // Contextual Keywords
    'union', // must be followed by open brace
] as const;

export const KEYWORD_SET = new Set(KEYWORD_LIST);

export type Keyword = (typeof KEYWORD_LIST)[number];

// assume post-2018 rust: dyn is STRICT KWORD
//Rust quirk: block comments can be nested.

export type RustTokenKind = 'ROOT' | Keyword | '';

export const SYMBOLS = Vocabulary.newInstance(
    {
        // === Punctuation & Arrows ===
        FAT_ARROW: '=>',
        THIN_ARROW: '->',
        PATH_SEP: '::',
        EQUALS: '=',
        COLON: ':',
        DOT: '.',
        COMMA: ',',
        SEMICOLON: ';',
        QMARK: '?',

        // === Basic Arithmetic ===
        PLUS: '+',
        MINUS: '-',
        ASTERISK: '*',
        SLASH: '/',
        PERCENT: '%',

        // === Compound Assignment ===
        PLUS_ASSIGN: '+=',
        MINUS_ASSIGN: '-=',
        MULT_ASSIGN: '*=',
        DIV_ASSIGN: '/=',
        REM_ASSIGN: '%=',
        AND_ASSIGN: '&=',
        OR_ASSIGN: '|=',
        XOR_ASSIGN: '^=',
        SHL_ASSIGN: '<<=',
        SHR_ASSIGN: '>>=',

        // === Comparison & Logic ===
        EQ_EQ: '==',
        NOT_EQ: '!=',
        LE: '<=',
        GE: '>=',
        AND_AND: '&&',
        OR_OR: '||',
        NOT: '!',
        LESS: '<',
        GREATER: '>',

        // === Bitwise & Ranges ===
        AND: '&',
        OR: '|',
        XOR: '^',
        SHL: '<<',
        SHR: '>>',
        OPEN_PAR: '(',  // bruh
        RANGE_INCL: '..=',
        RANGE: '..',
    },
    Vocabulary.BRACKETS,// todo group c-like operators
);

export default function tokenize(file: Tape): Token<RustTokenKind> {
    let node = Token.root();
    for (const kword in KEYWORD_LIST) {
        if (file.isAtWord(kword)) {
            node = node.append(kword);
            file.pos += kword.length;
            break;
        }
    }

    //return tail
}
