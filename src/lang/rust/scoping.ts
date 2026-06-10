import { ScopeResolver } from '../../completion_utils';

// fn parse float;kind is string value is byte;uqw;    // `;` or ` ` after `->` to skip to body
// fn parse_float(kind: string, value: u8) -> u64 {
//     /*stop here */
// }

export type RustScopeKind =
    // struct .. {
    // union .. {
    // Scope marker pos: |${struct | union}
    | 'struct'

    // fn .. {
    // | .. | {
    // Does not apply to short-form closures
    // Scope marker pos: |fn
    | 'fn'

    // enum {
    // Scope marker pos: |enum
    | 'enum'

    // trait .. {
    // Scope marker pos: |trait
    | 'trait'

    // mod .. {
    // Scope marker pos: |mod
    | 'mod'

    // extern .. $flatten(fn)
    // Scope marker pos: |extern
    | 'extern'

    // async .. $flatten(fn)
    // Scope marker pos: |async
    | 'async'

    // const .. $flatten(fn)
    // Scope marker pos: |const
    | 'const'

    // macro_rules! .. {
    // Scope marker pos: |macro_rules!
    | 'macro'

    //todo
    | 'macro-arm-params'
    | 'macro-arm'

    // (
    | 'fn-params'

    // impl .. {
    | 'impl'

    /* Expression/Statement -- applies to macro syntax also */
    | 'assignment' //
    | 'type-anno' // ${}
    | 'condition' //
    | 'conditional' //

    // loop .. {
    // for .. {
    // while .. {
    | 'loop'

    // case .. =>
    // _ =>
    | 'match-arm'

    //
    | 'type-params' // $id < .. >
    | 'type-args' // ${$ty $id | fn} < .. >
    | 'struct-init' // $id {
    | '';

// $flatten(other) = $other .. { | {
// $ty = struct | union | enum

const rust: ScopeResolver<RustScopeKind> = ctx => {
    const tape = ctx.fileUpToCursor();

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
