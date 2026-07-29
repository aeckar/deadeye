//! Scope data structure.
//!
//! Common dependency to both `completions.ts` and `scopes.ts`.
import { Span } from './misc'

/**
 * A member in the scope tree at a particular position in a file.
 *
 * Usage of type parameter `ScopeKind` ensures both:
 * 1. Intellisense recommends a pool of possible scopes
 * 2. Scope language is enforced at compile-time
 */
export class Scope<ScopeKind extends string> extends Span {
    constructor(
        /** The type of scope, as defined in `lang/<langId>/scopes.ts`. */
        readonly kind: ScopeKind,

        /**
         * The position of the first character of the scope marker
         * (`if`, `fn`, `impl`, `mod`, etc.), which is primarily useful to hot completions
         * that modify the scope signature.
         *
         * @see {@link markerTokenPos}
         */
        readonly markerPos: number,

        /**
         * The index of the marker token in the token stream.
         *
         * @see {@link markerPos}
         */
        readonly markerTokenPos: number,

        begin: number,
        end: number,
    ) {
        super(begin, end)
    }

    toString(): string {
        return `${this.kind}(${this.markerPos},${super.toString()})`
    }
}

export default Scope
