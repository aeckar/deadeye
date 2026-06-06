import { SymbolKind } from 'vscode';

import { ScopeResolver } from '../../scope_utils';

export type RustScopeKind =
    /* Declaration-level -- map directly to `SymbolKind` */
    | 'toplevel'
    | 'struct'
    | 'impl'
    | 'fn'
    | 'enum'
    | 'trait'
    | 'mod'

    /* Expression/Statement */
    | 'assignment'
    | 'type-anno'
    | 'condition'
    | 'conditional'
    | 'loop'
    | 'macro'
    | 'extern'
    | 'match-arm'
    | 'type-param';

const rust: ScopeResolver<RustScopeKind> = symbol => {
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
