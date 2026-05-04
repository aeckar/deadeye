/**
 * A lightweight cursor over a string for non-linear parsing.
 *
 * Supports backtracking, lookahead, and paragraph-aware scanning.
 * Clone the tape to snapshot state and try a parsing branch cheaply.
 *
 * Translated from [`tape.rs`](https://github.com/aeckar/draft/blob/main/crates/draft-core/src/tape.rs)
 * by Claude Sonnet 4.6.
 */
export class Tape {
    readonly raw: string;
    pos: number;

    constructor(raw: string, pos = 0) {
        this.raw = raw;
        this.pos = pos;
    }

    /** Returns a snapshot of this cursor. */
    clone(): Tape {
        return new Tape(this.raw, this.pos);
    }

    /** Returns a substring over the original slice from the current position. */
    rest(): string {
        return this.raw.slice(this.pos);
    }

    /** Advances the current position by 1 character. */
    adv() {
        this.pos += 1;
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
     * Returns the substring iterated over.
     */
    consume(pred: (ch: string, pos: number) => boolean): string {
        const end = this.poll((ch, pos) => !pred(ch, pos));
        if (end === undefined) {
            return "";
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
     * Returns the substring iterated over.
     */
    putBack(pred: (ch: string, pos: number) => boolean): string {
        const end = this.pollBack((ch, pos) => !pred(ch, pos));
        if (end === undefined) {
            return "";
        }
        const res = this.raw.slice(this.pos, end);
        this.pos = end;
        return res;
    }

    /**
     * Advances `pos` to the first index where `pred` is true.
     *
     * Returns `true` if found and `pos` is left pointing at the match,
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
     * Returns `true` if found and `pos` is left pointing at the match,
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
     * Returns `true` if found and `pos` is left pointing at the match,
     * or `false` and `pos` is restored to its original value.
     *
     * Optimized using Two-Way search algorithm.
     */
    seekAt(query: string): boolean {
        const idx = this.raw.indexOf(query, this.pos);
        if (idx === -1) {
            return false;
        }
        this.pos = idx;
        return true;
    }

    private isWs(ch: string): boolean {
        return ch === " " || ch === "\t";
    }

    /** Returns true if the character at the given position has clearance on its left side. */
    isLeftClear(pos: number): boolean {
        const ch = this.raw[pos - 1];
        return ch === undefined || this.isWs(ch);
    }

    /** Returns true if the character at the given position has clearance on its right side. */
    isRightClear(pos: number): boolean {
        const ch = this.raw[pos + 1];
        return ch === undefined || this.isWs(ch);
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
            if (ch === "\n") {
                return true;
            }
            if (!this.isWs(ch)) {
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
        const lineStart = this.pollBack((ch) => ch === "\n") ?? 0;
        const ws = this.raw.slice(lineStart, this.pos);
        let tabs = 0,
            spaces = 0;
        for (const ch of ws) {
            if (ch === "\t") {
                tabs++;
            } else if (ch === " ") {
                spaces++;
            }
        }
        return tabs + Math.floor(spaces / 4);
    }
}
