import { tokenize } from '../../language_utils';
import { ScopeResolver, ScopeStream } from '../../scope_resolver_utils';
import { rust as lang } from './language';

/**
 * ```
 * $flatten(other) = $other .. '{' | '{'
 * $ty = 'struct' | 'u2nion' | 'enum'
 * ```
 */
export type RustScopeKind =
    // 'struct' .. '{'
    // 'union' .. '{'
    // Scope marker pos: |${'struct' | 'union'}
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

    // 'extern' .. $flatten(fn)
    // Scope marker pos: |'extern'
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

//for overlapping scopes, check match for every token (possible marker)
export const rust: ScopeResolver<RustScopeKind> = ctx => {
    const file = ctx.fileUpToCursor();
    const stream = new ScopeStream(tokenize(file, lang));
    while (!stream.isExhausted()) {
        let matched = stream.consumeSignature(
            'struct',
            ['STRUCT', 'UNION'],
            'OPEN_CURLY',
        );
        if (matched) {
            continue;
        }
        matched = stream.consumeSignature('fn', ['FN']); //...
        if (matched) {
            continue;
        }
        return [];
    }
};

export default rust;
