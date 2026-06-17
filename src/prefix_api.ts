import { MarkdownString, Range } from 'vscode';
import { ScopedCompletionContext } from './completion_api';

/** Contains all prefixes for each sticky completion of given language, grouped by trigger. */
export type PrefixRegistry = Map<string, Prefix> & {
    __brand: 'PrefixRegistry';
};

/**
 * # Namespace
 *
 * Provides `newInstance` as a custom initializer.
 */
export namespace PrefixRegistry {
    /**
     * Initializes a prefix family for each configuration,
     * then stores each in a map, grouped by trigger.
     */
    export function newInstance<ScopeKind extends string>(
        ...prefixes: PrefixFamilyCtorArgs<ScopeKind>[]
    ): PrefixRegistry {
        const byTrigger = new Map() as PrefixRegistry;
        for (const args of prefixes) {
            const family = new PrefixFamily(args);
            if (!byTrigger.has(family.trigger)) {
                byTrigger.set(family.trigger, [family]);
            } else {
                byTrigger.get(family.trigger)!.push(family);
            }
        }
        return byTrigger as PrefixRegistry;
    }
}

export type PrefixResolver<ScopeKind extends string> = (
    ctx: ScopedCompletionContext<ScopeKind>,
) => Prefix | undefined;

export type PrefixFamilyCtorArgs<ScopeKind extends string> = {
    id: string;
    resolver: PrefixResolver<ScopeKind>;
};

export class PrefixFamily {
    /**
     * A short description in Markdown, generated dynamically
     * to explain to user exactly what the shorthand does when triggered. This documentation appears
     * next to the cursor shortly after the shorthand is detected but before it is triggered.
     * 
     * MAIN DOCS ARE HERE
     */
    readonly docs: MarkdownString;

    /**
     * The minimum number of previous, consecutive character insertions
     * for a match to this shorthand to be valid. This is an optimization, often the minimum number
     * of characters for the base case. Can be assigned `NaN` so this shorthand is always checked.
     */
    readonly minLookbehind: number;

    /**
     * The possible scope trees required for this shorthand to match.
     *
     * If assigned an empty array, this shorthand matches in every scope.
     */
    readonly scoping: ScopeTree<ScopeKind>[];

    /** The logic used to match this shorthand to a dynamic, context-aware completion. */
    readonly resolver: CompletionResolver<ScopeKind>;

    constructor(args: PrefixFamilyCtorArgs) {
        
    }
}

/**
 * todo
 *
 * # Implementation
 *
 * Because completion prefixes are pivotal to only a select number of completions,
 * we save complexity by not allowing sticky completions (completions with prefixes)
 * to give warnings if the flags given as a part of the prefix are invalid.
 *
 * This is in contrast to regular completions, which have their invalid portions highlighted
 * and mentioned in hints.
 *
 * Changed name from `CompletionPrefix` to `Prefix` to reduce length of derived type names.
 */
export type Prefix = {
    /** */
    readonly preview: MarkdownString;

    /** */
    readonly target: Range;
};
