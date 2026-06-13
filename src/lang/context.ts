import { ScopeResolver } from '../completion_utils';
import rust from './rust/context';
import typescript from './ts/context';

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
