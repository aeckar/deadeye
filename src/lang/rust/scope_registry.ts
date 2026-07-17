import { CURLIES } from '../../constants'
import { newScopeRegistry } from '../../scopes'
import rustVocab from './language'

export type RustScopeKind =
    | 'struct'
    | 'fn'
    | 'closure'
    | 'enum'
    | 'trait'
    | 'mod'
    | 'extern'
    | 'async'
    | 'const'
    | 'macro'
    | 'macroArm'
    | 'macroArmParams'
    | 'fnParams'
    | 'closureParams'
    | 'impl'
    | 'assignment'
    | 'typeAnno'
    | 'conditional'
    | 'else'
    | 'loop'
    | 'match'
    | 'matchArm'

// | 'condition' // IMPOSSIBLE IN RUST bc no (); completions must infer scope
// | 'typeParams' // $id < .. > //leave generocs out of lexer, defer to local ctx resolution
// | 'typeArgs' // ${$ty $id | fn} < .. >

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
// condition: {
//     possibleMarkers: ['OPEN_PAREN'],
//     possibleBoundaries: [[null, 'OPEN_PAREN']],
//     outerPrimedScope: 'conditional'
// },

// struct init is also too complex to parse at scope time, defer to completions

export const rustScopes = newScopeRegistry<RustScopeKind>(() => rustVocab, {
    struct: {
        markerPool: ['STRUCT', 'UNION'],
        boundariesPool: [CURLIES],
    },
    fn: {
        boundariesPool: [CURLIES],
        terminatorPool: ['SEMICOLON'],
    },
    closure: {
        markerPool: ['CLOSE_CLOSURE_PARAMS'],
        boundariesPool: [CURLIES],
        terminatorPool: [
            'SEMICOLON',
            'COMMA',
            'CLOSE_CURLY',
            'CLOSE_PAREN',
            'CLOSE_BRAC',
        ],
    },
    enum: {
        boundariesPool: [CURLIES],
        terminatorPool: ['SEMICOLON'],
    },
    trait: {
        boundariesPool: [CURLIES],
    },
    mod: {
        boundariesPool: [CURLIES],
        terminatorPool: ['SEMICOLON'],
    },
    extern: {
        boundariesPool: [CURLIES],
        flatten: true,
    },
    async: {
        boundariesPool: [CURLIES],
        flatten: true,
    },
    const: {
        boundariesPool: [CURLIES],
        flatten: true,
    },
    macro: {
        markerPool: ['MACRO_RULES'],
        boundariesPool: [CURLIES],
    },
    macroArm: {
        markerPool: ['FAT_ARROW'],
        boundariesPool: [CURLIES],
        terminatorPool: ['SEMICOLON'],
        outerOpenScope: 'macro',
    },
    macroArmParams: {
        markerPool: ['OPEN_PAREN'],
        boundariesPool: [[null, 'CLOSE_PAREN']],
        outerOpenScope: 'macro',
    },
    fnParams: {
        markerPool: ['OPEN_PAREN'],
        boundariesPool: [[null, 'CLOSE_PAREN']],
        outerPrimedScope: 'fn',
    },
    closureParams: {
        markerPool: ['OPEN_CLOSURE_PARAMS'],
        boundariesPool: [[null, 'CLOSE_CLOSURE_PARAMS']],
    },
    impl: {
        boundariesPool: [CURLIES],
    },
    assignment: {
        markerPool: ['LET', 'CONST', 'STATIC'],
        boundariesPool: [[null, 'SEMICOLON']],
    },
    typeAnno: {
        markerPool: ['COLON'],
        boundariesPool: [
            [null, 'CLOSE_PAREN'],
            [null, 'CLOSE_CURLY'],
            [null, 'COMMA'],
        ],
    },
    conditional: {
        markerPool: ['IF'],
        boundariesPool: [CURLIES],
    },
    else: {
        boundariesPool: [CURLIES],
        flatten: true,
    },
    loop: {
        markerPool: ['LOOP', 'FOR', 'WHILE'],
        boundariesPool: [CURLIES],
    },
    match: {
        boundariesPool: [CURLIES],
    },
    matchArm: {
        markerPool: ['FAT_ARROW'],
        boundariesPool: [CURLIES],
        terminatorPool: ['COMMA'],
        outerOpenScope: 'match',
    },
})

export default rustScopes
