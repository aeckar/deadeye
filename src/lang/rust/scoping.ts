import { DocumentSymbol, SymbolKind } from 'vscode';

import { CompletionContext } from '../../completion_utils';
import { ScopeResolver } from '../../scoping_utils';

// fn parse float;kind is string value is byte;uqw;    // `;` or ` ` after `->` to skip to body
// fn parse_float(kind: string, value: u8) -> u64 {
//     /*stop here */
// }

export type RustScopeKind =
    /* Declaration-level -- map directly to `SymbolKind` */
    | 'toplevel'
    | 'struct'
    | 'impl'
    | 'fn'
    | 'enum'
    | 'trait'
    | 'mod'

    /* Expression/Statement -- applies to macro syntax also */
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
    const kind = toDeclarationScopes(symbol);
    return [...kind, ...innerScopes(kind, ctx)];
};

/*
keep assignment purely as an expression/statement scope detected by the text parser
*/

/*
Yes. The symbol tree approach was me anchoring to the VS Code API you were already using rather than thinking from first principles about your actual constraints. Your requirements were always:

Must work on freshly typed code
Must handle expression-level scopes the LSP can't see
Must be synchronous and instant
Only needs 1-3 levels of depth

A raw scanner satisfies all four. The symbol tree satisfies none of them fully. You would have hit every one of those walls eventually and ended up at the scanner anyway.
*/

function toDeclarationScope(symbol: DocumentSymbol): RustScopeKind {
    switch (symbol.kind) {
        case SymbolKind.Module:
            return 'mod';
        case SymbolKind.Constant:
            return 'assignment';
        case SymbolKind.Interface:
            return 'trait';
        case SymbolKind.Enum:
            return 'enum';
        case SymbolKind.EnumMember:
            return 'enum-member';
        case SymbolKind.Struct:
            return 'struct';
        case SymbolKind.Field:
            return 'field';
        case SymbolKind.Function:
        case SymbolKind.Method:
            return 'fn';
        case SymbolKind.Class:
            return 'impl';
        case SymbolKind.Variable:
            return 'assignment';
        case SymbolKind.TypeParameter:
            return 'type-param';
        default:
            return 'toplevel';
    }
}

function innerScopes(
    kind: RustScopeKind[],
    ctx: CompletionContext<RustScopeKind>,
): RustScopeKind[] {
    return [];
}

export default rust;
