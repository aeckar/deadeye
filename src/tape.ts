//! Cursor data structure.
import { Position } from 'vscode';

import {
    NonEmptyString,
    isLetter,
    isLowerLetter,
    isUpperLetter,
} from './utils';
import { Flag } from './completion_utils';

/**
 * A lightweight cursor over a string for non-linear parsing.
 *
 * Supports backtracking, lookahead, and paragraph-aware scanning.
 * Clone the tape to snapshot state and try a parsing branch cheaply.
 *
 * Whether a given instance iterates over the original string in reverse
 * is kept as an internal flag. This allows bidirectional parsing of character clusters.
 *
 * Translated from [`tape.rs`](https://github.com/aeckar/draft/blob/main/crates/draft-core/src/tape.rs)
 * by Claude Sonnet 4.6.
 */
export default class Tape {
    readonly raw: string;
    readonly isReversed: boolean;
    pos: number;

    /** Returns a new instance over the original string. */
    static of(raw: string, pos = 0) {
        return new Tape(raw, pos, false);
    }

    private constructor(raw: string, pos: number, isReversed: boolean) {
        this.raw = raw;
        this.pos = pos;
        this.isReversed = isReversed;
    }

    [Symbol.iterator](): Iterator<string> {
        let pos = this.pos;
        const raw = this.raw;
        return {
            next(): IteratorResult<string> {
                if (pos >= raw.length) {
                    return { value: undefined, done: true };
                }
                return { value: raw[pos++], done: false };
            },
        };
    }

    /** The length of the remaining portion of the tape. */
    public get length(): number {
        return Math.max(0, this.raw.length - this.pos);
    }

    /**
     * Consumes the next letter cluster from the current position
     * with clearance and a capital letter in the lowest absolute position.
     */
    consumeCapitalized(): string {
        if (this.isReversed) {
            let rest = this.consume(ch => isLowerLetter(ch));
            let first = this.cur();
            if (!first || !isUpperLetter(first)) {
                return '';
            }
            this.adv();
            return first + rest;
        }
        let first = this.cur();
        if (!first || !isUpperLetter(first)) {
            return '';
        }
        this.adv();
        let rest = this.consume(ch => isLowerLetter(ch));
        return first + rest;
    }

    /** Returns a new instance over a slice over the original string. */
    slice(start: number, end = this.raw.length): Tape {
        return Tape.of(this.raw.slice(start, end));
    }

    /**
     * Returns a new instance in reverse order over the substring from the current position to
     * the position of the cursor.
     */
    before(cursor: Position): Tape {
        return this.slice(0, cursor.character + 1).reversed();
    }

    /** Returns a new instance over the remaining string, reversed. */
    reversed(): Tape {
        return new Tape(this.rest().split('').reverse().join(''), 0, true);
    }

    /**
     * Consumes a string of flag characters from the current position according to the given
     * flag-expansion pairs.
     *
     * @return the pairs whose flag was matched.
     *
     * If more than one flag is matched, the returned array is ordered according to
     * how they were given. If a flag appears more than once, `undefined` is returned.
     */
    consumeFlags(flags: [Flag, string][]): [Flag, string][] | undefined {
        let expansions: [number, string][] = [];
        while (!this.isExhausted()) {
            let found = false;
            for (const [idx, [flag, expansion]] of flags.entries()) {
                if (flag[0] === '-') {
                    // flag is range
                    if (this.cur()! >= flag[1] || this.cur()! <= flag[2]) {
                        found = true;
                    }
                } else if (this.cur() === flag) {
                    found = true;
                }
                if (found) {
                    this.adv();
                    expansions.push([idx, expansion]);
                    break;
                }
            }
            if (!found) {
                if (expansions.length !== 0) {
                    break;
                } else {
                    return undefined;
                }
            }
        }
        return expansions
            .sort(([idx1, _1], [idx2, _2]) => idx1 - idx2)
            .map(([idx, e]) => [flags[idx][0], e]);
    }

    /**
     * Consumes the first key that matches from the list of key-value pairs.
     *
     * @return the pair whose key matched, or `undefined` if none did.
     */
    consumeMatch(strings: [string, string][]): [string, string] | undefined {
        for (const [key, value] of strings) {
            if (this.isAt(key)) {
                this.pos += key.length;
                return [key, value];
            }
        }
        return undefined;
    }

    /** Returns true if the remaining portion and the string are equal. */
    is(query: string | RegExp): boolean {
        if (typeof query === 'string') {
            return this.rest() === query;
        }
        const anchored = new RegExp('^' + query.source + '$', query.flags);
        return anchored.test(this.rest());
    }

    /** Returns the character at the given index. */
    get(idx: number): string {
        return this.raw[idx];
    }

    /** Returns a snapshot of this cursor. */
    clone(): Tape {
        return new Tape(this.raw, this.pos, this.isReversed);
    }

    /** Returns a substring over the original slice from the current position. */
    rest(): string {
        return this.raw.slice(this.pos);
    }

    /**
     * Advances the current position by 1 character.
     *
     * @return true if this results in the tape being exhausted.
     */
    adv() {
        this.pos += 1;
        return this.length === 0;
    }

    /** Decrements the current position by 1 character. */
    dec() {
        this.pos -= 1;
    }

    /** Returns true if the cursor is past the last character. */
    isExhausted(): boolean {
        return this.pos >= this.raw.length;
    }

    /** Returns the current character, or `undefined` if `pos` is out of bounds. */
    cur(): string | undefined {
        return this.raw[this.pos];
    }

    /**
     * Returns the **current** character, if exists, before incrementing the current position.
     *
     * This function is primarily used for iteration.
     * If used for iteration, the current position may be modified concurrently.
     *
     * If the tape is exhausted, `pos` will still be incremented.
     */
    next(): string | undefined {
        const ch = this.raw[this.pos];
        this.pos += 1;
        return ch;
    }

    /** Returns the character at `pos + 1`, or `undefined` if that position is out of bounds. */
    peek(): string | undefined {
        return this.raw[this.pos + 1];
    }

    /** Returns the character at `pos - 1`, or `undefined` if that position is out of bounds. */
    peekBack(): string | undefined {
        return this.raw[this.pos - 1];
    }

    /** Returns the position of the first character returning true, or `undefined`. */
    poll(pred: (ch: string, pos: number) => boolean): number | undefined {
        for (let i = this.pos; i < this.raw.length; i++) {
            if (pred(this.raw[i], i)) {
                return i;
            }
        }
        return undefined;
    }

    /** Returns the position of the last character returning true, or `undefined`. */
    pollBack(pred: (ch: string, pos: number) => boolean): number | undefined {
        for (let i = this.raw.length - 1; i >= this.pos; i--) {
            if (pred(this.raw[i], i)) {
                return i;
            }
        }
        return undefined;
    }

    /**
     * Advance `pos` until `pred` returns false for the character at the
     * current position.
     *
     * Leaves `pos` pointing at the matching character (or at `raw.length` when none matched).
     * @return the substring iterated over.
     */
    consume(pred: (ch: string, pos: number) => boolean): string {
        const end = this.poll((ch, pos) => !pred(ch, pos));
        if (end === undefined) {
            return '';
        }
        const res = this.raw.slice(this.pos, end);
        this.pos = end;
        return res;
    }

    /**
     * Decrement `pos` until `pred` returns false for the character at the
     * current position.
     *
     * Leaves `pos` pointing at the matching character (or at `raw.length` when none matched).
     * @return the substring iterated over.
     */
    putBack(pred: (ch: string, pos: number) => boolean): string {
        const end = this.pollBack((ch, pos) => !pred(ch, pos));
        if (end === undefined) {
            return '';
        }
        const res = this.raw.slice(this.pos, end);
        this.pos = end;
        return res;
    }

    /**
     * Advances `pos` to the first index where `pred` is true.
     *
     * @return `true` if found and `pos` is left pointing at the match,
     * or `false` and `pos` is restored to its original value.
     */
    seek(pred: (ch: string, pos: number) => boolean): boolean {
        const found = this.poll(pred);
        if (found === undefined) {
            return false;
        }
        this.pos = found;
        return true;
    }

    /**
     * Decrements `pos` to the first index where `pred` is true.
     *
     * @return `true` if found and `pos` is left pointing at the match,
     * or `false` and `pos` is restored to its original value.
     */
    seekBack(pred: (ch: string, pos: number) => boolean): boolean {
        const found = this.pollBack(pred);
        if (found === undefined) {
            return false;
        }
        this.pos = found;
        return true;
    }

    /**
     * Returns true if the substring starting at the current position
     * starts with the given string.
     */
    isAt(query: string): boolean {
        return this.raw.startsWith(query, this.pos);
    }

    /**
     * Advances `pos` to where `query` is found.
     *
     * @return `true` if found and `pos` is left pointing at the match,
     * or `false` and `pos` is restored to its original value.
     */
    seekAt(query: string): boolean {
        const idx = this.raw.indexOf(query, this.pos);
        if (idx === -1) {
            return false;
        }
        this.pos = idx;
        return true;
    }

    /** Returns true if the given character is space or tab. */
    static isWs(ch: string): boolean {
        return ch === ' ' || ch === '\t';
    }

    /** Consumes the query starting at this position, or returns an empty string. */
    consumeAt(query: NonEmptyString): string {
        if (!this.isAt(query)) {
            return '';
        }
        this.pos += query.length;
        return query;
    }

    /**
     * Consumes the next chunks, with whitespace possibly in betweeen them.
     *
     * @return the matches to each chunks, as well as any whitespace between them.
     * If a match to any chunk fails, `undefined` is returned.
     */
    consumeChunks(chunks: NonEmptyString[]): string[] | undefined {
        const start = this.pos;
        let parts = [];
        for (const [idx, chunk] of chunks.entries()) {
            let next = this.consumeAt(chunk);
            if (!next) {
                this.pos = start;
                return undefined;
            }
            parts.push(next);
            if (idx !== chunks.length - 1) {
                parts.push(this.consumeWs());
            }
        }
        return parts;
    }

    /** Consumes the next, possibly empty, sequence of whitespace characters. */
    consumeWs(): string {
        return this.consume((ch, _) => Tape.isWs(ch));
    }

    /** Returns true if the character at the given position has clearance on its left side. */
    isLeftClear(pos: number): boolean {
        const ch = this.raw[pos - 1];
        return ch === undefined || Tape.isWs(ch);
    }

    /** Returns true if the character at the given position has clearance on its right side. */
    isRightClear(pos: number): boolean {
        const ch = this.raw[pos + 1];
        return ch === undefined || Tape.isWs(ch);
    }

    /**
     * Returns true if the character cluster whose last character is at
     * the current position has the correct clearance to be a closer
     * (has clearance on either side).
     */
    isAnyClear(start: number): boolean {
        return !this.isLeftClear(start) || this.isRightClear(this.pos);
    }

    /**
     * Returns true if there are no non-whitespace characters between
     * the given character and the previous newline, the beginning of the input, or
     * itself if it is a newline.
     */
    isPrefix(pos: number): boolean {
        for (let i = pos - 1; i >= 0; i--) {
            const ch = this.raw[i];
            if (ch === '\n') {
                return true;
            }
            if (!Tape.isWs(ch)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Returns true if the current character belongs to a line prefix.
     *
     * A character is part of a line prefix if there are no non-whitespace characters between
     * the current character and the previous newline, the beginning of the input, or
     * itself if it is a newline.
     */
    isCurPrefix(): boolean {
        return this.isPrefix(this.pos);
    }

    /**
     * Returns the number of times the current line is indented.
     *
     * Counts the number of tabs or the number of space characters divided by 4 (floored).
     */
    countIndent(): number {
        const lineStart = this.pollBack(ch => ch === '\n') ?? 0;
        const ws = this.raw.slice(lineStart, this.pos);
        let tabs = 0,
            spaces = 0;
        for (const ch of ws) {
            if (ch === '\t') {
                tabs++;
            } else if (ch === ' ') {
                spaces++;
            }
        }
        return tabs + Math.floor(spaces / 4);
    }
}
