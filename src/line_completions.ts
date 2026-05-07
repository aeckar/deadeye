import { Replacement } from './utils';
import Tape from './tape';
import { rust } from './languages';

type LineCompletionHandler = (
    tape: Tape,
    idx: number,
) => Replacement | undefined;

function hasStop(snippet: String): boolean {
    return snippet.includes('$0');
}

// flags: {
//     ['p', 'pub'],
//     ['m', 'mut'],
//     ['a', 'async'],
//     ['b', '&'],
// },

// Elements with no identation from start of line need not have their scope checked,
// as we can assume they are top-level

const lineCompletions: Record<string, LineCompletionHandler[]> = {
    typescript: [
        // top-level element marker
        line =>
            line.is('i') ? { length: 1, snippet: 'import $0' } : undefined,
    ],
    rust: [
        // declare strictly top-level element
        (tape, _) => {
            if (tape.length > 2) {
                return undefined;
            }
            const pub = rust.flags.pub(tape.get(0));
            if (pub && !tape.adv()) {
                return undefined;
            }
            const res = tape.consumeMatch([
                ['u', 'use'],
                ['s', 'struct'],
                ['e', 'enum'],
                ['m', 'macro_rules!'],
            ]);
            if (!res || !tape.isExhausted()) {
                return undefined;
            }
            const [trigger, kword] = res;
            let pre = '';
            if (pub) {
                pre = trigger === 'm' ? '#[macro_export]\n' : pub;
            }
            return {
                length: pub ? 2 : 1,
                snippet: pre + kword + ' ',
                lineBreak: 0,
            };
        },

        // wrap as slice
        (tape, idx) => {
            const rev = tape.slice(0, idx + 1).reversed();
            if (rev.next() !== 's') {
                return undefined;
            }
            const flags = rev.consumeFlags([
                ['r', '&'],
                ['-ad', "'{} "], // if given but no b, assume b
                ['m', 'mut '],
            ]);
            if (tape.next() !== '.') {
                return undefined;
            }
            const target = tape.consumeRustTarget();
            if (!target) {
                return undefined;
            }
            let pre = flags.map(e => e[1]).join('');
            if (pre && pre[0] !== '&') {
                // only `m` flag OR missing `r` flag
                pre = '&' + pre;
            }
            return {
                length: target.length + flags.length + 1,
                snippet: pre + '[' + target + ']',
                lineBreak: 0,
            };
        },

        // declare extern
        (tape, idx) => {
            // x !x px !px p!x
            const rev = tape.slice(0, idx + 1).reversed();
            if (rev.next() !== 's') {
                return undefined;
            }
            const flags = rev.consumeFlags([
                ['p', 'pub '],
                ['!', 'unsafe '],
            ]);
            if (!rev.isExhausted()) {
                // not at start of line
                return undefined;
            }
            let pre = flags.map(e => e[1]).join('');
            return {
                length: flags.length + 1,
                snippet: pre + 'extern ',
                lineBreak: 0,
            };
        },

        // top-level attribute/proc macro
        (tape, idx) => {
            return {
                length: 1,
                snippet: '#[$0]',
                lineBreak: 0,
            }
        },

        // expand #[must_use]
        (tape, idx) => {
            const trigger = 'must use';
            const length = trigger.length;
            const pre = tape.consumeWs();
            const parts = tape.consumeChunks(['#', '[', 'must', 'use', ']']);
            const post = tape.consumeWs();
            if (!tape.isExhausted()) {
                return undefined;
            }
            return {
                length,
                snippet: 'must_use',
                lineBreak: 1,
            }
        }

        // common attribute options
        

        // smart attributes: link() cfg() `no mangle`

        // top-level function

        // top-level element marker with implied visibility
        (tape, idx) => {
            let item: string = rust.nonPubItems[line.get()];
        },
    ],
    // etc.
};

export default lineCompletions;
