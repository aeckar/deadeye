import { MarkdownString, Range } from "vscode";

/**
 * todo
 *
 * # Implementation
 *
 * because of lack of use cases, save complexity by not allowing sticky completions to
 * have warnings
 */
export type CompletionPrefix = {
    /** */
    readonly preview: MarkdownString;

    /** */
    readonly target: Range;
};

export function registerCompletionPrefixes(
    ...prefixes: CompletionPrefix[]
): CompletionPrefix[] {
    efe;
}
