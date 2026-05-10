import { DocumentSymbol, SymbolKind } from 'vscode';

import { Scope as IScope } from '../../scope_utils';

export type ScopeKind =
    | 'toplevel'
    | 'struct'
    | 'impl'
    | 'fn'
    | 'enum'
    | 'trait'
    | 'mod';

export type Scope = IScope<ScopeKind>;

function rust(symbol: DocumentSymbol): Scope {
    const kind = (() => {
        switch (symbol.kind) {
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
                return 'toplevel';
        }
    })();
    return {
        kind,
        symbol,
    };
}
