// import scopeResolver from './rust/scope_registry'
// import typescript from './ts/scope_registry'

import { ScopeRegistry } from "../scope_registry_utils"

/**
 * Contains scope resolver of every supported language.
 *
 * The key is the `langId`.
 */
const scopeRegistries: Record<string, ScopeRegistry<string>> = {
    // rust: scopeResolver,
    // typescript: typescript,
}

export default scopeRegistries
