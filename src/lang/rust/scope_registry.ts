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
    | 'macroArm'
    | 'macroArmParams'

    // (
    | 'fnParams'

    // impl .. {
    | 'impl'

    /* Expression/Statement -- applies to macro syntax also */
    | 'assignment' //
    | 'typeAnno' // ${}
    // | 'condition' // IMPOSSIBLE IN RUST bc no (); completions must infer scope
    | 'conditional' //
    | 'else'

    // loop .. {
    // for .. {
    // while .. {
    | 'loop'

    | 'match'
    // case .. =>
    // _ =>
    | 'matchArm'

    //
    // | 'typeParams' // $id < .. > //leave generocs out of lexer, defer to local ctx resolution
    // | 'typeArgs' // ${$ty $id | fn} < .. >
    | 'structInit' // $id {
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

//I was tempted to make whitespace into tokens so that I could understand the 
// context of whether there was a whitespace between an identifier and a less-than
//  sign to determine whether it is a boolean operation or a generics operation. 
// I think I'm just going to leave that to the completions, and I will leave
//  whitespace out of the token stream to improve performance. 

export const rust = ScopeRegistry.newInstance<RustScopeKind>({
    struct: {
        possibleMarkers: ['STRUCT', 'UNION'],
        possibleBoundaries: ['CURLY'],
    },
    fn: {
        possibleBoundaries: ['CURLY'],
    },
    enum: {
        possibleBoundaries: ['CURLY'],
    },
    trait: {
        possibleBoundaries: ['CURLY'],
    },
    mod: {
        possibleBoundaries: ['CURLY'],
    },
    extern: {
        possibleBoundaries: ['CURLY'],
        flatten: true,
    },
    async: {
        possibleBoundaries: ['CURLY'],
        flatten: true,
    },
    const: {
        possibleBoundaries: ['CURLY'],
        flatten: true,
    },
    macro: {
        possibleMarkers: ['MACRO_RULES'],
        possibleBoundaries: ['CURLY'],
    },
    macroArm: {

    },
    macroArmParams: {

    },
    fnParams: {
        possibleMarkers: ['OPEN_PAREN'],
        possibleBoundaries: [[null, 'CLOSE_PAREN']],
        outerPrimedScope: 'fn',
    },
    impl: {
        possibleBoundaries: ['CURLY'],
    },
    assignment: {
        possibleMarkers: ['EQUALS'],
        possibleBoundaries: [[null, 'SEMICOLON']]
    },
    typeAnno: {
        possibleMarkers: ['COLON'],
        possibleBoundaries: [[null, 'CLOSE_PAREN'], [null, 'CLOSE_CURLY'], [null, 'COMMA']]
    },
    // condition: {
    //     possibleMarkers: ['OPEN_PAREN'],
    //     possibleBoundaries: [[null, 'OPEN_PAREN']],
    //     outerPrimedScope: 'conditional'
    // },
    conditional: {
        possibleMarkers: ['IF'],
        possibleBoundaries: ['CURLY'],
    },
    else: {
        possibleBoundaries: ['CURLY'],
        flatten: true,
    },
    loop: {
        possibleMarkers: ['LOOP', 'FOR', 'WHILE'],
        possibleBoundaries: ['CURLY'],
    },
    match: {
        possibleBoundaries: ['CURLY']
    },
    matchArm: {
        possibleMarkers: ['FAT_ARROW'],
        possibleBoundaries: [[null, 'CLOSE_CURLY'], [null, 'COMMA']],
        outerOpenScope: 'match',
    },
    typeParams: {
        possibleMarkers: ['LESS'],
        possibleBoundaries: [[null, 'GREATER']]
    },
    typeArgs: {

    }
    structInit: {
        possibleMarkers: ['OPEN_CURLY'],
        possibleBoundaries: [[null, 'CLOSE_CURLY']],  
    },
    {

    },
});

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
