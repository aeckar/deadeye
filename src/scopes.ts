import {
    DocumentSymbol,
    Position,
    SymbolKind,
    TextDocument,
    commands,
} from 'vscode';

/**
 * A Rust scope, used to determine the context around the cursor.
 *
 * An empty string represents the top-level scope.
 */
export type RustScope =
    | ''
    | 'struct'
    | 'impl'
    | 'fn'
    | 'enum'
    | 'trait'
    | 'mod';

export type ScopeInfo = {
    kind: RustScope;
    name: string;
    symbol: DocumentSymbol;
};

let cachedScope: ScopeInfo[] = [];
let cachedLine = -1;
let lastFetch = 0;
const SCOPE_TTL = 150;

export async function getScopeCached(
    document: TextDocument,
    pos: Position,
): Promise<ScopeInfo[]> {
    const now = Date.now();
    const lineChanged = pos.line !== cachedLine;
    const expired = now - lastFetch > SCOPE_TTL;
    if (!lineChanged && !expired) {
        return cachedScope;
    }
    cachedScope = await getScope(document, pos);
    cachedLine = pos.line;
    lastFetch = now;
    return cachedScope;
}

export function innerScope(scopes: ScopeInfo[]): ScopeInfo | undefined {
    return scopes.at(-1);
}

export function inScope(scopes: ScopeInfo[], kind: RustScope): boolean {
    return scopes.some(s => s.kind === kind);
}

export async function getScope(
    document: TextDocument,
    pos: Position,
): Promise<ScopeInfo[]> {
    const symbols = await commands.executeCommand<DocumentSymbol[]>(
        'executeDocumentSymbolProvider',
        document.uri,
    );
    if (!symbols) {
        return [];
    }

    // returns the full stack of scopes containing pos
    // e.g. [Mod, Impl, Function] if you're inside a method
    return walkSymbols(symbols, pos);
}

function walkSymbols(symbols: DocumentSymbol[], pos: Position): ScopeInfo[] {
    for (const sym of symbols) {
        if (!sym.range.contains(pos)) {
            continue;
        }

        const scope = toRustScope(sym.kind);
        const current: ScopeInfo = { kind: scope, name: sym.name, symbol: sym };

        // recurse into children to get the full stack
        const children = walkSymbols(sym.children, pos);
        return [current, ...children];
    }
    return [];
}

function toRustScope(kind: SymbolKind): RustScope {
    switch (kind) {
        case SymbolKind.Struct:
            return 'struct';
        case SymbolKind.Function:
        case SymbolKind.Method:
            return 'fn';
        case SymbolKind.Enum:
            return 'enum';
        case SymbolKind.Interface:
            return 'trait';
        case SymbolKind.Module:
            return 'mod';
        case SymbolKind.Class:
            return 'impl';
        default:
            return '';
    }
}
