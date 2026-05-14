import { ScopeResolver } from '@/scope_utils';
import { SymbolKind } from 'vscode';

export type RustScope =
    | 'toplevel'
    | 'struct'
    | 'impl'
    | 'fn'
    | 'enum'
    | 'trait'
    | 'mod';

const rust: ScopeResolver<RustScope> = (symbol) => {
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
};

export default rust;