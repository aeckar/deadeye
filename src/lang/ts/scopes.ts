import { SymbolKind } from 'vscode';

import { ScopeResolver } from '../../scope_utils';

export type TypeScriptScope =
    | 'toplevel'
    | 'class'
    | 'interface'
    | 'type'
    | 'fn' // Functions, Methods, Constructor blocks
    | 'enum'
    | 'namespace' // Namespaces or Modules
    | 'object'; // Inside literal object assignments

const typescript: ScopeResolver<TypeScriptScope> = symbol => {
    const kind = (() => {
        switch (symbol.kind) {
            case SymbolKind.Class:
                return 'class';
            case SymbolKind.Interface:
                return 'interface';
            case SymbolKind.TypeParameter:
                return 'type';
            case SymbolKind.Function:
            case SymbolKind.Method:
            case SymbolKind.Constructor:
                return 'fn';
            case SymbolKind.Enum:
                return 'enum';
            case SymbolKind.Module:
            case SymbolKind.Namespace:
                return 'namespace';
            case SymbolKind.Object:
                return 'object';
            default:
                return 'toplevel';
        }
    })();

    return {
        kind,
        symbol,
    };
};

export default typescript;

/*
Why this design aligns with TypeScript semantics
class vs. interface: Unlike Rust where Class maps directly to impl, TypeScript treats classes as runtime constructor allocations and interfaces strictly as compile-time type barriers. Separating them lets you restrict class-only shorthand modifiers (like private, protected, public, readonly) from leaking into interface bodies where they are syntactically illegal.

The fn Consolidation: Grouping SymbolKind.Constructor along with functions and methods ensures that shortcuts for local variables (let, const), loops (for, while), or control flows map correctly inside any executable block structure.

object Scope Addition: TypeScript developers heavily use explicit inline object definitions for configurations and type assertions. Mapping SymbolKind.Object allows your shorthand engine to distinguish between writing code inside a function body versus writing property-value pairs inside a literal object block.