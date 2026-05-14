import { ScopeResolver } from "@/scope_utils";
import rust from "./rust/scopes";

const scopeResolvers: Record<string, ScopeResolver<any>> = {
    rust,
};

export default scopeResolvers;