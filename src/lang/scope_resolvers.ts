import { ScopeResolver } from '../completion_registry_utils';
import scopeResolver from './rust/scope_resolver';
import typescript from './ts/resolver';

/**
 * Contains scope resolver of every supported language.
 *
 * The key is the `langId`.
 */
const scopeResolvers: Record<string, ScopeResolver<any>> = {
    rust: scopeResolver,
    typescript: typescript,
};

export default scopeResolvers;
