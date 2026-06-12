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
        RANGE_INCL: '..=',
        RANGE: '..',
    },
    Vocabulary.BRACKETS, // todo group c-like operators
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
//todo universal indentation on (|) + [ENTER]

/*language idea:

[a,b] types, type spread
params send type to type params
fn's can have same name as props
no inheritance, use rust data model
steal from rust, since rust is crab, but also existing parsing modules
allow var shadowing
new keywords: `from`
from creates type pool, which is inferred after arg passing
P[<id or _ or + or |>]
`is Type` is default implicit, warn to remove
predicates in `where`:
    `||`: check shapes are disjoint
    `&&`: check intersection of shapes

        and these can be prefixes:
    `from` `!from`: is subset of other shape
    `is` `!is`: shares same shape or type

| is type union (multiple possible types)
+ is type addition (amalgam of types)
- is type subtraction

ensure param list is decluttered

type pool props (prefer :: over `as` for clearer operation precedence)
    sum: + of every type
    union: | of every type

pub fn my_fn(child: C <- {}) -> int
```
pub fn inherit(
    child: C <- {},
    ...parents: P !<- {},
) -> T
where
    P[i] || P[j],
    P[_] || C,
    T == P::sum + C, 
{
}
```
*/
