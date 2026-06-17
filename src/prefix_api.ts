import { MarkdownString, Range } from 'vscode';
import { ScopedCompletionContext } from './family_api';

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
    }
}

export type PrefixResolver<ScopeKind extends string> = (
    ctx: ScopedCompletionContext<ScopeKind>,
) => Prefix | undefined;

export type PrefixFamilyCtorArgs<ScopeKind extends string> = {
    id: string;
    resolver: PrefixResolver<ScopeKind>;
};

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
