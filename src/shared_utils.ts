import { Range } from "vscode";

export const MAX_TOKEN_SEEK = 50;
export const MAX_LINE_SEEK = 50;
export const MAX_CHAR_SEEK = 2500;

export type FlagChar =
    | 'a'
    | 'b'
    | 'c'
    | 'd'
    | 'e'
    | 'f'
    | 'g'
    | 'h'
    | 'i'
    | 'j'
    | 'k'
    | 'l'
    | 'm'
    | 'n'
    | 'o'
    | 'p'
    | 'q'
    | 'r'
    | 's'
    | 't'
    | 'u'
    | 'v'
    | 'w'
    | 'x'
    | 'y'
    | 'z'
    | '!';

/**
 * A flag for some shorthand, representing a single lowercase letter or symbol.
 *
 * Can represent a range of characters by prepending a '-' and declaring two characters.
 */
export type Flag = FlagChar | `-${FlagChar}${FlagChar}`;

/** Returned as values in the map returned by `Tape.consumeFlags`. */
export type FlagMatch = {
    readonly expansion: string;
    readonly range: Range;
};

/**
 * The key used to trigger a completion.
 *
 * Triggers are not considered part of a completion, and this is helpful
 * because it allows the completion itself to be highlighted and show suggestions before
 * being fired.
 *
 * If provided, a trigger must take the form of either:
 * - ` `
 * - `;`
 * - [ENTER]
 *
 * An empty string means there is no set trigger key,
 * and the completion will fire as soon as it is matched.
 */
export type Trigger = '' | ' ' | ';' | 'enter';

/**
 * A possible configuration of nested scopes.
 *
 * Scope kinds may be prefixed by `...` to indicate any sequence of scopes leading to that one.
 *
 * Nested scopes are not required to be adjacent; they must simply be present in the same order.
 * If not provided as an argument, the completion is matched in all scopes.
 * Passing an empty array is considered to be the top-level scope.
 */
export type ScopeTree<ScopeKind extends string> = (
    | ScopeKind
    | `...${ScopeKind}`
)[];

/** Returns `scoping`, or an empty array if not supplied. */
export function orDefaultScoping<ScopeKind extends string>(
    scoping?: ScopeTree<ScopeKind>[],
): ScopeTree<ScopeKind>[] {
    return scoping ?? [];
}
