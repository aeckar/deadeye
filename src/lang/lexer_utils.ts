import {
    AssertNoOverlap,
    AssertUniqueKeys,
    Keys,
    map,
    sortBy,
    UniqueKeys,
} from '../misc';

/** A range of indices. */
export class Span {
    /** The index of the first element. */
    begin: number;

    /** The index of the last element (exclusive). */
    end: number;

    constructor(begin: number, end: number) {
        this.begin = begin;
        this.end = end;
    }

    get length() {
        return this.end - this.begin;
    }
}

/** A token, implemented as a node in a linked list. */
export class Token<Kind extends string> {
    readonly kind: Kind;
    readonly span: Span;
    private _prev?: Token<Kind>;
    private _next?: Token<Kind>;

    private constructor(
        kind: Kind,
        span: Span,
        prev?: Token<Kind>,
        next?: Token<Kind>,
    ) {
        this.kind = kind;
        this.span = span;
        this._prev = prev;
        this._next = next;
    }

    get prev(): Token<Kind> | undefined {
        return this._prev;
    }

    get next(): Token<Kind> | undefined {
        return this._next;
    }

    /**
     * Returns the first token in the token stream.
     *
     * The {@link kind} of the root token is always an empty string.
     *
     * The returned token should act as an anchor for all trailing tokens.
     * Once the token stream is complete, this node is popped from the beginning of the list.
     */
    static root<Kind extends string>(): Token<Kind> {
        return new Token('' as Kind, new Span(0, 0));
    }

    /**
     * Appends a new token to the stream with the given properties.
     * Preserves the original next token.
     *
     * @returns The inserted token.
     */
    append(kind: Kind, length: number = kind.length): Token<Kind> {
        const node = new Token(
            kind,
            new Span(this.span.begin, this.span.begin + length),
            this,
            this._next,
        );
        this._next = node;
        if (this._next) {
            this._next._prev = node;
        }
        return node;
    }

    /**
     * Prepends a new token to the stream with the given properties.
     * Preserves the original previous token
     *
     * @returns The inserted token.
     */
    prepend(kind: Kind, length: number = kind.length): Token<Kind> {
        const node = new Token(
            kind,
            new Span(this.span.begin - length, this.span.begin),
            this._prev,
            this,
        );
        this._prev = node;
        if (this._prev) {
            this._prev._next = node;
        }
        return node;
    }

    // todo cascade changes
}
export type Vocabulary<TokenNames extends string> = Map<TokenNames, string> & {
    __brand?: TokenNames;
};

export namespace Vocabulary {
    export const BRACKETS = Vocabulary.newInstance({
        OPEN_PAR: '(',
        CLOSE_PAR: ')',
        OPEN_BRAC: '[',
        CLOSE_BRAC: ']',
        OPEN_CURLY: '{',
        CLOSE_CURLY: '}',
    });

    /**
     * Returns a map of name-capture entries for each token.
     *
     * The returned map is sorted by length to ensure correct precedence.
     */
    export function newInstance<
        Entries extends Record<string, string>,
        const Parents extends readonly Vocabulary<any>[],
    >(
        entries: Entries & AssertNoOverlap<Entries, Parents>,
        ...parents: Parents & AssertUniqueKeys<Parents>
    ): Vocabulary<(keyof Entries & string) | Keys<Parents[number]>> {
        const vocab: Record<string, string> = {};

        for (const parent of parents) {
            for (const [key, value] of parent.entries()) {
                vocab[key] = value;
            }
        }

        Object.assign(vocab, entries);
        return new Map(Object.entries(vocab)) as any;
    }
}
