//! For more information, see https://github.com/alexbol99/flatten-interval-tree.
import type IntervalTreeClass from '@flatten-js/interval-tree' with {
    'resolution-mode': 'import',
}

/**
 * Structural type of `Node` from
 * [@flatten-js/interval-tree](https://github.com/alexbol99/flatten-interval-tree/blob/master/src/classes/Node.ts).
 */
export type IntervalNode<V> = {
    key: {
        low: number
        high: number
        output: () => [number, number] | unknown
    } | null
    values: V[]
    left: IntervalNode<V> | null
    right: IntervalNode<V> | null
    parent: IntervalNode<V> | null
    color: number
    max: { low: number; high: number }
}

/**
 * Structural type of `IntervalTree` from
 * [@flatten-js/interval-tree](https://github.com/alexbol99/flatten-interval-tree/blob/master/src/classes/IntervalTree.ts).
 */
export type IntervalTree<V> = {
    root: IntervalNode<V> | null
    nil_node: IntervalNode<V>

    readonly size: number
    readonly keys: unknown[]
    readonly values: V[]
    readonly items: Array<{ key: unknown; value: V }>

    isEmpty(): boolean
    clear(): void
    insert(key: [number, number] | unknown, value?: V): IntervalNode<V> | undefined
    exist(key: [number, number] | unknown, value?: V): boolean
    remove(key: [number, number] | unknown, value?: V): IntervalNode<V> | undefined
    search(interval: [number, number] | unknown): V[]
    search<T>(
        interval: [number, number] | unknown,
        outputMapperFn: (value: V, key: unknown) => T,
    ): T[]
    intersect_unknown(interval: [number, number] | unknown): boolean
    forEach(visitor: (key: unknown, value: V) => void): void
    map<U>(callback: (value: V, key: unknown) => U): IntervalTree<U>
    iterate(interval?: [number, number] | unknown): IterableIterator<V>
}

export class IntervalTreeService {
    private static ctor?: typeof IntervalTreeClass

    private constructor() {}

    /**
     * To use interval trees, call this once during application boot or module initialization.
     * This imports the library module at runtime.
     *
     * This is is required due to conflicts between this extension (which uses CommonJS modules),
     * and `@flatten-js/interval-tree` (which uses modern ESM modules).
     * The caveat, though, is that we lose IntelliSense for each instance returned by the factory.
     */
    public static async start(): Promise<void> {
        if (!IntervalTreeService.ctor) {
            const module = await import('@flatten-js/interval-tree')
            IntervalTreeService.ctor = module.default
        }
    }

    public static newInstance<V>(): IntervalTree<V> {
        if (!IntervalTreeService.ctor) {
            throw new Error(
                'IntervalTree class has not been loaded yet. ' +
                    'Please await IntervalTree.init() first.',
            )
        }
        return new IntervalTreeService.ctor<V>() as IntervalTree<V>
    }
}
