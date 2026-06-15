import { rangeBefore } from '../../misc';
import { CompletionFamily } from '../../registry_utils';
import { toMarkdown as md } from '../../text_utils';
import { TsScopeKind } from './resolver';

// Simple, non-contextual substitutions triggered globally or inline
// const substitutions: CompletionSingle[] = [
//     {
//         title: 'Inserts an arrow function template',
//         target: 'c',
//         snippet: '($1) => ',
//     },
//     {
//         title: 'Inserts an async arrow function template',
//         target: 'ac',
//         snippet: 'async ($1) => $0',
//     },
//     {
//         title: 'Inserts a console.log statement',
//         target: 'clg',
//         snippet: 'console.log($0);',
//     },
//     {
//         title: 'Inserts a read-only type property modifier',
//         target: 'ro',
//         snippet: 'readonly ',
//     },
// ];

// todo hot completion: auto-cap assignment to key if atomic symbolic constant (true, false, undefined)
// todo technically already performing spec engineering thru doc comment validation...

// todo completion: string type union, with checker
// todo completion: type<->class
//todo completion: make note comment into section comment
const typescript: CompletionFamily<TsScopeKind>[] = [
    {
        docs: md`
            Inserts block-scoped variable declarations.

            \`c \` → \`const \`
            \`l \` → \`let \`

            **Constraints:**

            - Inside function, block, or method scope
            - First word in line
        `,
        minLookbehind: 1,
        scoping: [['fn'], ['object']],
        resolver(ctx) {
            const tape = ctx.leftOfCursor();
            tape.consumeWs();
            const match = tape.consumeMatch({
                c: 'const',
                l: 'let',
            });
            if (!match || !tape.isExhausted()) {
                return undefined;
            }
            const [_, kword] = match;
            return {
                preview: md`Insert \`${kword}\` declaration.`,
                target: rangeBefore(ctx.cursor, 1),
                snippet: kword + ' ',
            };
        },
    },
    {
        docs: md`
            Dynamically wraps an identifier or expression in an 'await' statement.

            \`fetchData().aw \` → \`await fetchData()\`

            **Constraints:**

            - Inside an async function scope
        `,
        minLookbehind: 3, // '.aw'.length
        scoping: [['fn']],
        resolver(ctx) {
            const tape = ctx.leftOfCursor().reversed();
            if (!tape.consumeAt('wa') || !tape.consumeAt('.')) {
                return undefined;
            }

            // Reusing your logic for capturing the target token/expression left of the dot
            const target = consumeTypeScriptTarget(tape);
            if (!target) {
                return undefined;
            }

            return {
                preview: md`
Wrap expression with \`await\`.
                `,
                target: rangeBefore(ctx.cursor, target.length + 3),
                snippet: `await ${target}`,
            };
        },
    },
    {
        docs: md`
            Inserts class member properties and methods with explicit access modifiers.

            \`prmf \` → \`private async method()\`
            \`pvs \` → \`public static \`

            | Flag | Mnemonic  | Expansion    |
            | :--- | :-------- | :----------- |
            | p    | public    | \`public \`    |
            | r    | private   | \`private \`   |
            | o    | protected | \`protected \` |
            | v    | variable  | Fields       |
            | m    | method    | Methods      |
            | f    | async     | \`async \`     |
            | s    | static    | \`static \`    |

            **Constraints:**

            - Strictly inside a \`class\` scope
            - First item on the line
        `,
        minLookbehind: 2,
        scoping: [['class']],
        resolver(ctx) {
            const tape = ctx.leftOfCursor().reversed();
            const flags = tape.consumeFlags(ctx.cursor, {
                m: 'method',
                v: 'variable',
                f: 'async ',
                s: 'static ',
                p: 'public ',
                r: 'private ',
                o: 'protected ',
            });
            if (!flags || !tape.isExhausted()) {
                return undefined;
            }
            const flagMap = new Map(flags);
            let expansion = '';

            // 1. Resolve Access Modifier (Default to none or public based on style preference)
            if (flagMap.has('p')) {
                expansion += 'public ';
            } else if (flagMap.has('r')) {
                expansion += 'private ';
            } else if (flagMap.has('o')) {
                expansion += 'protected ';
            }

            // 2. Resolve Modifiers
            if (flagMap.has('s')) {
                expansion += 'static ';
            }
            if (flagMap.has('f')) {
                expansion += 'async ';
            }

            // 3. Resolve Structural Base
            if (flagMap.has('m')) {
                expansion += '${1:methodName}($2): ${3:void} {\n\t$0\n}';
            } else if (flagMap.has('v')) {
                expansion += '${1:propertyName}: ${2:string};';
            }

            return {
                preview: md`Insert class structure: \`${expansion.split('\n')[0]}\`.`,
                target: rangeBefore(ctx.cursor, flags.size),
                snippet: expansion,
            };
        },
    },
];

// Fallback helper stub matching your architecture requirements
function consumeTypeScriptTarget(tape: any): string | undefined {
    let target = '';
    while (!tape.isExhausted()) {
        const char = tape.cur();
        if (char === ' ' || char === ';' || char === '\n') {
            break;
        }
        target = char + target;
        tape.advance();
    }
    return target.length > 0 ? target : undefined;
}

export default typescript;

/*
Key Design Enhancements For Your Ecosystem
The .aw Postfix Resolution: Writing await at the beginning of a line forces your cursor back and forth across the line when you realize an expression is asynchronous. The backward-seeking .aw suffix lets you write the execution pipeline continuously, wrapping the expression instantly with zero backtracking.

Class Modifier Chord Consolidation: TypeScript class syntax can cause high physical keystroke overhead due to long access modifiers like protected static async. Bundling them into tight, non-overlapping chords (prf, pvs) targets the explicit structural locations where your scope manager detects a 'class' context.
*/
