//! Cursor data structure.
import { Position, Range } from 'vscode';

import { properties, propertiesIndexed } from './misc';
import { Flag, FlagMatch } from './registry_api';
import { isLetter, isLowerLetter, isUpperLetter } from './text_manip';

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

    /** The length of the remaining portion of the tape. */
    get length(): number {
        return Math.max(0, this.raw.length - this.pos);
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

    /** Returns a new instance over the original string. */
    static over(raw: string, pos = 0) {
        return new Tape(raw, pos, false);
    }

    /** Returns true if the given character is space or tab. */
    static isWs(ch: string): boolean {
        return ch === ' ' || ch === '\t';
    }

    /* ================================ Duplication and Slicing ================================ */

    /** Returns a new instance over a slice over the original string. */
    slice(start: number, end = this.raw.length): Tape {
        return Tape.over(this.raw.slice(start, end));
    }

    /** Returns a new instance over the original string up to the position of the cursor. */
    before(cursor: Position): Tape {
        return this.slice(0, cursor.character + 1);
    }

    /** Returns a new instance over the original string starting from the position of the cursor. */
    after(cursor: Position): Tape {
        return this.slice(cursor.character);
    }

    /** Returns a snapshot of this cursor. */
    clone(): Tape {
        return new Tape(this.raw, this.pos, this.isReversed);
    }

    /** Returns a new instance over the remaining string, reversed. */
    reversed(): Tape {
        return new Tape(this.rest().split('').reverse().join(''), 0, true);
    }

    /* ================================ Context-Free Retrieval ================================ */

    /** Returns the character at the given index. */
    get(idx: number): string {
        return this.raw[idx];
    }

    /** Returns a substring over the original slice from the current position. */
    rest(): string {
        return this.raw.slice(this.pos);
    }

    /* ======================================= Iteration ======================================= */

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

    /**
     * Returns the current character, or `undefined` if `pos` is out of bounds.
     *
     * Not to be confused with `peek`, which returns the character *after* the current position.
     */
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

    /**
     * Returns the character at `pos + 1`, or `undefined` if that position is out of bounds.
     *
     * Not to be confused with `cur`, which returns the character at the current position.
     */
    peek(): string | undefined {
        return this.raw[this.pos + 1];
    }

    /** Returns the character at `pos - 1`, or `undefined` if that position is out of bounds. */
    peekBack(): string | undefined {
        return this.raw[this.pos - 1];
    }

    /* ==================================== Pattern Lookup ==================================== */

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

    /* ================================== Pattern Consumption ================================== */

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
            const res = this.raw.slice(this.pos);
            this.pos = this.raw.length;
            return res;
        }
        const res = this.raw.slice(this.pos, end);
        this.pos = end;
        return res;
    }

    /**
     * Consumes the next, possibly empty, sequence of whitespace characters.
     *
     * @return the substring containing whitespace
     */
    consumeWs(): string {
        return this.consume((ch, _) => Tape.isWs(ch));
    }

    /** Consumes the query starting at this position, or returns an empty string. */
    consumeAt(query: string): string {
        if (!this.isAt(query)) {
            return '';
        }
        this.pos += query.length;
        return query;
    }

    /** Consumes the query starting at this position, or returns an empty string. */
    consumeEither(...queries: string[]): string {
        for (const query of queries) {
            if (this.consumeAt(query)) {
                return query;
            }
        }
        return '';
    }

    /**
     * Consumes the next chunks, with whitespace possibly in betweeen them.
     *
     * This is useful for lookahead/lookbehind of potentially delimited language symbols.
     *
     * @return the matches to each chunks, as well as any whitespace between them.
     * If a match to any chunk fails, `undefined` is returned.
     */
    consumeChunks(chunks: string[]): string[] | undefined {
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

    /**
     * Consumes a string of flag characters from the current position according to the given
     * flag-expansion pairs.
     *
     * If more than one flag is matched, the returned array is ordered according to
     * how they were given. If a flag appears more than once, `undefined` is returned.
     *
     * Flags can be given as either a single character or two characters followed by `-`,
     * in which case any character with a code point between the given ones is matched.
     * These range flags can only be matched once for a given entry in `flags`.
     * To determine which specific character was matched,
     *
     * For completion matching, values should have a trailing space.
     *
     * @return the pairs whose flag was matched.
     */
    consumeFlags(
        cursor: Position,
        possibleFlags: { [Key in Flag]?: string },
    ): Map<Flag, FlagMatch> | undefined {
        let expansions: [number, string, Range][] = [];
        while (!this.isExhausted()) {
            let found = false;
            for (const [
                idx,
                { key: flag, value: expansion },
            ] of propertiesIndexed(possibleFlags)) {
                if (!this.cur()) {
                    break;
                }
                const ch = this.cur()!;
                const isRange = flag[0] === '-';
                if (isRange) {
                    if (ch >= flag[1] && ch <= flag[2]) {
                        found = true;
                    }
                } else if (ch === flag) {
                    found = true;
                }
                if (found) {
                    const charPos = cursor.translate(0, -(this.pos + 1));
                    const range = new Range(charPos, charPos.translate(0, 1));
                    this.adv();
                    expansions.push([
                        idx,
                        isRange ? expansion.replaceAll('{}', ch) : expansion,
                        range,
                    ]);
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
        return new Map(
            expansions
                .sort(([idx1], [idx2]) => idx1 - idx2)
                .map(([idx, expansion, range]) => [
                    Object.entries(possibleFlags)[idx][0] as Flag,
                    { expansion, range },
                ]),
        );
    }

    /**
     * Consumes the first key that matches from the list of key-value pairs.
     *
     * For completion matching, values should not have a trailing space.
     *
     * @return the pair whose key matched, or `undefined` if none did.
     */
    consumeMatch(possible: { [Key in string]: string }):
        | [string, string]
        | undefined {
        for (const [k, v] of Object.entries(possible)) {
            if (this.isAt(k)) {
                this.pos += k.length;
                return [k, v];
            }
        }
        return undefined;
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

    /* ================================== Pattern Restoration ================================== */

    /**
     * Decrements `pos` until `pred` returns false for the character at the
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
     * Decrements `pos` until a non-whitespace character is found.
     *
     * If the spanning substring has already be written to a variable,
     * its length should be subtracted from the current position instead for better performance.
     *
     * ```ts
     * tape.pos -= ws.length;
     * ```
     *
     * @return the substring containing whitespace.
     */
    putBackWs(): string {
        return this.putBack((ch, _) => Tape.isWs(ch));
    }

    /* ===================================== Pattern Seek ===================================== */

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

    /* ==================================== Pattern Testing ==================================== */

    /**
     * Returns true if the substring starting at the current position
     * starts with `query`.
     */
    isAt(query: string): boolean {
        return this.raw.startsWith(query, this.pos);
    }

    /**
     * Returns true if this substring starting at the given position
     * starts with `query`. For any letters at the beginning or end of the query,
     * returns false if the adjacent character, if any, is also a letter.
     *
     * This function should **not** be used for general identifiers,
     * because it recognizes underscores, dashes, and trailing digits as boundary markers.
     */
    isAtWord(query: string, pos: number = this.pos): boolean {
        if (!query) {
            return true;
        }
        const idx = this.raw.indexOf(query, pos); // handles out-of-bounds `pos`
        if (isLetter(this.raw[idx])) {
            // check boundary before match
            const prevIdx = idx - 1;
            if (prevIdx >= 0 && isLetter(this.raw[prevIdx])) {
                return false;
            }
        }
        if (isLetter(this.raw[idx + query.length - 1])) {
            // check boundary after match
            const nextIdx = idx + query.length;
            if (nextIdx < this.raw.length && isLetter(this.raw[nextIdx])) {
                return false;
            }
        }
        return true;
    }

    /** Returns true if the character at the given position has clearance on its left side. */
    isLeftClear(pos: number): boolean {
        if (this.isReversed) {
            return this.isRightClear(pos);
        }
        const ch = this.raw[pos - 1];
        return ch === undefined || Tape.isWs(ch);
    }

    /** Returns true if the character at the given position has clearance on its right side. */
    isRightClear(pos: number): boolean {
        if (this.isReversed) {
            return this.isLeftClear(pos);
        }
        const ch = this.raw[pos + 1];
        return ch === undefined || Tape.isWs(ch);
    }

    /**
     * Returns true if the character cluster whose last character is at
     * the current position has the correct clearance to be a closer
     * (has clearance on either side).
     */
    isAnyClear(start: number): boolean {
        return this.isLeftClear(start) || this.isRightClear(this.pos);
    }

    /**
     * Returns true if there are no non-whitespace characters between
     * the given character and the previous newline, the beginning of the input, or
     * itself if it is a newline.
     */
    isPrefix(pos: number): boolean {
        if (this.isReversed) {
            for (let i = pos; i < this.raw.length; i++) {
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
        for (let i = pos; i >= 0; i--) {
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
}
