import { MarkdownString as Markdown, Position, Range } from 'vscode';

import dedent from 'dedent-js';
import { Shorthand } from '@/completion_utils';
import { RustScope } from '@@/rust/scopes';
import { consumeRustTarget } from './utils';
import { isLetter } from '@/utils';

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

function selectAllBefore(cursor: Position): Range {
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

// todo pre compile docs to markdown



const subsitutitons = {
    rust: [
        // Inserts a literal.
        ['bstof', 'b"$0"'],
        ['bchof', "b'$0'"],
        ['stof', '"$0"'],
        ['chof', "'$0'"],
        ['evec', 'vec![]'],

        // Inserts a type.
        ['string', 'String'],
        ['mapof', 'HashMap<$0,>'],
        ['vecof', 'Vec<$0>'],
        ['setof', 'HashSet<$0>'],

        // Inserts an attribute/proc-macro.
        ['prm', '#[$0]'],

        // Prefixes the scope with a modifier. 
        ['p |fn', 'pub $0fn'],
        ['x |fn', 'extern "${1:C}" $0fn'],
        ['c |fn', 'const $0fn'],
        ['p |struct', 'pub $0struct'],
        ['p |enum', 'pub $0enum'],
        ['prm |..'],

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
const shorthands: Shorthand<RustScope>[] = [
    {
        docs: new Markdown(dedent`
            Inserts an if-statement.
            
            **Base case:** \`if\`
            **Constraints:**
                - Whole word

            \`if \` → \`if /* stop here */ {}\`
        `),
        minLookbehind: 'i'.length,
        match(ctx) {
            let rev = ctx.downFromCursor();
            if (!rev.consumeAt('fi') || isLetter(rev.cur() ?? 'a')) {
                return undefined;
            }
            return {
                shortDescription: 'If-statement',
                target: selectBefore(2, ctx.cursor),
                snippet: 'if $0 {}',
            };
        },
    },
    {
        docs: new Markdown(dedent`
            Declares a local variable.

            **Base case:** \`l\`\\
            **Suffixes:**
                - \`m\`: Declare as mutable
            **Constraints:**
                - In function scope
                - First word in line

            \`lm \` → \`let mut \`
        `),
        minLookbehind: 'l'.length,
        scope: ['fn'],
        match(ctx) {
            const left = ctx.line.before(ctx.cursor);
            left.consumeWs();
            if (!left.consumeAt('l')) {
                return undefined;
            }
            const mut = left.consumeAt('m') ? 'mut ' : '';
            if (!left.isExhausted()) {
                // not at cursor
                return undefined;
            }
            return {
                shortDescription: "Local variable",
                target: selectBefore(mut ? 3 : 2, ctx.cursor),
                snippet: 'let ' + mut,
            };
        },
    },
    {
        docs: new Markdown(dedent`
            Inserts an else block or else-if block after the enclosing if-statement.

            **Base cases:** \`else\`, \`elif\`\\
            **Scope:** \`\`

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
        `),
        minLookbehind: 4,
        scope: ['fn'],
        match(ctx) {
            //todo
            return {
                shortDescription: "Else block",
                target:
            };
        },
    },
    {
        docs: new Markdown(dedent`
            Inserts a top-level element marker.

            This shorthand handles elements that only exist in the top-level scope.
            Elements can be made public by prefixing the completion with \`p\`.
            Macros with \`p\` are declared as \`#[macro_export]\`), and are hoisted
            to the top-level scope of the parent crate.

            | Shorthand | Expansion    |
            | :-------- | :----------- |
            | u         | use          |
            | s         | struct       |
            | e         | enum         |
            | m         | macro_rules! |

            \`ps \` → \`pub struct \`
        `),
        minLookbehind: 1,
        scope: ['toplevel'],
        exactScope: true,
        match(ctx) {
            const rev = ctx.downFromCursor();
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
                // since we are at the margin, no need to prepend indent
                pre = trigger === 'm' ? '#[macro_export]\n' : pub;
            }
            return {
                shortDescription: "Declare top-level element",
                target: selectAllBefore(ctx.cursor),
                snippet: pre + kword + ' ',
            };
        }
    },
    {
        docs: new Markdown(dedent`
            Wraps the preceding element as a slice type, or a reference to one.

            The target must be preceded by \`:\`.

            \`u8.amrs \` → \`&'a mut [u8]\`
        `),
        minLookbehind: '.s'.length,
        match(ctx) {
            const rev = ctx.downFromCursor();
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
            const target = consumeRustTarget(rev);
            if (!target) {
                return undefined;
            }
            let pre = flags.map(e => e[1]).join('');
            if (pre && pre[0] !== '&') {
                // only `m` flag || missing `r` flag
                pre = '&' + pre;
            }
            return {
                shortDescription: 'Wrap as slice type',
                target: selectBefore(rev.pos, ctx.cursor),
                snippet: pre + '[' + target + ']',
            };
        },
    },
    {
        docs: new Markdown(dedent`
            Inserts an \`extern\` block to declare functions from FFI.

            \`\`\`
            x//← press trigger to expand!
            \`\`\`
            →
            \`\`\`
            unsafe extern "/* placeholder 1 */" {
                /* stop here */
            }
            \`\`\`
        `),
        minLookbehind: 'x'.length,
        scope: ['toplevel'],
        exactScope: true,
        match(ctx) {
            //todo
        },
    },
    {
        docs: new Markdown(dedent`
            Inserts an attribute/proc-macro.

            \`prm \` → \`#[/* stop here */]\`
        `),
        minLookbehind: 'prm'.length,
        match(ctx) {
            if (!ctx.line.is('prm')) {
                return undefined;
            }
            return {
                shortDescription: "Attribute",
                target: selectAllBefore(ctx.cursor),
                snippet: '#[$0]',
            };
        },
    }

];
    // Inserts a `#[must_use]` attribute.
    // eg: \`mustuse \` => \`#[must_use]\`
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
    }

// common attribute options

// smart attributes: link() cfg() `no mangle`

// top-level function

// top-level element marker with implied visibility
// (tape, cursor) => {
//     let item: string = rust.nonPubItems[line.get()];
// },

// space-space or ; or jj or ff are all valid triggers

export default shorthands;
