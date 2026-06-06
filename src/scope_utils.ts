import { DocumentSymbol, Position, TextDocument, commands } from 'vscode';
import { CompletionResolverContext } from './completion_utils';

export type ScopeResolver<Kind extends string> = (
    symbol: DocumentSymbol,
    ctx: CompletionResolverContext,
) => Scope<Kind>;

export type Scope<Kind extends string> = {
    readonly kind: Kind;
    readonly symbol: DocumentSymbol;
};

let cachedScope: Scope<any>[] = [];
let cachedLine = -1;
let lastFetch = 0;

const SCOPE_TTL = 150;

export function innerScope<Kind extends string>(
    scopes: Scope<Kind>[],
): Scope<Kind> | undefined {
    return scopes.at(-1);
}

export function isInScope<Kind extends string>(
    scopes: Scope<Kind>[],
    kind: string,
): boolean {
    return scopes.some(s => s.kind === kind);
}

export async function getCachedScopes<Kind extends string>(
    document: TextDocument,
    pos: Position,
    resolver: ScopeResolver<Kind>,
): Promise<Scope<Kind>[]> {
    const now = Date.now();
    const lineChanged = pos.line !== cachedLine;
    const expired = now - lastFetch > SCOPE_TTL;
    if (!lineChanged && !expired) {
        return cachedScope;
    }
    cachedScope = await getScopes(document, pos, resolver);
    cachedLine = pos.line;
    lastFetch = now;
    return cachedScope;
}

export async function getScopes<Kind extends string>(
    document: TextDocument,
    pos: Position,
    resolver: ScopeResolver<Kind>,
): Promise<Scope<Kind>[]> {
    const symbols = await commands.executeCommand<DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        document.uri,
    );
    if (!symbols) {
        return [];
    }

    // return full stack of scopes containing pos
    // e.g. [Mod, Impl, Function] if you're inside a method
    return walkSymbols(symbols, pos, resolver);
}

function walkSymbols<Kind extends string>(
    symbols: DocumentSymbol[],
    pos: Position,
    resolver: ScopeResolver<Kind>,
): Scope<Kind>[] {
    for (const symbol of symbols) {
        if (!symbol.range.contains(pos)) {
            continue;
        }
        const scope = resolver(symbol);

        // recurse into children to get full stack
        const children = walkSymbols(symbol.children, pos, resolver);
        return [scope, ...children];
    }
    return [];
}
