import { at, before, open, ScopeRegistry } from '@/api/scope_api'
import { CURLIES } from '@/utils/constants'
import tsVocab from './language'

/**
 * Completion resolvers should treat `function` and `method` scopes as the same,
 * since their separation exists only as a parser quirk.
 */
const tsScopes = ScopeRegistry.newInstance(() => tsVocab, {
    type: {
        require: [at('KW_TYPE')],
        boundaries: ['SEMICOLON'],
    },
    namespace: {
        require: [at('KW_NAMESPACE', 'KW_MODULE')],
        boundaries: [CURLIES],
    },
    interface: {
        require: [at('KW_INTERFACE')],
        boundaries: [CURLIES],
    },
    // colon = label
    // default scope (lowest) -> colon = assignment
    // in assignment before = -> colon = typeAnno
    // in assignment after = -> colon = assignment
    class: {
        require: [at('KW_CLASS')],
        boundaries: [CURLIES],
    },
    function: {
        require: [at('KW_FUNCTION', 'KW_GET', 'KW_SET', 'KW_CONSTRUCTOR')],
        boundaries: [CURLIES],
    },
    binding: {
        require: [at('KW_VAR', 'KW_LET', 'KW_CONST')],
        boundaries: ['SEMICOLON'],
    },
    assignment: {
        require: [at('EQUALS'), open('binding')],
        boundaries: ['SEMICOLON'],
        flatten: ['binding'],
        once: true,
    },
    conditional: {
        require: [at('KW_IF')],
        boundaries: [CURLIES],
    },
    else: {
        require: [at('KW_ELSE')],
        boundaries: [CURLIES],
        flatten: ['conditional'],
    },
    typeAnno: {
        require: [at('COLON')],
        boundaries: ['CLOSE_PAREN', 'CLOSE_CURLY', 'CLOSE_ANGLE', 'COMMA', 'EQUALS', 'SEMICOLON'],
    },
    objectType: {},
    objectLiteral: {
        require: [at('OPEN_CURLY')],
        boundaries: ['CLOSE_CURLY'],
        openPool: ['!type'],
        parentPool: ['assignment', 'function', 'method', '*'],
    },
    field: {
        require: [at('ID')],
        boundaries: ['SEMICOLON'],
        parentPool: ['class', 'interface', 'objectLiteral'],
        require: before('COLON', 'SEMICOLON', 'EQUALS'),
    },
    method: {
        require: [at('ID')],
        boundaries: [CURLIES],
        parentPool: ['class', 'interface', 'objectLiteral'],
        require: before('OPEN_ANGLE', 'OPEN_PAREN'),
    },
    async: {
        require: [at('KW_ASYNC')],
        boundaries: [CURLIES],
        flatten: ['function'],
    },
    loop: {
        require: [at('KW_FOR', 'KW_DO')],
        boundaries: [CURLIES],
        terminators: ['SEMICOLON'],
    },
    enum: {
        require: [at('KW_ENUM')],
        boundaries: [CURLIES],
    },
    switch: {
        require: [at('KW_SWITCH')],
        boundaries: [CURLIES],
    },
    try: {
        require: [at('KW_TRY')],
        boundaries: [CURLIES],
    },
    catch: {
        require: [at('KW_CATCH', 'KW_FINALLY')],
        boundaries: [CURLIES],
    },
})

export default tsScopes
