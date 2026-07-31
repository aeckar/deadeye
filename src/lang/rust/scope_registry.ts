import {
    at,
    before,
    excludeOpen,
    excludePrimed,
    open,
    parent,
    primed,
    ScopeRegistry,
} from '@/api/scope_api'
import { ANGLES, CURLIES } from '@/utils/constants'
import rustVocab from './language'

/**
 * Completion resolvers must themselves check if in condition,
 * since rust conditionals lack parentheses and only one scope can be pushed at a time.
 */
export const rustScopes = ScopeRegistry.newInstance(() => rustVocab, {
    // Item Declarations
    struct: {
        require: [at('STRUCT', 'UNION')],
        boundaries: [CURLIES],
    },
    enum: {
        require: [at('ENUM')],
        boundaries: [CURLIES],
        terminators: ['SEMICOLON'],
    },
    trait: {
        require: [at('TRAIT')],
        boundaries: [CURLIES],
    },
    impl: {
        require: [at('IMPL')],
        boundaries: [CURLIES],
    },
    mod: {
        require: [at('MOD')],
        boundaries: [CURLIES],
        terminators: ['SEMICOLON'],
    },
    externBlock: {
        require: [at('EXTERN')],
        boundaries: [CURLIES],
        flatten: ['fn'],
    },

    // Generics & Type Annotations
    typeParams: {
        require: [at('PATH_SEP'), primed('struct', 'impl', 'trait', 'type', 'enum')],
        boundaries: [ANGLES],
        once: true,
    },
    fnTypeParams: {
        require: [at('OPEN_ANGLE'), primed('fn'), excludePrimed('fnParams')],
        boundaries: ['CLOSE_ANGLE'],
    },
    typeArgs: {
        require: [at('OPEN_ANGLE'), open('typeAnno', 'fn')],
        boundaries: ['CLOSE_ANGLE'],
    },
    typeAnno: {
        require: [at('COLON'), open('binding', 'fnParams', 'struct', 'enumEntryStruct')],
        boundaries: ['CLOSE_PAREN', 'CLOSE_CURLY', 'CLOSE_ANGLE', 'COMMA', 'EQUALS', 'SEMICOLON'],
    },

    // Functions & Closures
    fn: {
        require: [at('FN')],
        boundaries: [CURLIES],
        terminators: ['SEMICOLON'],
    },
    fnParams: {
        require: [at('OPEN_PAREN'), primed('fn')],
        boundaries: ['CLOSE_PAREN'],
        once: true,
    },
    returnType: {
        require: [at('THIN_ARROW'), primed('fn')],
        boundaries: ['OPEN_CURLY', 'SEMICOLON'],
        flatten: ['fn'],
        once: true,
    },
    closure: {
        require: [at('CLOSE_CLOSURE_PARAMS')],
        boundaries: [CURLIES],
        terminators: ['SEMICOLON', 'COMMA', 'CLOSE_CURLY', 'CLOSE_PAREN', 'CLOSE_BRAC'],
    },
    closureParams: {
        require: [at('OPEN_CLOSURE_PARAMS')],
        boundaries: ['CLOSE_CLOSURE_PARAMS'],
        once: true,
    },
    where: {
        require: [at('WHERE'), primed('fn')],
        boundaries: ['OPEN_CURLY'],
    },

    // Variables, Assignments & Struct Literals
    typeAlias: {
        require: [at('TYPE')],
        boundaries: ['SEMICOLON'],
    },
    binding: {
        require: [at('LET', 'STATIC')],
        boundaries: ['SEMICOLON', 'OPEN_CURLY' /* ignores `structLiteral` patterns */],
    },
    assignment: {
        require: [at('EQUALS'), open('binding')],
        boundaries: ['SEMICOLON', 'OPEN_CURLY'],
        flatten: ['binding'],
        once: true,
    },
    constBinding: {
        require: [at('CONST'), before('ID')],
        boundaries: ['SEMICOLON'],
    },
    structLiteral: {
        require: [
            at('ID'),
            before('OPEN_CURLY'),
            open('assignment', 'fn'),
            excludePrimed('conditional', 'loop', 'match'),
            excludeOpen('returnType'),
        ],
        boundaries: [CURLIES],
    },
    structAssignment: {
        require: [at('COLON'), parent('structLiteral')],
        boundaries: ['COMMA', 'CLOSE_CURLY'],
    },

    // Control Flow & Pattern Matching
    conditional: {
        require: [at('IF')],
        boundaries: [CURLIES],
    },
    else: {
        require: [at('ELSE')],
        boundaries: [CURLIES /* safe for let-else */],
        flatten: ['conditional'],
    },
    loop: {
        require: [at('LOOP', 'FOR', 'WHILE')],
        boundaries: [CURLIES],
    },
    match: {
        require: [at('MATCH')],
        boundaries: [CURLIES],
    },
    matchArm: {
        require: [at('FAT_ARROW'), open('match')],
        boundaries: [CURLIES],
        terminators: ['COMMA'],
    },

    // Blocks & Miscellaneous Contexts
    asyncBlock: {
        require: [at('ASYNC')],
        boundaries: [CURLIES],
        flatten: ['fn'],
    },
    constBlock: {
        require: [at('CONST')],
        boundaries: [CURLIES],
        flatten: ['fn'],
    },
    enumEntryStruct: {
        require: [at('OPEN_CURLY'), open('enum')],
        boundaries: ['CLOSE_CURLY'],
    },
    unsafeBlock: {
        require: [at('UNSAFE')],
        boundaries: [CURLIES],
        flatten: ['fn'],
    },
    useImport: {
        require: [at('USE')],
        boundaries: ['SEMICOLON'],
    },

    // Macros
    macro: {
        require: [at('MACRO_RULES')],
        boundaries: [CURLIES],
    },
    macroArm: {
        require: [at('FAT_ARROW'), open('macro')],
        boundaries: [CURLIES],
        terminators: ['SEMICOLON'],
    },
    macroArmParams: {
        require: [at('OPEN_PAREN'), open('macro')],
        boundaries: ['CLOSE_PAREN'],
    },
})

export default rustScopes
