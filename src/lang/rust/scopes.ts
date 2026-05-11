import { Scope } from '@/scope_utils';
import { DocumentSymbol, SymbolKind } from 'vscode';

export type RustScope =
    | 'toplevel'
    | 'struct'
    | 'impl'
    | 'fn'
    | 'enum'
    | 'trait'
    | 'mod';

function rust(symbol: DocumentSymbol): Scope<RustScope> {
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
