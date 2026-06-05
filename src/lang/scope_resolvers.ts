import { ScopeResolver } from '../scope_utils';
import rust from './rust/scopes';

const scopeResolvers: Record<string, ScopeResolver<any>> = {
    rust,
};

export default scopeResolvers;

// todo create shared utils, shorthands for c-like languages/ts & js/js frameworks
// todo bash/batch/powershell
// no dockerfile/docker-compose support, since simple enough + case-insensitive