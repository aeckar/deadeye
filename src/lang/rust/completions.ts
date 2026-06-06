import {
    CompletionFamily,
    CompletionSingle,
    MAX_LINE_SEEK,
} from '../../completion_utils';
import Tape from '../../tape';
import {
    after,
    findWord,
    isLetter,
    markdown as md,
    rangeBefore,
} from '../../utils';
import { consumeRustTarget } from './lang';
import { RustScopeKind } from './scopes';

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

const subsitutitons: CompletionSingle[] = [
    {
        title: 'Inserts a byte-string literal',
        target: 'bsof',
        snippet: 'b"$0"',
    },
    {
        title: 'Inserts a byte-character literal',
        target: 'bcof',
        snippet: "b'$0'",
    },
    {
        title: 'Inserts a string literal',
        target: 'sof',
        snippet: '"$0"',
    },
    {
        title: 'Inserts a character literal',
        target: 'cof',
        snippet: "'$0'",
    },
    {
        title: 'Inserts an empty vector',
        target: 'vec',
        snippet: 'vec![$0]',
    },
    {
        title: 'Inserts a String type',
        target: 'string',
        snippet: 'String',
    },
    {
        title: md`
Inserts a \`HashMap\` type
        `,
        target: 'mapof',
        snippet: 'HashMap<$0,>',
    },
    {
        title: md`
Inserts a \`Vec\` type
        `,
        target: 'vecof',
        snippet: 'Vec<$0>',
    },
    {
        title: md`
Inserts a \`HashSet\` type
        `,
        target: 'setof',
        snippet: 'HashSet<$0>',
    },
    {
        title: 'Inserts an attribute',
        target: 'prm',
        snippet: '#[$0]',
    },
    {
        title: 'Prefixes fn with pub',
        target: 'p |fn',
        snippet: 'pub fn $0',
    },
    {
        title: 'Prefixes fn with extern',
        target: 'x |fn',
        snippet: 'extern "${1:C}" fn $0',
    },
    {
        title: 'Prefixes fn with const',
        target: 'c |fn',
        snippet: 'const fn $0',
    },
    {
        title: 'Prefixes struct with pub',
        target: 'p |struct',
        snippet: 'pub struct $0',
    },
    {
        title: 'Prefixes enum with pub',
        target: 'p |enum',
        snippet: 'pub enum $0',
    },
    {
        title: 'Inserts a derive attribute',
        target: 'prm |..',
        snippet: '#[derive(${1:Debug, PartialEq})]\\n$0',
    },
];

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

// todo typing c in extern "" completes, sends cursor to next pos
// todo worry about partial constructs later, might not even be an issue for all i know
// todo come back to these when expression-level scopes finished

const rust: CompletionFamily<RustScopeKind>[] = [
    {
        docs: md`
            Declares a function.

            \`f \` → \`extern "C" fn \`

            | Flag | Expansion                         |
            | :--- | :-------------------------------- |
            | p    | <u>p</u>ub                        |
            | c    | <u>c</u>onst                      |
            | a    | <u>a</u>sync                      |
            | u    | <u>u</u>nsafe                     |
            | x    | e<u>x</u>tern "/\* stop here \*/" |

            **Constraints:**

            - First word in line
            - In any of the following scopes:
                - Top-level
                - Function
                - \`impl\`
                - \`mod\`
                - \`trait\`
        `,
        minLookbehind: 'f'.length,
        scope: [['toplevel'], ['...fn'], ['...impl'], ['...mod'], ['...trait']],
        resolver(ctx) {
            const tape = ctx.leftOfCursor().reversed();
            if (!tape.consumeAt('f')) {
                return undefined;
            }
            const flags = tape.consumeFlags({
                p: 'pub ',
                c: 'const ',
                a: 'async ',
                u: 'unsafe ',
                x: 'extern "$0" ',
            });
            if (!flags) {
                return undefined;
            }
            let snippet = '';
            for (const key of ['p', 'c', 'a', 'u', 'x'] as const) {
                if (flags.has(key)) {
                    snippet += flags.get(key);
                }
            }
            snippet += 'fn ';
            return {
                preview: md`Insert \`${snippet}\`.`,
                target: rangeBefore(ctx.cursor, flags.size + 'f'.length),
                snippet,
            };
        },
    },
    {
        // Would consider changing this to `i`, but would clash with iterator variables
        docs: md`
            Inserts an if-statement.

            \`if \` → \`if /* stop here */ {}\`

            **Constraints:**

            - Whole word
        `,
        minLookbehind: 'if'.length,
        resolver(ctx) {
            const tape = ctx.leftOfCursor().reversed();
            if (!tape.consumeAt('fi') || isLetter(tape.cur() ?? ' ')) {
                return undefined;
            }
            return {
                preview: md`
Insert \`if\` block, then move to conditional.
                `,
                target: rangeBefore(ctx.cursor, 'if'.length),
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
            const mut = tape.consumeAt('m') ? ' mut' : '';
            if (!tape.isExhausted()) {
                // ensure first in line
                return undefined;
            }
            const expansion = 'let' + mut;
            return {
                preview: md`Insert \`${expansion}\`.`,
                target: rangeBefore(ctx.cursor, mut ? 'lm'.length : 'l'.length),
                snippet: expansion + ' ',
            };
        },
    },
    {
        //fixme false positive match if doing `if if {}...`, good enough for now
        docs: md`
            Inserts an \`else\` block or \`else if\` block after the enclosing \`if\` statement.
            
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
            - \`if\` keyword not farther than \`${MAX_LINE_SEEK}\` lines away
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
                preview: md`
                    Insert \`else\` block after current \`if\` block, then move there.
                `,
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

            console.log(tape.pos, tape.raw, 1, tape.consumeWs(), 1);
            if (!tape.isExhausted()) {
                // ensure first in line
                return undefined;
            }
            const [form, kword] = type;
            if (pub && form === 'm') {
                // since we are at the margin, no need to prepend indent
                pub = '#[macro_export]\n';
            }
            const snippet = pub + kword;
            return {
                preview: md`Insert \`${snippet}\`.`,
                target: rangeBefore(ctx.cursor),
                snippet: snippet + ' ',
            };
        },
    },
    {
        docs: md`
            Wraps the preceding element as a slice type, or a reference to one.

            \`u8.amrs \` → \`&'a mut [u8]\`

            | Flag  | Mnemonic                 | Expansion |
            | :---- | :----------------------- | :-------- |
            | r     | <u>r</u>eference         | \`&\`       |
            | m     | <u>m</u>utable reference | \`&mut\`    |
            | a..=d |                          | \`&'a\`     |

            **Basic form:** \`.s\`

            **Constraints:**

            - Function scope
        `,
        scope: [['...fn']],
        minLookbehind: '.s'.length,
        resolver(ctx) {
            const tape = ctx.leftOfCursor().reversed();
            if (!tape.consumeAt('s')) {
                return undefined;
            }
            const flags = tape.consumeFlags({
                r: '&',
                m: 'mut ',
                '-ad': "'{} ",
            });
            if (!flags || !tape.consumeAt('.')) {
                return undefined;
            }

            console.log('tape=', tape);
            const target = consumeRustTarget(tape);

            if (!target) {
                return undefined;
            }
            let pre = [...flags].map(([_, sub]) => sub).join('');
            if (pre && pre[0] !== '&') {
                // missing `r` flag, but reference modifier given--assume reference
                pre = '&' + pre;
            }
            return {
                preview: 'Wrap as slice type.',
                target: rangeBefore(
                    ctx.cursor,
                    target.length + flags.size + '.s'.length,
                ),
                snippet: pre + '[' + target + ']',
            };
        },
    },
    {
        docs: md`
            Inserts an \`extern\` modifier to declare functions from FFI.

            \`x\` → \`unsafe extern "/* stop here */"\`

            For more info, see https://doc.rust-lang.org/std/keyword.extern.html.

            **Constraints:**

            - Top-level scope
            - First word in line
        `,
        minLookbehind: 'x'.length,
        scope: [['toplevel']],
        resolver(ctx) {
            const tape = ctx.leftOfCursor();
            console.log(tape.raw);
            tape.consumeWs();
            if (!tape.consumeAt('x') || !tape.isExhausted()) {
                return undefined;
            }
            return {
                preview: md`
Insert \`extern "\` \`" \`.
                `,
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

            - Surrounded by whitespace
        `,
        minLookbehind: 'at'.length,
        resolver(ctx) {
            const tape = ctx.leftOfCursor().reversed();
            if (
                !tape.consumeAt('ta') ||
                (!tape.isExhausted() && !Tape.isWs(tape.cur() ?? '.'))
            ) {
                return undefined;
            }
            return {
                preview: md`
Insert \`#[\` \`]\`.
                `,
                target: rangeBefore(ctx.cursor, 'at'.length),
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
            for preventing bugs by the user by marking public API.

            Functions returning \`Result\` do not require marking, since clippy
            should already throw a warning if such a return value is discarded.

            For more info, see https://doc.rust-lang.org/std/hint/fn.must_use.html.

            **Constraints:**

            - Top-level or \`impl\` scope
            - First word in line
        `,
        minLookbehind: 'mustuse'.length,
        scope: [['toplevel'], ['...impl']],
        resolver(ctx) {
            const tape = ctx.leftOfCursor();
            tape.consumeWs();
            if (
                !tape.consumeEither('mu', 'mustuse', 'nodiscard') ||
                !tape.isExhausted()
            ) {
                return undefined;
            }
            return {
                preview: 'Insert \`#[must_use]\`.',
                target: rangeBefore(ctx.cursor),
                snippet: '#[must_use]',
            };
        },
    },
    {
        docs: md`
            Inserts an \`#[inline]\` attribute.

            \`il \` → \`#[inline]\`

            This attribute marks a function such that it can be inlined across crate boundaries.
            This is useful in library development to encourage inlining for small, non-generic
            functions.

            As a rule of thumb when building libraries,
            proactively add \`#[inline]\` to small, public, non-generic functions.

            For more info, see https://nnethercote.github.io/perf-book/inlining.html.

            **Constraints:**

            - Top-level or \`impl\` scope
            - First word in line
        `,
        minLookbehind: 'il'.length,
        scope: [['toplevel'], ['...impl']],
        resolver(ctx) {
            const tape = ctx.leftOfCursor();
            tape.consumeWs();
            if (!tape.consumeEither('il', 'inline') || !tape.isExhausted()) {
                return undefined;
            }
            return {
                preview: md`
Insert \`#[inline]\`
                `,
                target: rangeBefore(ctx.cursor),
                snippet: '#[inline]\n',
            };
        },
    },
    {
        docs: md`
            Inserts a \`println!()\` statement.

            \`p \` → \`println!("/* stop here */");\`

            **Constraints:**

            - Function scope
            - First word in line
        `,
        minLookbehind: 'p'.length,
        scope: [['...fn']],
        resolver(ctx) {
            const tape = ctx.leftOfCursor();
            tape.consumeWs();
            if (!tape.consumeAt('p') || !tape.isExhausted()) {
                return undefined;
            }
            return {
                preview: md`
Inserts \`println!("\` \`")\`.
                `,
                target: rangeBefore(ctx.cursor, 'p'.length),
                snippet: 'println!("$0");',
            };
        },
    },
    {
        docs: md`
            Inserts a parameter.

            \`vamrsp \` → \`mut &'a mut self\`

            | Flag  | Mnemonic                 | Expansion |
            | :---- | :----------------------- | :-------- |
            | v     | <u>v</u>ariable          | \`mut\`     |
            | r     | <u>r</u>eference         | \`&\`       |
            | m     | <u>m</u>utable reference | \`&mut\`    |
            | s     | <u>s</u>elf              | \`self\`    |
            | a..=d |                          | \`&'a\`     |

            **Basic form:** \`p\`

            **Constraints:**

            - Inside function parameter bounds \`(\` \`)\`
        `,
        minLookbehind: 'p'.length,
        resolver(ctx) {
            const tape = ctx.leftOfCursor().reversed();
            if (!tape.consumeAt('p')) {
                return undefined;
            }
            const flags = tape.consumeFlags({
                v: 'mut ',
                r: '&',
                m: 'mut ',
                s: 'self',
                '-ad': "'{} ",
            });
            if (!flags) {
                return undefined;
            }
            let expansion = '';
            if (flags.has('v')) {
                expansion += flags.get('v');
            }
            if (flags.has('r')) {
                let ref = '&';
                const lifetime = [...flags.values()].find(
                    sub => sub[1] >= 'a' && sub[1] <= 'd',
                );
                if (lifetime) {
                    ref += lifetime;
                }
                if (flags.has('m')) {
                    ref += flags.get('m');
                }
                expansion += ref;
            }
            if (flags.has('s')) {
                expansion += flags.get('s');
            } else {
                // Generic parameter placeholder fallback
                if (flags.has('v') && !flags.has('r')) {
                    expansion = flags.get('v') + expansion;
                }
                expansion += '${1:name}: ${2:Type}';
            }
            return {
                preview: md`Insert parameter layout: \`${expansion}\`.`,
                target: rangeBefore(ctx.cursor, flags.size + 1),
                snippet: expansion,
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
