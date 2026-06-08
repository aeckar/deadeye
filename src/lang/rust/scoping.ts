import { DocumentSymbol, SymbolKind } from 'vscode';

import { CompletionContext } from '../../completion_utils';
import { ScopeResolver } from '../../scoping_utils';

// fn parse float;kind is string value is byte;uqw;    // `;` or ` ` after `->` to skip to body
// fn parse_float(kind: string, value: u8) -> u64 {
//     /*stop here */
// }

export type RustScopeKind =
    /* blocks */
    | 'struct'
    | 'impl'
    | 'fn'
    | 'enum'
    | 'trait'
    | 'mod'
    | 'extern'
    | 'macro'

    /* Expression/Statement -- applies to macro syntax also */
    | 'assignment'
    | 'type-anno'
    | 'condition'
    | 'conditional'
    | 'loop'
    | 'match-arm'
    | 'type-param'
    | 'struct-init' //<id>{}
    | '';

const rust: ScopeResolver<RustScopeKind> = ctx => {
    return [];
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

//todo for all other c-like too: optimize doc comment (make single line /** */, etc)
//  should have option for ws between tags and content

//todo completion: populate function with existing vars of same name as params
