import { CURLIES } from '../../language_utils'
import { newScopeRegistry } from '../../scope_registry_utils'

export type RustScopeKind =
    | 'struct'
    | 'fn' // does not apply to short-form closures
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

export const rust = newScopeRegistry<RustScopeKind>({
    struct: {
        markerPool: ['STRUCT', 'UNION'],
        boundariesPool: [CURLIES],
    },
    fn: {
        boundariesPool: [CURLIES],
        terminatorPool: ['SEMICOLON'],
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
    }, // todo lambdas use lookbehind
    impl: {
        boundariesPool: [CURLIES],
    },
    assignment: {
        markerPool: ['EQUALS'],
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
        outerOpenScope: 'match', // todo no way to scope short match arms
    },
})

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

export default rust
