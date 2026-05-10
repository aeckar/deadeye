import {
    DocumentSymbol,
    Position,
    TextDocument,
    commands,
} from 'vscode';

type ScopeTranslator<K extends string> = (symbol: DocumentSymbol) => Scope<K>;

export type Scope<K extends string> = {
    kind: K;
    symbol: DocumentSymbol;
};

let cachedScope: Scope<any>[] = [];
let cachedLine = -1;
let lastFetch = 0;

const SCOPE_TTL = 150;

export function innerScope<K extends string>(scopes: Scope<K>[]): Scope<K> | undefined {
    return scopes.at(-1);
}

export function isInScope<K extends string>(scopes: Scope<K>[], kind: string): boolean {
    return scopes.some(s => s.kind === kind);
}

export async function getCachedScopes<K extends string>(
    document: TextDocument,
    pos: Position,
    translator: ScopeTranslator<K>,
): Promise<Scope<K>[]> {
    const now = Date.now();
    const lineChanged = pos.line !== cachedLine;
    const expired = now - lastFetch > SCOPE_TTL;
    if (!lineChanged && !expired) {
        return cachedScope;
    }
    cachedScope = await getScopes(document, pos, translator);
    cachedLine = pos.line;
    lastFetch = now;
    return cachedScope;
}

export async function getScopes<K extends string>(
    document: TextDocument,
    pos: Position,
    translator: ScopeTranslator<K>,
): Promise<Scope<K>[]> {
    const symbols = await commands.executeCommand<DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        document.uri,
    );
    if (!symbols) {
        return [];
    }

    // return full stack of scopes containing pos
    // e.g. [Mod, Impl, Function] if you're inside a method
    return walkSymbols(symbols, pos, translator);
}

function walkSymbols<K extends string>(
    symbols: DocumentSymbol[],
    pos: Position,
    translator: ScopeTranslator<K>,
): Scope<K>[] {
    for (const symbol of symbols) {
        if (!symbol.range.contains(pos)) {
            continue;
        }
        const scope = translator(symbol);

        // recurse into children to get full stack
        const children = walkSymbols(symbol.children, pos, translator);
        return [scope, ...children];
    }
    return [];
}
