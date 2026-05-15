import { MAX_LINE_SEEK, Shorthand } from '../../completion_utils';
import {
    after,
    findWord,
    isLetter,
    markdown as md,
    rangeBefore,
} from '../../utils';
import { RustScope } from './scopes';
import { consumeRustTarget } from './utils';

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

//step 1: match to completion
// step 2: if trigger is next change, execute stored completion--otherwise, toss

//todo maybe highlight code examples in docs (or maybe just $0...)
// todo highlight and color and underline completions/chords ready to be triggered

// todo
//      completions -> shorthands
//      chords -> chords
//      actions -> motions

// for ambigous min-lb expressions, just give a number

// common attribute options

// smart attributes: link() cfg() `no mangle`

// top-level function

// top-level element marker with implied visibility
// (tape, cursor) => {
//     let item: string = rust.nonPubItems[line.get()];
// },

// space-space or ; or jj or ff are all valid triggers
// remember: character index of 0 means BEFORE 0th character

// documentation format: short explain, example, specifics, reference labels
// append links to non-trivial concepts
// basic forms only if multiple forms

const rust: Shorthand<RustScope>[] = [
    {
        docs: md`
            Inserts an if-statement.

            \`if \` → \`if /* stop here */ {}\`

            **Constraints:**

            - Whole word
        `,
        minLookbehind: 'if'.length,
        resolver(ctx) {
            const tape = ctx.leftOfCursor().reversed();
            if (!tape.consumeAt('fi') || isLetter(tape.cur() ?? 'a')) {
                return undefined;
            }
            return {
                exactDescription: 'If-statement',
                target: rangeBefore(ctx.cursor, 2),
                snippet: 'if $0 {}',
            };
        },
    },
    {
        docs: md`
            Declares a local variable.

            \`lm \` → \`let mut \`

            **Basic form:** \`l\`

            **Suffixes:**

            - \`m\`: Declare as mutable

            **Constraints:**

            - Function scope
            - First word in line
        `,
        minLookbehind: 'l'.length,
        scope: [['fn']],
        resolver(ctx) {
            const tape = ctx.leftOfCursor();
            tape.consumeWs();
            if (!tape.consumeAt('l')) {
                return undefined;
            }
            const mut = tape.consumeAt('m') ? 'mut ' : '';
            if (!tape.isExhausted()) {
                // ensure first in line
                return undefined;
            }
            return {
                exactDescription: 'Local variable',
                target: rangeBefore(ctx.cursor, mut ? 3 : 2),
                snippet: 'let ' + mut,
            };
        },
    },
    {
        //fixme false positive match if doing `if if {}...`, good enough for now
        docs: md`
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

            **Basic forms:** \`else\`, \`elif\`
            
            **Constraints:**
            - In an if-statement
            - \`if\` keyword not farther than ${MAX_LINE_SEEK} lines away
        `,
        minLookbehind: 4,
        resolver(ctx) {
            const tape = ctx.leftOfCursor().reversed();
            const includeIf = tape.isAt('file');
            if (!includeIf && !tape.isAt('esle')) {
                return undefined;
            }
            const openPos = ctx.seekOpener('{}');
            const doc = ctx.editor.document;
            if (!openPos || findWord(doc.lineAt(openPos).text, 'if') === -1) {
                return undefined;
            }
            const closePos = ctx.seekCloser('{}');
            if (!closePos) {
                return undefined;
            }
            return {
                exactDescription: 'Else block',
                target: rangeBefore(ctx.cursor), //todo include previous newline as well
                insertAt: after(ctx.cursor),
                snippet: includeIf ? ' else if {\n$0\n}' : ' else {\n$0\n}',
            };
        },
    },
    {
        docs: md`
            Inserts a top-level element marker.

            \`ps \` → \`pub struct \`

            Elements can be made public by prefixing the completion with \`p\`.
            Macros with \`p\` are declared as \`#[macro_export]\`, and are hoisted
            to the top-level scope of the parent crate.

            | Basic Form | Expansion    |
            | :--------- | :----------- |
            | u          | use          |
            | s          | struct       |
            | e          | enum         |
            | m          | macro_rules! |

            **Constraints:**

            - Top-level scope
            - First word in line
        `,
        minLookbehind: 1,
        scope: [['toplevel']],
        exactScope: true,
        resolver(ctx) {
            const tape = ctx.leftOfCursor().reversed();
            const type = tape.consumeMatch([
                ['u', 'use'],
                ['s', 'struct'],
                ['e', 'enum'],
                ['m', 'macro_rules!'],
            ]);
            if (!type) {
                return undefined;
            }
            let pub = tape.consumeAt('p') ? 'pub ' : '';
            if (!tape.isExhausted()) {
                // ensure first in line
                return undefined;
            }
            const [command, kword] = type;
            if (pub && command === 'm') {
                // since we are at the margin, no need to prepend indent
                pub = '#[macro_export]\n';
            }
            return {
                exactDescription: 'Declare top-level element',
                target: rangeBefore(ctx.cursor),
                snippet: pub + kword + ' ',
            };
        },
    },
    {
        docs: md`
            Wraps the preceding element as a slice type, or a reference to one.

            \`u8.amrs \` → \`&'a mut [u8]\`

            **Basic form:** \`.s\`

            **Constraints:**

            - Shorthand must be
            - Target preceded by \`:\`
        `,
        minLookbehind: '.s'.length,
        resolver(ctx) {
            const tape = ctx.leftOfCursor().reversed();
            if (!tape.consumeAt('s')) {
                return undefined;
            }
            const flags = tape.consumeFlags([
                ['r', '&'],
                ['-ad', "'{} "],
                ['m', 'mut '],
            ]);
            if (!flags || !tape.consumeAt('.')) {
                return undefined;
            }
            const length = tape.pos;
            const target = consumeRustTarget(tape);
            if (!target) {
                return undefined;
            }
            let pre = flags.map(e => e[1]).join('');
            if (pre && pre[0] !== '&') {
                // only `m` flag || missing `r` flag
                pre = '&' + pre;
            }
            return {
                exactDescription: 'Wrap as slice type',
                target: rangeBefore(ctx.cursor, length),
                snippet: pre + '[' + target + ']',
            };
        },
    },
    {
        docs: md`
            Inserts an \`extern\` block to declare functions from FFI.

            ~~~
            x//← press trigger to expand!
            ~~~

            →

            ~~~
            unsafe extern "/* placeholder 1 */" {
                /* stop here */
            }
            ~~~

            For more info, see https://doc.rust-lang.org/std/keyword.extern.html.

            **Constraints:**

            - Top-level scope
            - First word in line
        `,
        minLookbehind: 'x'.length,
        scope: [['toplevel']],
        exactScope: true,
        resolver(ctx) {
            const tape = ctx.leftOfCursor();
            tape.consumeWs();
            if (!tape.consumeAt('x') || !tape.isExhausted()) {
                return undefined;
            }
            return {
                exactDescription: 'Local variable',
                target: rangeBefore(ctx.cursor),
                snippet: 'extern "${1:C}" $0',
            };
        },
    },
    {
        docs: md`
            Inserts an attribute/proc-macro.

            \`at \` → \`#[/* stop here */]\`

            **Constraints:**

            - Whole word
        `,
        minLookbehind: 'at'.length,
        resolver(ctx) {
            const tape = ctx.leftOfCursor().reversed();
            if (!tape.consumeAt('ta') || isLetter(tape.cur() ?? 'a')) {
                return undefined;
            }
            return {
                exactDescription: 'Attribute',
                target: rangeBefore(ctx.cursor, 3),
                snippet: '#[$0]',
            };
        },
    },
    {
        docs: md`
            Inserts a \`#[must_use]\` attribute.

            \`mustuse \` → \`#[must_use]\`

            This attribute marks a function such that discarding the return value
            causes the compiler to issue a warning. This is useful in library development
            for preventing bugs by the user.

            For more info, see https://doc.rust-lang.org/std/hint/fn.must_use.html.

            **Constraints:**

            - Top-level or impl scope
            - First word in line
        `,
        minLookbehind: 'mustuse'.length,
        scope: [['toplevel'], ['impl']],
        resolver(ctx) {
            const tape = ctx.leftOfCursor();
            tape.consumeWs();
            if (!tape.consumeAt('esutsum') || !tape.isExhausted()) {
                return undefined;
            }
            return {
                exactDescription: 'Non-discardable return value',
                target: rangeBefore(ctx.cursor, 7),
                snippet: '#[must_use]',
            };
        },
    },
    {
        docs: md`
            Inserts an \`#[inline]\` attribute.

            This attribute marks a function such that it can be inlined across crate boundaries.
            This is useful in library development to encourage inlining for small, non-generic
            functions.

            For more info, see https://nnethercote.github.io/perf-book/inlining.html.

            **Constraints:**

            - Top-level or impl scope
            - First word in line
        `,
        minLookbehind: 'inline'.length,
        scope: [['toplevel'], ['impl']],
        resolver(ctx) {
            const tape = ctx.leftOfCursor();
            tape.consumeWs();
            if (!tape.consumeAt('enilni') || !tape.isExhausted()) {
                return undefined;
            }
            return {
                exactDescription: 'Suggest inlining',
                target: rangeBefore(ctx.cursor, 6),
                snippet: '#[inline]',
            };
        },
    },
    // {
    //     docs: md`

    //     `,
    //     minLookbehind: ' '.length,
    //     scope: [['fn']],
    //     resolver(ctx) {

    //     },
    // },
];

/* 
    },  perhaps on \n after auto-{}?
    {
        
    },
*/
export default rust;
