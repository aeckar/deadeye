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

const lineCompletions: Record<string, LineCompletionHandler[]> = {
    typescript: [
        // top-level element marker
        line =>
            line.is('i') ? { length: 1, snippet: 'import $0' } : undefined,
    ],
    rust: [
        // strictly top-level elements
        // these elements have no identation, so no need to check scope
        (tape, _) => {
            if (tape.length > 2) {
                return undefined;
            }
            const pub = rust.flags.pub(tape.head());
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
                snippet: `${pre}${kword} `,
            };
        },

        //slice
        (tape, idx) => {
            const rev = tape.reversed();
            if (rev.next() !== 's') {
                return undefined;
            }
            let [flagCount, flags] = rev.consumeFlags([
                ['r', '&'],
                ['-ad', "'{} "], // if given but no b, assume b
                [['mr', 'm', 'rm'], 'mut '],
            ]);
            if (tape.next() !== '.') {
                return undefined;
            }
            let target = tape.consumeRustTarget();
            if (!target) {
                return undefined;
            }
            let pre = flags.map(res => res[1]).join('');
            if (tape.next() !== 's' || !tape.isExhausted()) {
                return undefined;
            }
            return {
                length: target.length + flagCount + 1,
                snippet: `${pre}[${target}]`,
            };
        },

        // extern
        (tape, idx) => {
            // x !x px !px p!x
        },

        // top-level attribute/proc macro
        (tape, idx) => {
            line.head();
        },

        // unsafe by !
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
