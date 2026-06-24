import { Range } from 'vscode';
import {
    Completion,
    CompletionRegistry,
    MAX_LINE_SEEK,
    substitute,
} from '../../completion_registry_utils';
import { after, rangeBefore } from '../../misc';
import Tape from '../../tape';
import {
    errorHtml,
    findWord,
    isLetter,
    toMarkdown as md,
} from '../../text_utils';
import { consumeRustTarget } from './language';
import { RustScopeKind } from './scope_registry';

// optimizing docs should add proper punctation, capitalization
// toggle mode for automatic tab-out by delimiter
// shortcut for auto-append semi and commas to all lines within range??
// no, have them complete instead
// { before / } after identifier inserts space
// language idea: imports with clashing names is ok as long as signature is different
// language idea over ts/s: unique keys :)

const builtins = /str|bool|char|[ui]([8136][624][8]?|size)|f[36][24]/g;

// .inz = is not zero
// .iz = is zero
// .ino = is negative one
// .inno = is not negative one

// const subsitutitons: CompletionSingle[] = [
//     {
//         title: md`
// Inserts a byte-string literal
//         `,
//         target: 'bsof',
//         snippet: 'b"$0"',
//     },
//     {
//         title: md`
// Inserts a byte-character literal
//         `,
//         target: 'bcof',
//         snippet: "b'$0'",
//     },
//     {
//         title: md`
// Inserts a string literal
//         `,
//         target: 'sof',
//         snippet: '"$0"',
//     },
//     {
//         title: md`
// Inserts a character literal
//         `,
//         target: 'cof',
//         snippet: "'$0'",
//     },
//     {
//         title: md`
// Inserts an empty vector
//         `,
//         target: 'vec',
//         snippet: 'vec![$0]',
//     },
//     {
//         title: md`
// Inserts a String type
//         `,
//         target: 'string',
//         snippet: 'String',
//     },
//     {
//         title: md`
// Inserts a \`HashMap\` type
//         `,
//         target: 'mapof',
//         snippet: 'HashMap<$0,>',
//     },
//     {
//         title: md`
// Inserts a \`Vec\` type
//         `,
//         target: 'vecof',
//         snippet: 'Vec<$0>',
//     },
//     {
//         title: md`
// Inserts a \`HashSet\` type
//         `,
//         target: 'setof',
//         snippet: 'HashSet<$0>',
//     },
//     {
//         title: md`
// Inserts an attribute
//         `,
//         target: 'prm',
//         snippet: '#[$0]',
//     },
//     {
//         title: md`
// Prefixes fn with pub
//         `,
//         target: 'p |fn',
//         snippet: 'pub fn $0',
//     },
//     {
//         title: md`
// Prefixes fn with extern
//         `,
//         target: 'x |fn',
//         snippet: 'extern "${1:C}" fn $0',
//     },
//     {
//         title: md`
// Prefixes fn with const
//         `,
//         target: 'c |fn',
//         snippet: 'const fn $0',
//     },
//     {
//         title: md`
// Prefixes struct with pub
//         `,
//         target: 'p |struct',
//         snippet: 'pub struct $0',
//     },
//     {
//         title: md`
// Prefixes enum with pub
//         `,
//         target: 'p |enum',
//         snippet: 'pub enum $0',
//     },
//     {
//         title: md`
// Inserts a derive attribute
//         `,
//         target: 'prm |..',
//         snippet: '#[derive(${1:Debug, PartialEq})]\\n$0',
//     },
// ];

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

// HOT COMPLETIONS
// `:.* string(?=>[,)])` -> `:.* String(?=>[,)])`
// `string::` -> `String::` IMPORTANT: run at same time as `::` completion
// `c` -> `C` for `extern "C"`

//`,` -> `, `
// `efn` -> extern fm   // check is modification of valid fn signature
// gfn -> add <> after fn id

/*
␣ ;

⎵ ;


grey squiggly when left of scope marker to show help
*/

// todo on `return`, `break`, or `continue` completion,
// move cursor to next line out of close bracket
// todo auto-wrap long method chains / `.[ENTER]` -> `<nl><indent + 1>.|`
// todo disable completions in comments EXCEPT in fenced code blocks
// todo completions should typically be >1 char to not conflict with single-letter vars,
//  except outside of fn scope

// todo group completions by trigger at init time

// todo convert all completionSingle's to families

//todo api for conflict resolution (byte --> u8 | Byte ?)
//todo `is` as : is okay because is_ should assume only ever exist at start of identifier
//todo default to unsigned
//todo `let next int as int be` --> `let next_int: u32 = `
//todo autocorrect keywords according to context

//todo cursor in word + tab = indent line (should alr exist but alright)
//todo vecof id one, id two, 
const rust = CompletionRegistry.newInstance<RustScopeKind>(
    {
        docs: md`equals asssignment`
    }
    {
        //todo Realistically, you won't annotate a type on the next line. so limitation is okay
        docs: md`
type annotation
        `,
        minLookbehind: 1,
        trigger: '',
        resolver(ctx) {
            const idx = ctx.editor.document.offsetAt(ctx.cursor);
            const scopes = ctx.scopes.search([idx, idx]);
            if (scopes.find(scope => scope.kind === 'typeAnno')) {
                
            }
        },
    },
    {
        docs: md`
assignment
        `,
        minLookbehind: 1,
        trigger: '',
        resolver(ctx) {
            const tape = ctx.leftOfCursor();
            if (!tape.seekAtIdentifier('let')) {
                return undefined;
            }
            //let x is int be
            tape.pos += 'let'.length;
        },
    },
    {
        docs: md``,
        minLookbehind: 1,
        trigger: '',
        resolver(ctx) {},
    },
    {
        docs: md``,
        minLookbehind: 1,
        resolver(ctx) {
            const left = ctx.leftOfCursor().reversed();
            const right = ctx.rightOfCursor();
            if (!right.consumeAt('fn')) {
                return undefined;
            }
        },
    },
    {
        // be lax with scoping rules to allow for move to before `fn` while still typing signature
        docs: md`
            Adds a modifier to a function.

            \`c/* start here */f\` → \`const /* stop here */fn \`

            Enforces canonical modifier order
            (\`pub\` → \`const\`/\`async\` → \`unsafe\` → \`extern\`).

            **Errors:**

            - \`c\` and \`a\` flags are both passed (\`const async fn\` is not valid Rust)
        `,
        trigger: '',
        minLookbehind: 1,
        resolver(ctx) {
            const tape = ctx.leftOfCursor().reversed();
            if (tape.isExhausted()) {
                return undefined;
            }
            const right = ctx.rightOfCursor();
            if (!right.consumeAt('fn')) {
                return undefined;
            }
            const expansion = tape.consumeMatch({
                p: 'pub',
                c: 'const',
                a: 'async',
                u: 'unsafe',
                x: 'extern "$0"',
            });
            if (!expansion) {
                return undefined;
            }
            let [_, kword] = expansion;
            return Completion.newInstance({
                preview: md`Insert \`${kword} \` before \`fn\`.`,
                target: rangeBefore(ctx.cursor, 1),
                snippet: kword + ' ',
            });
        },
    },
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

            Enforces canonical modifier order
            (\`pub\` → \`const\`/\`async\` → \`unsafe\` → \`extern\`).

            **Basic form:** \`f\`
            **Constraints:**

            - Only word in line
            - In any of the following scopes:
                - Top-level
                - \`impl\`
                - \`mod\`
                - \`trait\`

            **Errors:**

            - \`c\` and \`a\` flags are both passed (\`const async fn\` is not valid Rust)
            - aa i
        `,
        minLookbehind: 'f'.length,
        scoping: [[], ['...impl'], ['...mod'], ['...trait']],
        resolver(ctx) {
            const tape = ctx.leftOfCursor().reversed();
            if (!tape.consumeAt('f')) {
                return undefined;
            }
            const flags = tape.consumeFlags(ctx.cursor, {
                p: 'pub ',
                c: 'const ',
                a: 'async ',
                u: 'unsafe ',
                x: 'extern "$0" ',
            });
            if (!flags) {
                return undefined;
            }
            let errors: Range[] = [];
            let causes: string[] = [];
            if (flags.has('c') && flags.has('a')) {
                errors.push(flags.get('c')!.range);
                errors.push(flags.get('a')!.range);
                causes.push(
                    errorHtml('`c` + `a`: `const async fn` is invalid'),
                );
            }
            // todo: make sure each flag agrees with context, or add to errors
            let snippet = '';
            for (const key of ['p', 'c', 'a', 'u', 'x'] as const) {
                if (flags.has(key)) {
                    snippet += flags.get(key);
                }
            }
            snippet += 'fn ';
            const diagnostics = causes.map(e => '\n\n' + e).join('');
            return Completion.newInstance({
                preview: md`Insert \`${snippet}\`.${diagnostics}`,
                target: rangeBefore(ctx.cursor, flags.size + 'f'.length),
                errors,
                snippet,
            });
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
            return Completion.newInstance({
                preview: md`
Insert \`if\` block, then move to conditional.
                `,
                target: rangeBefore(ctx.cursor, 'if'.length),
                snippet: 'if $0 {}',
            });
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
            - Only word in line
        `,
        minLookbehind: 'l'.length,
        scoping: [['fn']],
        trigger: ' ',
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
            return Completion.newInstance({
                preview: md`Insert \`${expansion}\`.`,
                target: rangeBefore(ctx.cursor, mut ? 'lm'.length : 'l'.length),
                snippet: expansion + ' ',
            });
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
        trigger: ' ',
        resolver(ctx) {
            const tape = ctx.leftOfCursor().reversed();
            const includeIf = tape.isAt('file');
            if (!includeIf && !tape.isAt('esle')) {
                return undefined;
            }
            const openPos = ctx.seekOpenBracket('{}');
            const doc = ctx.editor.document;
            if (!openPos || findWord(doc.lineAt(openPos).text, 'if') === -1) {
                return undefined;
            }
            const closePos = ctx.seekCloseBracket('{}');
            if (!closePos) {
                return undefined;
            }
            return Completion.newInstance({
                preview: md`
                    Insert \`else\` block after current \`if\` block, then move there.
                `,
                target: rangeBefore(ctx.cursor), //todo include previous newline as well
                insertAt: after(ctx.cursor),
                snippet: includeIf ? ' else if {\n$0\n}' : ' else {\n$0\n}',
            });
        },
    },
    {
        docs: md`
            Inserts a top-level element marker.

            \`ps \` → \`pub struct \`

            Elements can be made public by prefixing the completion with \`p\`.
            Macros with \`p\` are declared as \`#[macro_export]\`, and are hoisted
            to the top-level scope of the parent crate.

            | Basic Form/Terminator | Expansion    |
            | :-------------------- | :----------- |
            | u                     | use          |
            | s                     | struct       |
            | e                     | enum         |
            | m                     | macro_rules! |

            **Constraints:**

            - Top-level scope
            - Only word in line
        `,
        minLookbehind: 1,
        scoping: [[]],
        trigger: ' ',
        resolver(ctx) {
            const tape = ctx.leftOfCursor().reversed();
            const type = tape.consumeMatch({
                u: 'use',
                s: 'struct',
                e: 'enum',
                m: 'macro_rules!',
            });
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
            const expansion = pub + kword;
            return Completion.newInstance({
                preview: md`Insert \`${expansion}\`.`,
                target: rangeBefore(ctx.cursor),
                snippet: expansion + ' ',
            });
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

            **Terminator:** \`s\`

            **Constraints:**

            - Function scope
        `,
        scoping: [['...fn']],
        minLookbehind: '.s'.length,
        trigger: ' ',
        resolver(ctx) {
            const tape = ctx.leftOfCursor().reversed();
            if (!tape.consumeAt('s')) {
                return undefined;
            }
            const flags = tape.consumeFlags(ctx.cursor, {
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
            return Completion.newInstance({
                preview: md`
Wrap as slice type.
                `,
                target: rangeBefore(
                    ctx.cursor,
                    target.length + flags.size + '.s'.length,
                ),
                snippet: pre + '[' + target + ']',
            });
        },
    },
    {
        docs: md`
            Inserts an \`extern\` modifier to declare functions from FFI.

            \`x\` → \`unsafe extern "/* placeholder */" /* stop here */\`

            For more info, see https://doc.rust-lang.org/std/keyword.extern.html.

            **Constraints:**

            - Top-level scope
            - Only word in line
        `,
        minLookbehind: 'x'.length,
        scoping: [[]],
        trigger: ' ',
        resolver(ctx) {
            const tape = ctx.leftOfCursor();
            console.log(tape.raw);
            tape.consumeWs();
            if (!tape.consumeAt('x') || !tape.isExhausted()) {
                return undefined;
            }
            return Completion.newInstance({
                preview: md`
Insert \`extern "\${1:C}" \`.
                `,
                target: rangeBefore(ctx.cursor),
                snippet: 'extern "${1:C}" ',
            });
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
        trigger: ' ',
        resolver(ctx) {
            const tape = ctx.leftOfCursor().reversed();
            if (
                !tape.consumeAt('ta') ||
                (!tape.isExhausted() && !Tape.isWs(tape.cur() ?? '.'))
            ) {
                return undefined;
            }
            return Completion.newInstance({
                preview: md`
Insert \`#[$0]\`.
                `,
                target: rangeBefore(ctx.cursor, 'at'.length),
                snippet: '#[$0]',
            });
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
            - Only word in line
        `,
        minLookbehind: 'mustuse'.length,
        scoping: [[], ['...impl']],
        trigger: ' ',
        resolver(ctx) {
            const tape = ctx.leftOfCursor();
            tape.consumeWs();
            if (
                !tape.consumeEither('mu', 'mustuse', 'nodiscard') ||
                !tape.isExhausted()
            ) {
                return undefined;
            }
            return Completion.newInstance({
                preview: md`
Insert \`#[must_use]\`.
                `,
                target: rangeBefore(ctx.cursor),
                snippet: '#[must_use]',
            });
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
            - Only word in line
        `,
        minLookbehind: 'il'.length,
        scoping: [[], ['...impl']],
        trigger: ' ',
        resolver(ctx) {
            const tape = ctx.leftOfCursor();
            tape.consumeWs();
            if (!tape.consumeEither('il', 'inline') || !tape.isExhausted()) {
                return undefined;
            }
            return Completion.newInstance({
                preview: md`
Insert \`#[inline]\`
                `,
                target: rangeBefore(ctx.cursor),
                snippet: '#[inline]\n',
            });
        },
    },
    {
        docs: md`
            Inserts a \`println!()\` statement.

            \`p \` → \`println!("/* stop here */");\`

            **Constraints:**

            - Function scope
            - Only word in line
        `,
        minLookbehind: 'p'.length,
        scoping: [['...fn']],
        trigger: ' ',
        resolver(ctx) {
            const tape = ctx.leftOfCursor();
            tape.consumeWs();
            if (!tape.consumeAt('p') || !tape.isExhausted()) {
                return undefined;
            }
            return Completion.newInstance({
                preview: md`
Inserts \`println!("$0")\`.
                `,
                target: rangeBefore(ctx.cursor, 'p'.length),
                snippet: 'println!("$0");',
            });
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

            **Basic form/Terminator:** \`p\`

            **Constraints:**

            - Inside function parameter bounds \`(\` \`)\`
        `,
        minLookbehind: 'p'.length,
        trigger: ' ',
        resolver(ctx) {
            const tape = ctx.leftOfCursor().reversed();
            if (!tape.consumeAt('p')) {
                return undefined;
            }
            const flags = tape.consumeFlags(ctx.cursor, {
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
                    sub => sub.expansion[1] >= 'a' && sub.expansion[1] <= 'd',
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
            return Completion.newInstance({
                preview: md`Insert parameter layout: \`${expansion}\`.`,
                target: rangeBefore(ctx.cursor, flags.size + 1),
                snippet: expansion,
            });
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
);

/* 
    },  perhaps on \n after auto-{}?
    {
        
    },
*/
export default rust;
