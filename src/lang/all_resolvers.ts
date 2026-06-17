import { ScopeResolver } from '../family_api';
import rust from './rust/resolver';
import typescript from './ts/resolver';

/**
 * Contains scope resolver of every supported language.
 *
 * The key is the `langId`.
 */
const scopeResolvers: Record<string, ScopeResolver<any>> = {
    rust,
    typescript,
};

export default scopeResolvers;
