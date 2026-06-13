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

export const rust: ScopeResolver<RustScopeKind> = ctx => {
    const tape = ctx.fileUpToCursor();

    return [];
};

export default rust;
