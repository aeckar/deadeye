import { CLOSE_TO_OPEN, OPEN_TO_CLOSE } from '@/utils';

import Tape from '../../tape';

const STOP = '=,{};';
const SIGIL = '&*!+-';

/**
 * Consumes a Rust type/path target from the current tape position.
 *
 * Handles:
 * - Paths and identifiers: `foo`, `foo::bar`, `foo::<T>`
 * - Balanced delimiters: `<T, U>`, `(A, B)`, `[T]`
 * - Chained access: `foo.bar`, `foo.0`
 * - Reversed tape (reads right-to-left, mirroring all delimiter logic)
 *
 * Stops before:
 * - Sigils that prefix a new target: `&`, `&mut`, `*`, `!`, `+`, `-`
 * - Separators and block openers: `=`, `,`, `{`, `}`, `;`
 * - Whitespace not followed by a path continuation (`::` or `<`)
 *
 * @todo Check for edge cases: `->` in fn pointers, lifetimes (`'a`), `impl`/`dyn` bounds
 */
export function consumeRustTarget(tape: Tape): string {
    function skipBalanced(tape: Tape, open: string, close: string): string {
        let depth = 0;
        let chunk = '';
        while (!tape.isExhausted()) {
            const ch = tape.next();
            chunk += ch;
            if (ch === open) {
                depth++;
            } else if (ch === close) {
                depth--;
                if (depth === 0) {
                    break;
                }
            }
        }
        if (!tape.isExhausted() && tape.peek() === '.') {
            chunk += tape.next();
        }
        return chunk;
    }

    function skipBalancedReverse(
        tape: Tape,
        close: string,
        open: string,
    ): string {
        let depth = 0;
        let chunk = '';
        while (!tape.isExhausted()) {
            const ch = tape.next();
            chunk = ch + chunk;
            if (ch === close) {
                depth++;
            } else if (ch === open) {
                depth--;
                if (depth === 0) {
                    break;
                }
            }
        }
        return chunk;
    }

    function consumeForward(tape: Tape): string {
        let result = '';
        while (!tape.isExhausted()) {
            const ch = tape.peek()!;
            if (STOP.includes(ch) || SIGIL.includes(ch)) {
                break;
            }
            if (ch in OPEN_TO_CLOSE) {
                result += skipBalanced(tape, ch, OPEN_TO_CLOSE[ch]);
                continue;
            }
            if (ch in CLOSE_TO_OPEN) {
                break;
            }
            if (Tape.isWs(ch)) {
                const ws = tape.consumeWs();
                const next = tape.peek();
                if (next === ':' || next === '<') {
                    result += ws;
                } else {
                    tape.pos -= ws.length;
                    break;
                }
                continue;
            }
            result += tape.next();
        }
        return result;
    }

    function consumeReversed(tape: Tape): string {
        let result = '';
        while (!tape.isExhausted()) {
            const ch = tape.peek()!;
            if (STOP.includes(ch) || SIGIL.includes(ch)) {
                break;
            }
            if (ch in CLOSE_TO_OPEN) {
                result =
                    skipBalancedReverse(tape, ch, CLOSE_TO_OPEN[ch]) + result;
                continue;
            }
            if (ch in OPEN_TO_CLOSE) {
                break;
            }
            if (Tape.isWs(ch)) {
                const ws = tape.consumeWs();
                const next = tape.peek();
                if (next === ':' || next === '>') {
                    result = ws + result;
                } else {
                    tape.pos -= ws.length;
                    break;
                }
                continue;
            }
            result = tape.next() + result;
        }
        return result;
    }

    if (tape.isReversed) {
        return consumeReversed(tape);
    }
    return consumeForward(tape);
}
