//! Miscellaneous utilities.
import {
    Position,
    Range,
    Selection,
    TextDocument,
    TextEditor,
    TextEditorEdit,
} from 'vscode'
import { Interval } from './services/interval_tree_service'

// =============================================================================================
// Strings
// =============================================================================================

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
        return `${this.begin}..${this.end}`
    }

    includes(idx: number): boolean {
        return idx >= this.begin && idx < this.end
    }
}

// =============================================================================================
// Advanced Types
// =============================================================================================

/**
 * An immutable record whose key values are not exhaustive of type `K`.
 *
 * For example, if `K` is a string union, instances of this type do not need to account
 * for all possible entries.
 */
export type RecordSubset<K extends JsKey, V> = { readonly [Key in K]?: V }

/** Removes a common prefix from a string literal type. */
export type RemovePrefix<
    Prefix extends string,
    T extends string,
> = T extends `${Prefix}${infer Suffix}` ? Suffix : T

/**
 * Evaluates to a string union of all public member keys.
 *
 * Strips "__" from members marked as internal.
 */
export type Member<T> = RemovePrefix<
    '__',
    Exclude<keyof T, 'prototype'> & string
>

// =============================================================================================
// VS Code Ranges
// =============================================================================================

export function insert(
    pos: Position,
    text: string,
): (editBuilder: TextEditorEdit) => void {
    return editBuilder => {
        editBuilder.insert(pos, text)
    }
}

/**
 * Translates offsets to `vscode` data structures over text documents.
 * 
 * Resolving line-character positions from indices incurs a small
 * performance hit--**use this class with caution**.
 */
export class DocumentContext {
    constructor(private readonly document: TextDocument) {}

    /** Returns the `Position.line` number for the position at the given offset. */
    line(offset: number): number {
        return this.pos(offset).line
    }

    /** Returns the absolute `Position` for the given offset */
    pos(offset: number): Position {
        return this.document.positionAt(offset)
    }

    /** Returns the absolute `Range` for the given offsets. */
    range(begin: number, end: number): Range {
        return new Range(this.pos(begin), this.pos(end))
    }

    /** Returns the absolute `Selection` for the given offsets. */
    selection(begin: number, end: number = begin): Selection {
        return new Selection(this.pos(begin), this.pos(end))
    }

    /**
     * Performs the text insertion by converting the given offset to an absolute `Position`.
     *
     * Returns true if the operation succeeded.
     */
    async insert(
        offset: number,
        text: string,
        editor: TextEditor,
    ): Promise<boolean> {
        return editor.edit(editBuilder => {
            editBuilder.insert(this.pos(offset), text)
        })
    }

    /**
     * Performs the text insertion by converting the given offsets to an absolute `Selection`.
     *
     * Returns true if the operation succeeded.
     */
    async delete(
        begin: number,
        end: number,
        editor: TextEditor,
    ): Promise<boolean> {
        return editor.edit(editBuilder => {
            editBuilder.delete(this.selection(begin, end))
        })
    }
}

// todo doc
export function rangeBefore(
    cursor: Position,
    from: number = cursor.character,
): Range {
    if (from < 0) {
        // otherwise, would silently fail
        throw new RangeError(`'from' must be non-negative, got ${from}`)
    }
    if (from > cursor.character) {
        throw new RangeError(
            `'from' (${from}) exceeds cursor character position (${cursor.character})`,
        )
    }
    return new Range(
        new Position(cursor.line, cursor.character - from),
        new Position(cursor.line, cursor.character),
    )
}

// todo doc
export function after(cursor: Position, skip: number = 0): Position {
    return new Position(cursor.line, cursor.character + skip + 1)
}

// =============================================================================================
// Type-Safe Record Iteration
// =============================================================================================

/** A valid key in a JavaScript object. */
export type JsKey = string | number | symbol

/**
 * Collects each key-value pair in the given object and yields each preceded by its index.
 *
 * Unlike {@link Object.entries}, encourages type safety and allows for type inference.
 * Can be used for indexed iteration.
 *
 * # API
 *
 * Instead of a nominal type, properties are returned as tuples,
 * which have proven to be more ergonomic.
 *
 * @see {@link entries}
 */
export function enumerate<K extends number | string | symbol, V>(
    o: RecordSubset<K, V>,
): [number, [K, V]][] {
    // Object.entries returns [string, unknown][], so cast to the expected types
    const entries = Object.entries(o) as unknown as [K, V][]
    return entries.map(
        ([key, val], idx) => [idx, [key, val]] as [number, [K, V]],
    )
}

/**
 * Returns all entries of the object as a typed array.
 *
 * Unlike {@link Object.entries}, encourages type safety and allows for type inference.
 *
 * # API
 *
 * Instead of a nominal type, properties are returned as tuples,
 * which have proven to be more ergonomic.
 *
 * @see {@link enumerate}
 */
export function entries<K extends JsKey, V>(o: Record<K, V>): [K, V][] {
    return (Object.entries(o) as [K, V][]).map(([key, val]) => {
        return [key, val]
    })
}

// =============================================================================================
// Collections
// =============================================================================================

/**
 * Compares two values.
 *
 * Returns:
 * - -1 if `cur` is less than `next`
 * - 0 if `cur` and `next` are equal
 * - 1 if `cur` is greater than `next`
 *
 * According to ECMA-262 Section 23.1.3.30,
 * all sorting functions provided by JavaScript are stable.
 */
export type Comparator<T> = (cur: T, next: T) => number

/** Concatenates all values to a string in the same order they were inserted. */
export function joinValues<K, V>(map: Map<K, V>): string {
    return [...map].map(([_, sub]) => sub).join('')
}

/**
 * Returns a map, sorted using the given comparators in order, for the given entries.
 *
 * As guaranteed by ECMA-262 Section 24.1, the order of map entries is persistent.
 * This enables preemptive sorting of entries using `compareFn`.
 */
export function rebindToMap<K extends JsKey, V>(
    o: Record<K, V>,
    sortBy?: Comparator<[K, V]>,
): Map<K, V> {
    let props = Object.entries(o) as unknown as [K, V][]
    if (sortBy) {
        props = props.sort(sortBy)
    }
    return props.reduce((sorted, [key, val]) => {
        sorted.set(key, val)
        return sorted
    }, new Map())
}

/**
 * Returns a comparator that maps every entry in a collection to a weight value,
 * where higher weights are placed after lower ones when recombined into a sorted collection.
 *
 * Generally, negating the closure return value causes the output to be sorted in descending order.
 *
 * @see {@link rebindToMap}
 */
export function sortBy<T>(keyMap: (entry: T) => number): Comparator<T> {
    return (cur, next) => keyMap(cur) - keyMap(next)
}
