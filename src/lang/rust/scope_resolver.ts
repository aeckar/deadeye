import { tokenize } from '../../language_utils';
import { BoundaryMarkers } from '../../misc';
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

const CURLY = new BoundaryMarkers('OPEN_CURLY', 'CLOSE_CURLY');
const ROUND = new BoundaryMarkers('OPEN_PAREN', 'CLOSE_PAREN');
const SQUARE = new BoundaryMarkers('OPEN_BRAC', 'CLOSE_BRAC');

export const rust: ScopeResolver<RustScopeKind> = ctx => {
    const file = ctx.fileUpToCursor();
    const stream = new ScopeStream<RustScopeKind>(tokenize(file, lang));
    while (!stream.isExhausted()) {
        let matched = false;
        matched = stream.parseScope({
            scopeKind: 'const',
            boundaries: CURLY,
        });
        matched = stream.parseScope({
            scopeKind: 'fn-params',
            boundaries: ROUND,
            outerPrimedScope: 'fn',
        });
        matched = stream.parseScope({
            scopeKind: 'struct',
            boundaries: CURLY,
            markers: ['STRUCT', 'UNION'],
        });
        if (matched) {
            continue;
        }
        matched = stream.parseScope({
            scopeKind: 'fn',
            boundaries: CURLY,
        }); //...
        if (matched) {
            continue;
        }
        stream.parseElse();
    }
};

export default rust;
