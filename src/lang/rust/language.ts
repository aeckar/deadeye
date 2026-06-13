import { Language } from '../../lexer_utils';
import Tape from '../../tape';
import { getCloseBracket, getOpenBracket } from '../../text_utils';

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
        if (!tape.isExhausted() && tape.cur() === '.') {
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
            const ch = tape.cur()!;
            if (STOP.includes(ch) || SIGIL.includes(ch)) {
                break;
            }
            const close = getCloseBracket(ch);
            if (close) {
                result += skipBalanced(tape, ch, close);
                continue;
            }
            if (getOpenBracket(ch)) {
                break;
            }
            if (Tape.isWs(ch)) {
                const ws = tape.consumeWs();
                const next = tape.cur();
                if (next !== ':' && next !== '<') {
                    tape.pos -= ws.length; // faster than `putBackWs`
                    break;
                } else if (next === '<') {
                    tape.adv(); // skip `<`
                    result += ws + '<';
                } else {
                    tape.adv(); // skip first `:`
                    if (tape.cur() !== ':') {
                        tape.pos -= ws.length + 1;
                        break;
                    }
                    tape.adv(); // skip second `:`
                    result += ws + '::';
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
            const ch = tape.cur()!;
            if (STOP.includes(ch) || SIGIL.includes(ch)) {
                break;
            }
            const open = getOpenBracket(ch);
            if (open) {
                result = skipBalancedReverse(tape, ch, open) + result;
                continue;
            }
            if (getCloseBracket(ch)) {
                break;
            }
            if (Tape.isWs(ch)) {
                const ws = tape.consumeWs();
                const next = tape.cur();
                if (next !== ':' && next !== '>') {
                    tape.pos -= ws.length; // faster than `putBackWs`
                    break;
                } else if (next === '>') {
                    tape.adv(); // skip `>`
                    result = '>' + ws + result;
                } else {
                    tape.adv(); // skip first `:`
                    if (tape.cur() !== ':') {
                        tape.pos -= ws.length + 1;
                        break;
                    }
                    tape.adv(); // skip second `:`
                    result = '::' + ws + result;
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

export const rust = Language.newInstance({
    keywords: [
        // === Strict Keywords ===
        'as',
        'async',
        'await',
        'break',
        'const',
        'continue',
        'crate',
        'dyn',
        'else',
        'enum',
        'extern',
        'false',
        'fn',
        'for',
        'if',
        'impl',
        'in',
        'let',
        'loop',
        'match',
        'mod',
        'move',
        'mut',
        'pub',
        'ref',
        'return',
        'self',
        'Self',
        'static',
        'struct',
        'super',
        'trait',
        'true',
        'type',
        'unsafe',
        'use',
        'where',
        'while',
        'macro_rules!',

        // === Reserved Keywords ===
        'abstract',
        'become',
        'box',
        'do',
        'final',
        'macro',
        'override',
        'priv',
        'try',
        'typeof',
        'unsized',
        'virtual',
        'yield',

        // === Contextual Keywords ===
        'union', // must be followed by open brace
    ],
    declare: {
        FAT_ARROW: '=>',
        THIN_ARROW: '->',
        PATH_SEP: '::',
        QMARK: '?',
        RANGE_INCL: '..=',
        RANGE: '..',
        STRING: /"[\s\S]*?"/y,
        BYTE_STRING: /b"[\s\S]*?"/y,
        BYTE_CHAR: /b'\\?.'/y,
        FLOAT: new RegExp(
            `[0-9_]+(?:\.[0-9_]+(?:[eE][-+]?[0-9_]+)?)?(?:f(?:32|64|128))?`,
            'y',
        ),
        INTEGER: new RegExp(
            `(?:[0-9_]+|0b[01_]+|0o[0-7_]+|0x[0-9a-fA-F_]+)(?:[iu](?:8|16|32|64|128))?`,
            'y',
        ),
    },
    inherit: [
        Language.BRACKETS,
        Language.ARITHMETIC_ASSIGN,
        Language.REM_ASSIGN,
        Language.BIT_OPS_ASSIGN,
        Language.BOOL_LOGIC,
        Language.C_COMMENTS,
        Language.C_PUNCT,
        Language.C_ID,
        Language.C_CHAR,
    ],
    ignore: /\s/y,
});

export default rust;
