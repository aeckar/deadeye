// import typescript from './ts/scope_registry'

import { ScopeRegistry } from '../scopes'

/**
 * Contains scope resolver of every supported language.
 *
 * The key is the `langId`.
 */
const allScopeRegistries: Record<string, ScopeRegistry<string>> = {
    // rust: scopeResolver,
    // typescript: typescript,
}

export default allScopeRegistries
