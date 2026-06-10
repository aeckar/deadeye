import { Span } from '../../misc';
import Tape from '../../tape';

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

export const KEYWORDS = new Set(KEYWORD_LIST);

export type Keyword = (typeof KEYWORD_LIST)[number];

// assume post-2018 rust: dyn is STRICT KWORD

export type TokenKind = Keyword | '';

/*
=>
=
:
()
[]
{}

*/
export type Token = {
    kind: TokenKind;
    span: Span;
    prev?: Token;
    next?: Token;

    // constructor(kind: TokenKind, span: Span, prev?: Token, next?: Token) {
    //     this.kind = kind;
    //     this.span = span;
    //     this.prev = prev;
    //     this.next = next;
    // }
};

export default function tokenize(rust: Tape): Token[] {
    return [];
}
