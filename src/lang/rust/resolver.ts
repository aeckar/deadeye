import { ScopeResolver } from '../../family_api';
import { tokenize } from '../../language_api';
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

export const rust: ScopeResolver<RustScopeKind> = ctx => {
    const file = ctx.fileUpToCursor();
    let scopes: RustScopeKind[] = [];
    let node = tokenize(file, lang);
    let next: Token | undefined;
    while (!node.isEof()) {
        next = node.consumeEither('STRUCT', 'UNION');
        if (next) {
            node = next;
            next = node.seek('OPEN_CURLY');
            if (next) {
                node = next;
                scopes.push('struct');
                continue;
            }
        }
        next = node.consume;

        return [];
    }
};

export default rust;
