import { Interval } from '@/services/interval_tree_service'

/** Returns a copy of this string when reversed. */
export function reverse(s: string): string {
    return s.split('').reverse().join('')
}

/** Left or right. */
export type Direction = 'left' | 'right'

/** A range of indices. */
export class Span {
    /** The index of the first element. */
    readonly begin: number

    /** The index of the last element (exclusive). */
    readonly end: number

    /**
     * The interval between the indices of the first and last elements (exclusive).
     *
     * # Implementation
     *
     * This property is implemented as a field instead of a getter to
     * avoid allocating a new array each time.
     */
    readonly interval: Interval

    constructor(begin: number, end: number) {
        this.begin = begin
        this.end = end
        this.interval = [this.begin, this.end]
    }

    get length() {
        return this.end - this.begin
    }

    toString(): string {
        return `(${this.begin}:${this.end})`
    }

    includes(idx: number): boolean {
        return idx >= this.begin && idx < this.end
    }
}
