//! For more information, see https://github.com/alexbol99/flatten-interval-tree.
import type IntervalTreeClass from '@flatten-js/interval-tree' with {
    'resolution-mode': 'import',
}

/**
 * A numeric interval (exclusive).
 *
 * Can be passed to methods in {@link IntervalTree}.
 *
 * `IntervalInput` and `Comparable` from `@flatten-js/interval-tree` are not used.
 * Since only a 1-dimensional interval tree is used,
 * all intervals are represented internally as `[number, number]`,
 * so we are allowed to cast them as {@link Interval}.
 *
 * @see {@link ReadOnlyIntervalTree}
 */
export type Interval = readonly [number, number]

/**
 * Mutable facade over `IntervalTree` from
 * [@flatten-js/interval-tree](https://github.com/alexbol99/flatten-interval-tree/blob/master/src/classes/IntervalTree.ts).
 *
 * @see {@link ReadOnlyIntervalTree}
 * @see {@link Interval}
 */
export type IntervalTree<V> = ReadOnlyIntervalTree<V> & {
    clear(): void
    insert(key: Interval, value?: V): void
    remove(key: Interval, value?: V): void
}

/**
 * Read-only facade over `IntervalTree` from
 * [@flatten-js/interval-tree](https://github.com/alexbol99/flatten-interval-tree/blob/master/src/classes/IntervalTree.ts).
 *
 * To convert to a read-only tree, use the `as` operator with this type.
 *
 * @see {@link IntervalTree}
 * @see {@link Interval}
 */
export type ReadOnlyIntervalTree<V> = {
    readonly size: number
    readonly keys: readonly Interval[]
    readonly values: readonly V[]
    readonly items: readonly { key: Interval; value: V }[]

    isEmpty(): boolean
    exist(key: Interval, value?: V): boolean
    search(interval: Interval): V[]
    forEach(visitor: (key: Interval, value: V) => void): void
}

/** Search for all items at a given index. */
export function itemsAt<V>(tree: IntervalTree<V>, idx: number): V[] {
    return tree.search([idx, idx])
}

/**
 * Imports the library module for `@flatten-js/interval-tree`
 * and provides a factory function for {@link IntervalTree}.
 */
class IntervalTreeService {
    private static CTOR?: typeof IntervalTreeClass

    private constructor() {}

    /**
     * To use instances of {@link IntervalTree}, call this once
     * during application boot or module initialization.
     * This imports the library module at runtime.
     *
     * This is is required due to conflicts between this extension (which uses CommonJS modules),
     * and `@flatten-js/interval-tree` (which uses modern ESM modules).
     * The caveat, though, is that we lose IntelliSense for each instance returned by the factory.
     * 
     * To prevent bugs, **this should be called as soon as possible**.
     */
    public static async start(): Promise<void> {
        if (!IntervalTreeService.CTOR) {
            const module = await import('@flatten-js/interval-tree')
            IntervalTreeService.CTOR = module.default
        }
    }

    public static newInstance<V>(): IntervalTree<V> {
        if (!IntervalTreeService.CTOR) {
            throw new Error(
                'IntervalTree class has not been loaded yet. ' +
                    'Please await IntervalTreeService.start() first',
            )
        }
        return new IntervalTreeService.CTOR<V>() as IntervalTree<V>
    }
}

export default IntervalTreeService