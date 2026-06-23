import { ScopeRegistry } from '../../scope_registry_utils';

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

/*
    scopeKind: ScopeKind;
    markers?: string[];
    possibleBoundaries: BoundariesCfg;
    flatten?: boolean;
    startOpen?: boolean;
    outerOpenScope?: ScopeKind;
    outerPrimedScope?: ScopeKind;
*/

export const rust = ScopeRegistry.newInstance<RustScopeKind>(
    {
        scopeKind: 'const',
        possibleBoundaries: ['CURLY'],
        flatten: true,
    },
    {
        scopeKind: 'fn-params',
        possibleMarkers: ['OPEN_PAREN'],
        possibleBoundaries: [[null, 'CLOSE_PAREN']],
        outerPrimedScope: 'fn',
    },
    {
        scopeKind: 'struct',
        possibleBoundaries: ['CURLY'],
        possibleMarkers: ['STRUCT', 'UNION'],
    },
    {
        scopeKind: 'fn',
        possibleBoundaries: ['CURLY'],
    },
    {
        scopeKind: 'macro',
        possibleBoundaries: ['CURLY'],
        possibleMarkers: ['MACRO_RULES'],
    },
    {
        scopeKind: 'struct-init',
        possibleMarkers: ['OPEN_CURLY'],
        possibleBoundaries: [[null, 'CLOSE_CURLY']],  
    },
    {
        scopeKind: 
    }
);

/*
    const file = ctx.fileUpToCursor();
    const stream = new ScopeStream<RustScopeKind>(tokenize(file, lang));
    while (!stream.isExhausted()) {
        let matched = false;
        matched = stream.parse({
            scopeKind: 'struct',
            possibleBoundaries: CURLY,
            markers: ['STRUCT', 'UNION'],
        });
        if (matched) {
            continue;
        }
        matched = stream.parse({
            scopeKind: 'fn',
            possibleBoundaries: CURLY,
        }); //...
        if (matched) {
            continue;
        }
        stream.collect();
    }
*/

export default rust;
