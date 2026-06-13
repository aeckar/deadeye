import Tape from '../../tape';
import { Language, Token } from '../lexer_utils';

//todo enforce no two tokens with same capture
// assume post-2018 rust: dyn is STRICT KWORD
//Rust quirk: block comments can be nested.
// always use non capturing groups for perf
// expanded types may be diff, so segregate str/chr and byte str/chr
// always use sticky \y flag for perf
// . vs \s\S -- latter catches newlines too
// string match is more perf than regex match of same string
// place inner fn's at very end for readbility
//todo lifetimes/labels, invalid/unclosed, shebang, raw str, raw id
export const RUST = Language.newInstance({
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
        Language.BRACKETS,
        Language.ARITHMETIC_ASSIGN,
        Language.REM_ASSIGN,
        Language.BIT_OPS_ASSIGN,
        Language.BOOL_LOGIC,
        Language.C_COMMENTS,
        Language.C_PUNCT,
        Language.C_ID,
        Language.C_CHAR,
    ],
    ignore: /\s/y,
});

//todo cascade token changes

export default function tokenize(file: Tape, lang: Language): Token {
    let node = Token.root();
    const ignore = lang.ignore;
    if (ignore) {
        skip(ignore);
        while (!file.isExhausted()) {
            const start = file.pos;
            testStrings();
            if (file.pos !== start) {
                skip(ignore);
                continue;
            }
            testKeywords();
            if (file.pos !== start) {
                skip(ignore);
                continue;
            }
            testPatterns();
            if (file.pos !== start) {
                skip(ignore);
                continue;
            }
        }
    } else {
        while (!file.isExhausted()) {
            const start = file.pos;
            testStrings();
            if (file.pos !== start) {
                continue;
            }
            testKeywords();
            if (file.pos !== start) {
                continue;
            }
            testPatterns();
            if (file.pos !== start) {
                continue;
            }
        }
    }
    return node;

    function skip(ignore: RegExp) {
        ignore.lastIndex = file.pos;
        if (ignore.test(file.raw)) {
            file.pos = ignore.lastIndex; // advance cursor
        }
    }
    
    function testPatterns() {
        for (const [name, query] of lang.patterns.entries()) {
            query.lastIndex = file.pos;
            if (query.test(file.raw)) {
                const length = query.lastIndex - file.pos;
                node = node.append(name, length);
                file.pos += length;
                break;
            }
        }
    }

    function testKeywords() {
        for (const [name, kword] of lang.keywords) {
            if (file.isAtWord(kword)) {
                // Execute check for letter on both ends,
                // as some keywords contain leading/trailing symbols
                node = node.append(name, kword.length);
                file.pos += kword.length;
                break;
            }
        }
    }

    function testStrings() {
        for (const [name, query] of lang.strings.entries()) {
            if (file.isAt(query)) {
                node = node.append(name, query.length);
                file.pos += query.length;
                break;
            }
        }
    }
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
