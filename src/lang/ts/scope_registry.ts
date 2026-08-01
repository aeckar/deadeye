import { at, before, excludeOpen, open, parent, ScopeRegistry } from '@/api/scope_api'
import tsLanguage from '@/lang/ts/language'
import { CURLIES } from '@/utils/constants'

/**
 * Completion resolvers should treat `function` and `method` scopes as the same,
 * since their separation exists only as a parser quirk.
 */
const tsScopes = ScopeRegistry.newInstance(() => tsLanguage, {
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
    objectType: {
        
    },
    objectLiteral: {
        require: [
            at('OPEN_CURLY'),
            excludeOpen('type'),
            parent('assignment', 'function', 'method', '*'),
        ],
        boundaries: ['CLOSE_CURLY'],
    },
    field: {
        require: [
            at('ID'),
            before('COLON', 'SEMICOLON', 'EQUALS'),
            parent('class', 'interface', 'objectLiteral'),
        ],
        boundaries: ['SEMICOLON'],
    },
    method: {
        require: [
            at('ID'),
            before('OPEN_ANGLE', 'OPEN_PAREN'),
            parent('class', 'interface', 'objectLiteral'),
        ],
        boundaries: [CURLIES],
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
