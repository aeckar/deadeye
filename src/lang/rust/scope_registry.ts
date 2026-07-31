import { ScopeRegistry } from '@/api/scope_api'
import { CURLIES } from '@/utils/constants'
import rustVocab from './language'

// | 'condition' // IMPOSSIBLE IN RUST bc no (); completions must infer scope
//same for struct-init

export const rustScopes = ScopeRegistry.newInstance(() => rustVocab, {
    typeParams: {
        markerPool: ['OPEN_ANGLE'],
        boundariesPool: [[null, 'CLOSE_ANGLE']],
        primedScopePool: ['struct', 'impl', 'trait', 'type', 'fn', 'enum'],
        once: true,
    },
    typeArgs: {
        markerPool: ['OPEN_ANGLE'],
        boundariesPool: [[null, 'CLOSE_ANGLE']],
        openScopePool: ['fn', 'assignment'],
    },
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
        terminatorPool: ['SEMICOLON', 'COMMA', 'CLOSE_CURLY', 'CLOSE_PAREN', 'CLOSE_BRAC'],
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
        openScopePool: ['macro'],
    },
    macroArmParams: {
        markerPool: ['OPEN_PAREN'],
        boundariesPool: [[null, 'CLOSE_PAREN']],
        openScopePool: ['macro'],
    },
    fnParams: {
        markerPool: ['OPEN_PAREN'],
        boundariesPool: [[null, 'CLOSE_PAREN']],
        primedScopePool: ['fn'],
        once: true,
    },
    closureParams: {
        markerPool: ['OPEN_CLOSURE_PARAMS'],
        boundariesPool: [[null, 'CLOSE_CLOSURE_PARAMS']],
        once: true,
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
            [null, 'CLOSE_ANGLE'],
            [null, 'COMMA'],
            [null, 'EQUALS'],
            [null, 'SEMICOLON'],
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
        openScopePool: ['match'],
    },
})

export default rustScopes
