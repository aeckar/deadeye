import { ScopeResolver } from '../scoping_utils';
import rust from './rust/scoping';
import typescript from './ts/scoping';

const scopeResolvers: Record<string, ScopeResolver<any>> = {
    rust,
    typescript,
};

export default scopeResolvers;

// todo create shared utils, shorthands for c-like languages/ts & js/js frameworks
// todo bash/batch/powershell
// no dockerfile/docker-compose support, since simple enough + case-insensitive

//this.<var> = <arg> in ctor
