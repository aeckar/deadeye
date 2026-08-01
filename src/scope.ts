//! Scope data structure.
//!
//! Common dependency to both Completion API and Scope API.
import { Span } from '@/utils/strings'

/**
 * A member in the scope tree at a particular position in a file.
 *
 * Usage of type parameter `ScopeKind` ensures both:
 * 1. Intellisense recommends a pool of possible scopes
 * 2. Scope language is enforced at compile-time
 */
export class Scope<ScopeKind extends string> extends Span {
    private constructor(
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
        return `${this.kind}(#${this.markerTokenPos},${this.markerPos},${super.toString()})`
    }

    static newInstance<ScopeKind extends string>(
        kind: ScopeKind,
        markerPos: number,
        markerTokenPos: number,
        begin: number,
        end: number,
    ): Scope<ScopeKind> {
        return new this(kind, markerPos, markerTokenPos, begin, end)
    }
}

export default Scope
