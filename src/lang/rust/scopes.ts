import { DocumentSymbol, SymbolKind } from 'vscode';

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

const rust: ScopeResolver<RustScopeKind> = (symbol, ctx) => {
    const scopes = trace(symbol).map(mapKind);

    if (scopes.at(-1) === 'fn') {
        const inner = narrowFnScope(ctx);
        scopes.push(...inner);
    }

    return scopes;
};

function trace(symbol: DocumentSymbol): DocumentSymbol[] {
    const chain = [];
    let cur = symbol;
    while (cur) {
        chain.unshift(cur);
        cur = cur.parent;
    }
    return chain;
}

function mapKind(symbol: DocumentSymbol): RustScopeKind {
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
}

function narrowFnScope(ctx: CompletionContext<RustScopeKind>): RustScopeKind[] {
    // todo: parse left of cursor to detect expression/statement context
    return [];
}

export default rust;
