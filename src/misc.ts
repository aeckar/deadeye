//! Utilities generalizable to most other projects.
import { Position, Range } from 'vscode';
import { Scope } from './scope_resolver_utils';

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
export type Comparator<T> = (cur: T, next: T) => number;

/** A range of indices. */
export class Span {
    /** The index of the first element. */
    begin: number;

    /** The index of the last element (exclusive). */
    end: number;

    constructor(begin: number, end: number) {
        this.begin = begin;
        this.end = end;
    }

    get length() {
        return this.end - this.begin;
    }

    withScope<ScopeKind extends string>(kind: ScopeKind): Scope<ScopeKind> {
        return new Scope(kind, this.begin, this.end);
    }
}

/**
 * A key-value pair that may exist as an entry in a JavaScript object.
 *
 * Use of this class over standard 2-tuples encourages conciseness,
 * especially when the key and value cannot be easily discerned from their types.
 */
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
}

/**
 * Collects each key-value pair in the given object and yields each preceded by its index.
 *
 * Most often used for indexed iteration.
 */
export function propertiesIn<K extends number | string | symbol, V>(o: {
    [T in K]?: V;
}): [number, Property<K, V>][] {
    // Object.entries returns [string, unknown][], so cast to the expected types
    const entries = Object.entries(o) as unknown as [K, V][];
    return entries.map(
        ([key, val], idx) =>
            [idx, new Property(key, val)] as [number, Property<K, V>],
    );
}

/**
 * Returns all entries of the object as a typed array.
 *
 * Unlike {@link Object.entries}, encourages type safety and allows for type inference.
 */
export function properties<K extends keyof any, V>(
    o: Record<K, V>,
): Property<K, V>[] {
    return (Object.entries(o) as [K, V][]).map(([k, v]) => {
        return new Property(k, v);
    });
}

/** Collects each character in the given string and yields it preceded by its index. */
export function* charsIn(s: string): Generator<[number, string]> {
    for (let idx = 0; idx < s.length; idx++) {
        yield [idx, s[idx]];
    }
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
    for (const prop of properties(possible)) {
        if (query === prop.key) {
            return prop;
        }
    }
    return undefined;
}

/**
 * Returns a map, sorted using the given comparators in order, for the given entries.
 *
 * As guaranteed by ECMA-262 Section 24.1, the order of map entries is persistent.
 * This enables preemptive sorting of entries using `compareFn`.
 */
export function map<K extends keyof any, V>(
    o: Record<K, V>,
    ...compareFns: Comparator<Property<K, V>>[]
): Map<K, V> {
    let props = properties(o);
    for (const compareFn of compareFns) {
        props = props.sort(compareFn);
    }
    return props.reduce((sorted, { key, value }) => {
        sorted.set(key, value);
        return sorted;
    }, new Map());
}

/**
 * Returns a comparator that maps every entry in a collection to a weight value,
 * where higher weights are placed after lower ones when recombined into a sorted collection.
 */
export function sortBy<K extends keyof any, V>(
    keyMap: (entry: Property<K, V>) => number,
): Comparator<Property<K, V>> {
    return (cur, next) => keyMap(cur) - keyMap(next);
}
