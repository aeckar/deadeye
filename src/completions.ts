//! List of line-based completions for all implemented languages.
import { Position, Range } from 'vscode';

import Tape from './tape';
import { Replacement } from './utils';
import { ScopeInfo } from './scopes';

type LineCompletion = (tape: Tape, cursor: Position, scopes: ScopeInfo[]) => Replacement | undefined;

function hasStop(snippet: String): boolean {
    return snippet.includes('$0');
}

function range(
    fromLine: number,
    fromCh: number,
    toLine: number,
    toCh: number,
): Range {
    return new Range(
        new Position(fromLine, fromCh),
        new Position(toLine, toCh),
    );
}

function lineBeforePos(cursor: Position): Range {
    return new Range(
        new Position(cursor.line, 0),
        new Position(cursor.line, cursor.character),
    );
}

function beforePos(fromCh: number, cursor: Position): Range {
    return new Range(
        new Position(cursor.line, cursor.character - fromCh),
        new Position(cursor.line, cursor.character),
    );
}

// Elements with no identation from start of line need not have their scope checked,
// as we can assume they are top-level

// ['ls', 'static'], // `mut ` comes after

// first in line, top-level or struct/enum scope
// ['t', 'type'],
// ['lc', 'const'],
// ['a', '#[$0]'],

// non-exportable top-level elements
// nonPubItems: new Map([['i', 'impl$0']]),

// lifetimes(flags) {
//     return (
//         [...flags.toLowerCase()].find(ch => ch >= 'a' && ch <= 'd') ??
//         ''
//     );
// },

//rust
// ts
// javaScript
// c
// cpp
// java
// kotlin
// dart
// html
// css
// yaml
// toml
// json
// md

const builtins = /str|bool|char|[ui]([8136][624][8]?|size)|f[36][24]/g;

const subsitutitons = {
    rust: [
        // literals
        ['bstof', 'b"$0"'],
        ['bchof', "b'$0'"],
        ['stof', '"$0"'],
        ['chof', "'$0'"],
        ['evec', 'vec![]'],

        // types
        ['string', 'String'],
        ['mapof', 'HashMap<$0,>'],
        ['vecof', 'Vec<$0>'],
        ['setof', 'HashSet<$0>'],

        // modifiers
        ['pfn', 'pub $0fn'],
        ['xfn', 'extern "${1:C}" $0fn'],
        ['cfn', 'const $0fn'],
        ['pstruct', 'pub $0struct'],
        ['penum', 'pub $0enum'],

        // todo seperate
        ['reprenum', '#[repr($1)]\n$0enum'],
        // derive basic
        // derive value type

        // .<space> => :: after capitalized target or builtin-type or ')'
    ],
};

const lineCompletions: Record<string, LineCompletion[]> = {
    // typescript: [
    //     // top-level element marker
    //     (tape, cursor) =>
    //         line.is('i') ? { length: 1, snippet: 'import $0' } : undefined,
    // ],
    rust: [
        // pcrate psuper pself
        // defer (pub in ..)
    
        // reprc reprt reprp repraN
    
        // function signature
    
        // use specials
        
        // declare strictly top-level element
        // eg: ps => 'pub struct '
        (tape, cursor, _) => {
            const rev = tape.before(cursor);
            const match = rev.consumeMatch([
                ['u', 'use'],
                ['s', 'struct'],
                ['e', 'enum'],
                ['m', 'macro_rules!'],
            ]);
            if (!match) {
                return undefined;
            }
            const pub = rev.consumeAt('p') ? 'pub ' : '';
            if (tape.isExhausted()) {
                return undefined;
            }
            const [trigger, kword] = match;
            let pre = '';
            if (pub) {
                pre = trigger === 'm' ? '#[macro_export]\n' : pub;
            }
            return {
                target: lineBeforePos(cursor),
                snippet: pre + kword + ' ',
            };
        },

        // wrap as slice
        // eg: u8.amrs => '&'a [u8]'
        (tape, cursor, _) => {
            const rev = tape.before(cursor);
            if (rev.next() !== 's') {
                return undefined;
            }
            const flags = rev.consumeFlags([
                ['r', '&'],
                ['-ad', "'{} "],
                ['m', 'mut '],
            ]);
            if (!flags || tape.next() !== '.') {
                return undefined;
            }
            const target = tape.consumeRustTarget();
            if (!target) {
                return undefined;
            }
            let pre = flags.map(e => e[1]).join('');
            if (pre && pre[0] !== '&') {
                // only `m` flag || missing `r` flag
                pre = '&' + pre;
            }
            return {
                target: beforePos(rev.pos, cursor),
                snippet: pre + '[' + target + ']',
            };
        },

        // declare extern
        // eg: !px => 'unsafe pub extern '
        (tape, cursor, scopes) => {
            const rev = tape.before(cursor);
            if (rev.next() !== 'x') {
                return undefined;
            }
            const flags = rev.consumeFlags([
                ['p', 'pub '],
                ['!', 'unsafe '],
            ]);
            if (!flags || !rev.isExhausted()) {
                // not at start of line
                return undefined;
            }
            let pre = flags.map(e => e[1]).join('');
            return {
                target: beforePos(rev.pos, cursor),
                snippet: pre + 'extern ',
            };
        },

        // top-level attribute/proc macro
        // eg: a => #[]'
        (tape, cursor, scopes) => {
            if (!tape.is('a')) {
                return undefined;
            }
            return {
                target: lineBeforePos(cursor),
                snippet: '#[$0]',
            };
        },

        // expand #[must_use]
        // eg: #[mustuse] => #[must_use] <next line>
        (tape, cursor, scopes) => {
            tape.consumeWs();
            const parts = tape.consumeChunks(['#', '[', 'must', 'use']);
            if (!parts || cursor.character !== tape.pos) {
                return undefined;
            }
            const length = parts
                .slice(-4) // include whitespace before 'must'
                .reduce((sum, e) => sum + e.length, 0);
            return {
                target: beforePos(length, cursor),
                snippet: 'must_use',
                displacement: {
                    line: 1,
                },
            };
        },

        // scoped function signature
        // eg: 
        (tape, cursor, scopes) => {
            let indent = tape.consumeWs();
            
            return {
                target: ,
                snippet: ,
            };
        }


        // common attribute options

        // smart attributes: link() cfg() `no mangle`

        // top-level function

        // top-level element marker with implied visibility
        // (tape, cursor) => {
        //     let item: string = rust.nonPubItems[line.get()];
        // },

        // space-space or ; or jj or ff are all valid triggers

        (tape, cursor) => { 

        },
        (tape, cursor) => { },
        (tape, cursor) => { },
        (tape, cursor) => { },
        (tape, cursor) => {},
    ],
    // etc.
};

export default lineCompletions;
