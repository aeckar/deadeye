import { ScopeRegistry } from '@/api/scope_api'
import { CURLIES } from '@/utils/constants'
import tsVocab from './language'

export const tsScopes = ScopeRegistry.newInstance(() => tsVocab, {
    // Declarations using soft keywords like `type` or `namespace`
    // are checked by verifying the identifier's raw text
    typeAlias: {
        markerPool: ['TYPE'],
        boundariesPool: [[null, 'SEMICOLON']],
    },
    namespace: {
        markerPool: ['NAMESPACE', 'MODULE'],
        boundariesPool: [CURLIES],
    },
    interface: {
        markerPool: ['INTERFACE'],
        boundariesPool: [CURLIES],
    },

    // Strict structural scopes stay tag-based
    class: {
        markerPool: ['CLASS'],
        boundariesPool: [CURLIES],
    },
    fn: {
        markerPool: ['FUNCTION'],
        boundariesPool: [CURLIES],
    },
    assignment: {
        markerPool: ['VAR', 'LET', 'CONST'],
        boundariesPool: [[null, 'SEMICOLON']],
    },
})

export default tsScopes
