import { Position, Range } from 'vscode';

// use record
// use `keyof any`



function createExclusiveTupleFriendly<T extends any[]>(
    ...args: T & UniqueKeys<T>
): T {
    return args;
}

/**
 * Compares two values.
 *
 * Returns:
 * - -1 if `cur` is less than `next`
 * - 0 if `cur` and `next` are equal
 * - 1 if `cur` is greater than `next`
 */
export type Comparator<T> = (cur: T, next: T) => number;

/** A key-value pair that may exist as an entry in a JavaScript object. */
export class Property<K extends keyof any, V> {
    readonly key: K;
    readonly value: V;

    constructor(key: K, value: V) {
        this.key = key;
        this.value = value;
    }

    static from<K extends keyof any, V>(arr: [K, V]): Property<K, V> {
        return new Property(arr[0], arr[1]);
    }

    toArray(): [K, V] {
        return [this.key, this.value];
    }
}

export function rangeBefore(
    cursor: Position,
    from: number = cursor.character,
): Range {
    if (from < 0) {
        // otherwise, would silently fail
        throw new RangeError(`'from' must be non-negative, got ${from}`);
    }
    if (from > cursor.character) {
        throw new RangeError(
            `'from' (${from}) exceeds cursor character position (${cursor.character})`,
        );
    }
    return new Range(
        new Position(cursor.line, cursor.character - from),
        new Position(cursor.line, cursor.character),
    );
}
export function after(cursor: Position, skip: number = 0): Position {
    return new Position(cursor.line, cursor.character + skip + 1);
} /**
 * Collects each key-value pair in the given object and returns
 * an array of each paired to its index.
 *
 * Most often used for indexed iteration.
 */

export function enumerate<K extends number | string | symbol, V>(o: {
    [T in K]?: V;
}): [number, [K, V]][] {
    // Object.entries returns [string, unknown][], so cast to the expected types
    const entries = Object.entries(o) as unknown as [K, V][];
    return entries.map(
        ([key, val], idx) => [idx, [key, val]] as [number, [K, V]],
    );
}

/**
 * Returns all entries of the object as a typed array.
 *
 * Unlike {@link Object.entries}, encourages type safety and allows for type inference.
 */
export function entries<K extends keyof any, V>(
    o: Record<K, V>,
): Property<K, V>[] {
    return (Object.entries(o) as [K, V][]).map(([k, v]) => {
        return new Property(k, v);
    });
}

/**
 * Returns the value paired to the key matching the query, or `undefined` if none exists.
 *
 * For completion matching, values should not have a trailing space.
 */
export function match<K extends keyof any, V>(
    query: K,
    possible: Record<K, V>,
): Property<K, V> | undefined {
    for (const entry of entries(possible)) {
        if (query === entry.key) {
            return entry;
        }
    }
    return undefined;
}

/**
 * Returns a map, sorted using the given comparator, for the given entries.
 *
 * As guaranteed by ECMA-262 Section 24.1, the order of map entries is persistent.
 * This enables preemptive sorting of entries using `compareFn`.
 */
export function map<K extends keyof any, V>(
    o: Record<K, V>,
    compareFn?: Comparator<Property<K, V>>,
): Map<K, V> {
    let jsEntries = entries(o);
    if (compareFn) {
        jsEntries = jsEntries.sort(compareFn);
    }
    return jsEntries.reduce((sorted, { key, value }) => {
        sorted.set(key, value);
        return sorted;
    }, new Map());
}

/**
 * Returns a comparator that maps every entry in a collection to a weight value,
 * where higher weights are placed before lower ones when recombined into a sorted collection.
 */
export function sortBy<K extends keyof any, V>(
    keyMap: (entry: Property<K, V>) => number,
): Comparator<Property<K, V>> {
    return (cur, next) => keyMap(cur) - keyMap(next);
}
