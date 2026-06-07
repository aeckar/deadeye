import { Position, TextDocument, commands } from 'vscode';

import { CompletionContext } from './completion_utils';

/**
 * Implemented by a top-level constant for each language,
 * which is then be passed as an entry to `scopeResolvers` (`lang/scope_resolvers.ts`).
 * This then provides scope resolution for a given `langId`.
 */
export type ScopeResolver<ScopeKind extends string> = (
    ctx: CompletionContext<ScopeKind>,
) => ScopeKind[];

/**
 * Represents a member in the scope tree at a particular position in a file.
 *
 * Since scopes
 *
 * @param kind the type of scope, as defined in `lang/<langId>/scopes.ts`
 * @param markerPos the position of the first character of the scope marker
 * (`if`, `fn`, `impl`, `mod`, etc.), which is primarily useful to hot completions
 * that modify the scope signature.
 * @param openPos the position of the opening bracket that denotes this scope.
 */
export type Scope<ScopeKind extends string> = {
    readonly kind: ScopeKind;
    readonly markerPos: Position;
    readonly openPos: Position;
};

/**
 * 
 */
export function isInScope<ScopeKind extends string>(
    scopes: Scope<ScopeKind>[],
    kind: string,
): boolean {
    return true;//todo
}