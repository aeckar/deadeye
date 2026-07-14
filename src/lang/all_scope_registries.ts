import { ScopeRegistry } from '../scopes'
import rustScopes from './rust/scope_registry'

/**
 * Contains scope resolver of every supported language.
 *
 * The key is the `langId`.
 */
const allScopeRegistries: Record<string, ScopeRegistry<string>> = {
    rust: rustScopes,
}

export default allScopeRegistries
