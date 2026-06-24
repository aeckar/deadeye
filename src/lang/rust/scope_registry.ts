import { ScopeRegistry } from '../../scope_registry_utils';

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
    | 'matchArm';
    
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
        possibleMarkers: ['FAT_ARROW'],
        possibleBoundaries: ['CURLY', [null, 'COMMA']],
        outerOpenScope: 'macro', 
    },
    macroArmParams: {
        possibleMarkers: ['OPEN_PAREN'],
        possibleBoundaries: [[null, 'CLOSE_PAREN']],
        outerOpenScope: 'macro',
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
        possibleBoundaries: ['CURLY', [null, 'COMMA']],
        outerOpenScope: 'match',
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
