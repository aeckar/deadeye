import { Key } from '../../misc';
import Tape from '../../tape';
import { Token, Vocabulary } from '../lexer_utils';

//todo enforce no two tokens with same capture
// assume post-2018 rust: dyn is STRICT KWORD
//Rust quirk: block comments can be nested.
// always use non capturing groups for perf
// expanded types may be diff, so segregate str/chr and byte str/chr
// always use sticky \y flag for perf
// . vs \s\S -- latter catches newlines too
// string match is more perf than regex match of same string

//todo lifetimes/labels, invalid/unclosed, shebang, raw str, raw id
export const VOCAB = Vocabulary.newInstance({
    keywords: [
        // === Strict Keywords ===
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

        // === Reserved Keywords ===
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

        // === Contextual Keywords ===
        'union', // must be followed by open brace
    ],
    declare: {
        FAT_ARROW: '=>',
        THIN_ARROW: '->',
        PATH_SEP: '::',
        QMARK: '?',
        RANGE_INCL: '..=',
        RANGE: '..',
        STRING: /"[\s\S]*?"/y,
        BYTE_STRING: /b"[\s\S]*?"/y,
        BYTE_CHAR: /b'\\?.'/y,
        FLOAT: new RegExp(
            `[0-9_]+(?:\.[0-9_]+(?:[eE][-+]?[0-9_]+)?)?(?:f(?:32|64|128))?`,
            'y',
        ),
        INTEGER: new RegExp(
            `(?:[0-9_]+|0b[01_]+|0o[0-7_]+|0x[0-9a-fA-F_]+)(?:[iu](?:8|16|32|64|128))?`,
            'y',
        ),
    },
    inherit: [
        Vocabulary.BRACKETS,
        Vocabulary.ARITHMETIC_ASSIGN,
        Vocabulary.REM_ASSIGN,
        Vocabulary.BIT_OPS_ASSIGN,
        Vocabulary.BOOL_LOGIC,
        Vocabulary.C_COMMENTS,
        Vocabulary.C_PUNCT,
        Vocabulary.C_ID,
        Vocabulary.C_CHAR,
    ],
    ignore: /\s/y,
});

export default function tokenize(
    file: Tape,
    vocab: Vocabulary<any>,
): Token<Key<typeof vocab>> {
    let node = Token.root();
    if (vocab.has('$ignore')) {
        for (const [name, query] of VOCAB.entries()) {
            if (file.isAtWord(kword)) {
                node = node.append(kword);
                file.pos += kword.length;
                break;
            }
        }
    } else {
        for (const [name, query] of VOCAB.entries()) {
            if (file.isAtWord(kword)) {
                node = node.append(kword);
                file.pos += kword.length;
                break;
            }
        }
    }

    return node;
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
