import { ScopeRegistry } from '@/api/scope_api'
import { CURLIES } from '@/utils/constants'
import tsVocab from './language'

const tsScopes = ScopeRegistry.newInstance(() => tsVocab, {
    typeAlias: {
        markerPool: ['KW_TYPE'],
        boundariesPool: [[null, 'SEMICOLON']],
    },
    namespace: {
        markerPool: ['KW_NAMESPACE', 'KW_MODULE'],
        boundariesPool: [CURLIES],
    },
    interface: {
        markerPool: ['KW_INTERFACE'],
        boundariesPool: [CURLIES],
    },
    class: {
        markerPool: ['KW_CLASS'],
        boundariesPool: [CURLIES],
    },
    function: {
        markerPool: ['KW_FUNCTION', 'KW_GET', 'KW_SET', 'KW_CONSTRUCTOR'],
        boundariesPool: [CURLIES],
        
    },
    //todo methods
    assignment: {
        markerPool: ['KW_VAR', 'KW_LET', 'KW_CONST'],
        boundariesPool: [[null, 'SEMICOLON']],
    },
    conditional: {
        markerPool: ['KW_IF'],
        boundariesPool: [CURLIES],
    },
    else: {
        markerPool: ['KW_ELSE'],
        boundariesPool: [CURLIES],
        flatten: ['conditional'],
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
    async: {
        markerPool: ['KW_ASYNC'],
        boundariesPool: [CURLIES],
        flatten: ['function'],
    },
    loop: {
        markerPool: ['KW_FOR', 'KW_DO'],
        boundariesPool: [CURLIES],
        terminatorPool: ['SEMICOLON'],
    },
    enum: {
        markerPool: ['KW_ENUM'],
        boundariesPool: [CURLIES],
    },
    switch: {
        markerPool: ['KW_SWITCH'],
        boundariesPool: [CURLIES],
    },
    try: {
        markerPool: ['KW_TRY'],
        boundariesPool: [CURLIES],
    },
    catch: {
        markerPool: ['KW_CATCH', 'KW_FINALLY'],
        boundariesPool: [CURLIES],
    },
})

export default tsScopes
