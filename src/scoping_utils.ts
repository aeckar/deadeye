import { Position, TextDocument, commands } from 'vscode';



import { CompletionContext } from './completion_utils';









export type ScopeResolver<ScopeKind extends string> = (
    ctx: CompletionContext<ScopeKind>,
) => ScopeKind[];

/**
 * Represents a member in the scope tree at a particular position in a file.
 *
 * @param kind the type of scope, as defined in `lang/<langId>/scopes.ts`
 * @param symbol provides metadata and location data of the scope in question
 */
export type Scope<ScopeKind extends string> = {
    readonly kind: ScopeKind;
    readonly symbol: DocumentSymbol;
};

const MAX_SCAN_LINES = 100;
const MAX_SCAN_CHARS = 5000;

let cachedScope: Scope<any>[] = [];
let cachedLine = -1;
let lastFetch = 0;

const SCOPE_TTL = 150;

export function innerScope<ScopeKind extends string>(
    scopes: Scope<ScopeKind>[],
): Scope<ScopeKind> | undefined {
    return scopes.at(-1);
}

export function isInScope<ScopeKind extends string>(
    scopes: Scope<ScopeKind>[],
    kind: string,
): boolean {
    return scopes.some(s => s.kind === kind);
}

export async function getCachedScopes<ScopeKind extends string>(
    document: TextDocument,
    pos: Position,
    ctx: CompletionContext<ScopeKind>,
    resolver: ScopeResolver<ScopeKind>,
): Promise<Scope<ScopeKind>[]> {
    const now = Date.now();
    const lineChanged = pos.line !== cachedLine;
    const expired = now - lastFetch > SCOPE_TTL;
    if (!lineChanged && !expired) {
        return cachedScope;
    }
    cachedScope = await getScopes(document, pos, ctx, resolver);
    cachedLine = pos.line;
    lastFetch = now;
    return cachedScope;
}

export async function getScopes<ScopeKind extends string>(
    document: TextDocument,
    pos: Position,
    ctx: CompletionContext<ScopeKind>,
    resolver: ScopeResolver<ScopeKind>,
): Promise<Scope<ScopeKind>[]> {
    const symbols = await commands.executeCommand<DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        document.uri,
    );
    if (!symbols) {
        return []; // disable scoping as fallback
    }

    // return full stack of scopes containing pos
    // e.g. [Mod, Impl, Function] if you're inside a method
    return walkSymbols(symbols, pos, ctx, resolver);
}
