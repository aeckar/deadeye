//! Common scope-related utilities used by both scope registry API and completion registry API.
//!
//! Unlike `scope_registry_utils.ts`, focuses on scope data visible to the completion API.
import { Span } from './misc_utils'

/**
 * A possible configuration of nested scopes.
 *
 * Scope kinds may be prefixed by `...` to indicate any sequence of scopes leading to that one.
 *
 * Nested scopes are not required to be adjacent; they must simply be present in the same order.
 * If not provided as an argument, the completion is matched in all scopes.
 * Passing an empty array is considered to be the top-level scope.
 *
 * @see {@link Scope}
 */
export type ScopeSelector<ScopeKind extends string> = (
    ScopeKind | `...${ScopeKind}`
)[]

/**
 * A member in the scope tree at a particular position in a file.
 *
 * Usage of type parameter `ScopeKind` ensures both:
 * 1. Intellisense recommends a pool of possible scopes
 * 2. Scope language is enforced at compile-time
 *
 * @see {@link ScopeSelector}
 */
export class Scope<ScopeKind extends string> extends Span {
    constructor(
        /** The type of scope, as defined in `lang/<langId>/scopes.ts`. */
        readonly kind: ScopeKind,

        /**
         * The position of the first character of the scope marker
         * (`if`, `fn`, `impl`, `mod`, etc.), which is primarily useful to hot completions
         * that modify the scope signature.
         */
        readonly markerPos: number,
        begin: number,
        end: number,
    ) {
        super(begin, end)
    }

    toString(): string {
        return `${this.kind} @ [${this.markerPos}, ${super.toString()}]`
    }
}
