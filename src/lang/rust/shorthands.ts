import { Position, Range, TextDocument, TextEditor } from 'vscode';

import dedent from 'dedent-js';
import { Completion } from '@/completion_utils';
import { RustScope, RustScope } from '@@/rust/scopes';

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

function selectLineBefore(cursor: Position): Range {
    return new Range(
        new Position(cursor.line, 0),
        new Position(cursor.line, cursor.character),
    );
}

function selectBefore(fromCh: number, cursor: Position): Range {
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

    // pcrate psuper pself
    // defer (pub in ..)

    // reprc reprt reprp repraN    
    // function signature
    // use specials
    
    // are all triggered by space
    
    // need both raw and regex's for most robust archiecture
    // use space instead of \s

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
        ['reprenum', '#[repr|]\n$0enum'],

        //inlinefn
        //mustusefn
        //testfn
        //cfgfn
        //allowfn denyfn
        //docfn
        //coldfn
        // ...
        //check from available proc-macros
        //reprc -> repr(C)
        //repru8, ... -> repr(u8)
        //

        // derive basic
        // derive value type

        // .<space> => :: after capitalized target or builtin-type or ')'
    ],
};

const WS_I = / *?i /;
const WS_L_MFLAG = / *?l(m?) /;
const PFLAG = /(p?)/;

//step 1: match to completion
// step 2: if trigger is next change, execute stored completion--otherwise, toss

//todo maybe highlight code examples in docs (or maybe just $0...)
//todo append scope information to docs
// todo highlight and color and underline completions/chords ready to be triggered

// todo
//      completions -> shorthands
//      chords -> motions
//      actions -> modes

// for ambigous min-lb expressions, just give a number

/* keyed by minimum lookbehind--not including trigger--, or NaN if unknown (includes trigger, if applicable) */
const shorthands: Completion<RustScope>[] = [
    {
        docs: dedent`
        Inserts an if-statement.
        
        \`i \` → \`if $0 {}\`
        `,
        minLookbehind: 'i'.length,
        scope: ['fn'],
        match(ctx) {
            if (!ctx.line.is(WS_I)) {
                return undefined;
            }
            return {
                name: 'If-statement',
                target: selectBefore(2, ctx.cursor),
                snippet: 'if $0 {}',
            };
        },
    },
    {
        docs: dedent`
        Declares a local variable, possibly mutable.

        \`lm \` → \`let mut \`
        `,
        minLookbehind: 'l'.length,
        scope: ['fn'],
        match(ctx) {
            const match = WS_L_MFLAG.exec(ctx.line.raw);
            if (!match) {
                return undefined;
            }
            const mut = match[1] ? 'mut ' : '';
            return {
                name: "Local variable",
                target: selectBefore(mut ? 3 : 2, ctx.cursor),
                snippet: 'let ' + mut,
            };
        },
    },
    {
        docs: dedent`
            Inserts an else block or else-if block after the enclosing if-statement.

            \`\`\`
            if {
                ...
                elif//← press trigger to expand!
            }
            \`\`\`
            →
            \`\`\`
            if {
                ...
            } else if {
                //← stop here
            }
            \`\`\`
        `,
        minLookbehind: 4,
        scope: ['fn'],
        match(ctx) {
            //todo
            return {
                name: "Else block"
            };
        },
    },
    {
        docs: dedent`
        Inserts a top-level element marker.

        This shorthand handles elements that only exist in the top-level scope.

        \`ps \` → \`pub struct \`
        `,
        minLookbehind: 1,
        scope: ['toplevel'],
        exactScope: true,
        match(ctx) {
            const rev = ctx.downFromCursor();
            if (!rev.consumeAt(' ')) {
                return undefined;
            }
            const type = rev.consumeMatch([
                ['u', 'use'],
                ['s', 'struct'],
                ['e', 'enum'],
                ['m', 'macro_rules!'],
            ]);
            if (!type) {
                return undefined;
            }
            const rest = PFLAG.exec(rev.reversed().raw);
            if (!rest) {
                return undefined;
            }
            const pub = rest[1] ? 'pub ' : '';
            if (!rev.isExhausted()) {   // ensure first in line
                return undefined;
            }
            const [trigger, kword] = type;
            let pre = '';
            if (pub) {
                pre = trigger === 'm' ? '#[macro_export]\n' : pub;
            }
            return {
                name: "Declare top-level element",
                target: selectLineBefore(ctx.cursor),
                snippet: pre + kword + ' ',
            };
        }
    },
    {

    },
];


    // wrap as slice
    // eg: 'u8.amrs ' => '&'a [u8]'
    (ctx) => {
        const rev = ctx.downFromCursor();
        if (!rev.consumeAt(' ')) {
            return undefined;
        }
        if (rev.next() !== 's') {
            return undefined;
        }
        const flags = rev.consumeFlags([
            ['r', '&'],
            ['-ad', "'{} "],
            ['m', 'mut '],
        ]);
        if (!flags || rev.next() !== '.') {
            return undefined;
        }
        const target = rev.consumeRustTarget();
        if (!target) {
            return undefined;
        }
        let pre = flags.map(e => e[1]).join('');
        if (pre && pre[0] !== '&') {
            // only `m` flag || missing `r` flag
            pre = '&' + pre;
        }
        return {
            target: selectBefore(rev.pos, ctx.cursor),
            snippet: pre + '[' + target + ']',
        };
    },

    // declare extern
    // eg: !px => 'unsafe pub extern '
    (ctx) => {
        const rev = ctx.downFromCursor();
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
            target: selectBefore(rev.pos, ctx.cursor),
            snippet: pre + 'extern ',
        };
    },

    // top-level attribute/proc macro
    // eg: 'a ' => #[]'
    (ctx) => {
        if (!ctx.line.is('a ')) {
            return undefined;
        }
        return {
            target: selectLineBefore(ctx.cursor),
            snippet: '#[$0]',
        };
    },

    // expand #[must_use]
    // eg: #[mustuse ] => #[must_use] <next line>
    (ctx) => {
        ctx.line.consumeWs();
        const parts = ctx.line.consumeChunks(['#', '[', 'must', 'use ']); // triggered by space
        if (!parts || ctx.cursor.character !== ctx.line.pos) {
            return undefined;
        }
        const length = parts
            .slice(-4) // include whitespace before 'must'
            .reduce((sum, e) => sum + e.length, 0);
        return {
            target: selectBefore(length, ctx.cursor),
            snippet: 'must_use',
            displacement: {
                line: 1,
            },
        };
    },

    // scoped function signature
    // eg: 
    (ctx) => {
        if (ctx.scopes) {
            let indent = ctx.line.consumeWs();
        
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

];

export default shorthands;
