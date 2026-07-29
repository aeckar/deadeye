import { RecordSubset, JsKey } from './types'

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
    return entries.map(([key, val], idx) => [idx, [key, val]] as [number, [K, V]])
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
