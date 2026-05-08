import { Replacement } from './utils';
import Tape from './tape';
import { rust } from './languages';

import { Range, Position } from 'vscode';

type LineCompletionHandler = (
    tape: Tape,
    cursor: Position,
) => Replacement | undefined;

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

function before(cursor: Position): Range {
    return new Range(
        new Position(cursor.line, 0),
        new Position(cursor.line, cursor.character),
    );
}

function back(fromCh: number, cursor: Position): Range {
    return new Range(
        new Position(cursor.line, cursor.character - fromCh),
        new Position(cursor.line, cursor.character),
    );
}

// Elements with no identation from start of line need not have their scope checked,
// as we can assume they are top-level

const lineCompletions: Record<string, LineCompletionHandler[]> = {
    // typescript: [
    //     // top-level element marker
    //     (tape, cursor) =>
    //         line.is('i') ? { length: 1, snippet: 'import $0' } : undefined,
    // ],
    rust: [
        // declare strictly top-level element
        // eg: ps => 'pub struct '
        (tape, cursor) => {
            if (tape.length > 2) {
                return undefined;
            }
            const pub = rust.pubFlag(tape);
            if (tape.isExhausted()) {
                return undefined;
            }
            const res = tape.consumeMatch([
                ['u', 'use'],
                ['s', 'struct'],
                ['e', 'enum'],
                ['m', 'macro_rules!'],
            ]);
            if (!res || !tape.isExhausted()) {
                // ensures cursor is at trigger after insertion of trigger
                return undefined;
            }
            const [trigger, kword] = res;
            let pre = '';
            if (pub) {
                pre = trigger === 'm' ? '#[macro_export]\n' : pub;
            }
            return {
                target: before(cursor),
                snippet: pre + kword + ' ',
            };
        },

        // wrap as slice
        // eg: u8.amrs => '&'a [u8]'
        (tape, cursor) => {
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
                target: back(rev.pos, cursor),
                snippet: pre + '[' + target + ']',
            };
        },

        // declare extern
        // eg: !px => 'unsafe pub extern '
        (tape, cursor) => {
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
                target: back(rev.pos, cursor),
                snippet: pre + 'extern ',
            };
        },

        // // top-level attribute/proc macro
        // (tape, cursor) => {
        //     return {
        //         length: 1,
        //         snippet: '#[$0]',
        //         lineBreak: 0,
        //     }
        // },

        // expand #[must_use]
        // (tape, cursor) => {
        //     const trigger = 'must use';
        //     const length = trigger.length;
        //     const pre = tape.consumeWs();
        //     const parts = tape.consumeChunks(['#', '[', 'must', 'use', ']']);
        //     const post = tape.consumeWs();
        //     if (!tape.isExhausted()) {
        //         return undefined;
        //     }
        //     return {
        //         length,
        //         snippet: 'must_use',
        //         lineBreak: 1,
        //     }
        // }

        // common attribute options

        // smart attributes: link() cfg() `no mangle`

        // top-level function

        // top-level element marker with implied visibility
        // (tape, cursor) => {
        //     let item: string = rust.nonPubItems[line.get()];
        // },
    ],
    // etc.
};

export default lineCompletions;
