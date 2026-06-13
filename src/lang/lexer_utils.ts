import { AssertNoOverlap, AssertUniqueKeys, Key, map, sortBy } from '../misc';

/** Can be used to test for a token. */
export type Query = string | RegExp;

/**
 * Returns a record where each property is a keyword in the array
 * assigned to the name of the token emitted when it is matched,
 * which is the keyword in all uppercase letters.
 */
export function keywords(...kwords: string[]): Record<string, Query> {
    return Object.fromEntries(kwords.map(e => [e.toUpperCase(), e]));
}

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
    readonly kind: Kind | '';
    readonly span: Span;
    private _prev?: Token<Kind>;
    private _next?: Token<Kind>;

    private constructor(
        kind: Kind | '',
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
}

/**
 * Configuration properties for a vocabulary.
 * @param ignore If a pattern is assigned to the property `$ignore` determines which characters are ignored
 * before the first token and after each subsequent token (e.g., whitespace).
 * @param keywords List of keywords that are matched exactly, whose token names are
 * the keyword in all uppercase letters, and that are tested such that they must be a whole word.
 */
export type VocabularyConfig = {
    ignore?: RegExp;
    keywords?: readonly string[];
};

export type Vocabulary<TokenNames extends string> = {
    __brand?: TokenNames;
    tokens: Map<TokenNames, Query>;
    config: VocabularyConfig;
};

export namespace Vocabulary {
    export const BRACKETS = Vocabulary.newInstance({
        declare: {
            OPEN_PAR: '(',
            CLOSE_PAR: ')',
            OPEN_BRAC: '[',
            CLOSE_BRAC: ']',
            OPEN_CURLY: '{',
            CLOSE_CURLY: '}',
        },
    });

    export const ARITHMETIC = Vocabulary.newInstance({
        declare: {
            PLUS: '+',
            MINUS: '-',
            ASTERISK: '*',
            SLASH: '/',
        },
    });

    export const ARITHMETIC_ASSIGN = Vocabulary.newInstance({
        declare: {
            PLUS_ASSIGN: '+=',
            MINUS_ASSIGN: '-=',
            MULT_ASSIGN: '*=',
            DIV_ASSIGN: '/=',
        },
        inherit: [Vocabulary.ARITHMETIC],
    });

    export const REM_ASSIGN = Vocabulary.newInstance({
        declare: {
            REM: '%',
            REM_ASSIGN: '%=',
        },
    });

    export const BIT_OPS = Vocabulary.newInstance({
        declare: {
            AND: '&',
            OR: '|',
            XOR: '^',
            SHL: '<<',
            SHR: '>>',
        },
    });

    export const BIT_OPS_ASSIGN = Vocabulary.newInstance({
        declare: {
            AND_ASSIGN: '&=',
            OR_ASSIGN: '|=',
            XOR_ASSIGN: '^=',
            SHL_ASSIGN: '<<=',
            SHR_ASSIGN: '>>=',
        },
    });

    export const BOOL_LOGIC = Vocabulary.newInstance({
        declare: {
            AND_AND: '&&',
            OR_OR: '||',
            NOT: '!',
            LESS: '<',
            GREATER: '>',
            EQ_EQ: '==',
            NOT_EQ: '!=',
            LE: '<=',
            GE: '>=',
        },
    });

    export const C_COMMENTS = Vocabulary.newInstance({
        declare: {
            LINE_COMMENT: /\/\/.*/y,
            BLOCK_COMMENT: /\/\*[\s\S]*?\*\//y,
        },
    });

    export const C_PUNCT = Vocabulary.newInstance({
        declare: {
            EQUALS: '=',
            COLON: ':',
            DOT: '.',
            COMMA: ',',
            SEMICOLON: ';',
        },
    });

    export const C_ID = Vocabulary.newInstance({
        declare: {
            ID: /[a-zA-Z_][a-zA-Z_0-9]*/y,
        },
    });

    export const C_CHAR = Vocabulary.newInstance({
        declare: {
            CHAR: /'\\?.'/y,
        },
    });

    /**
     * Returns a map of name-capture entries for each token.
     *
     * The returned map is sorted by the length of each string query to ensure correct precedence.
     * For pattern queries, the length of the name of the token is used instead.
     * Both groups are sorted in ascending order.
     *
     * Strings queries are made the first entries in the map to defer
     * pattern testing and potentially improve performance.
     */
    export function newInstance<
        Entries extends Record<string, Query>,
        const Parents extends readonly Vocabulary<any>[],
    >(args: {
        declare: Entries & AssertNoOverlap<Entries, Parents> & VocabularyConfig;
        config?: VocabularyConfig;
        inherit?: Parents & AssertUniqueKeys<Parents>[];
    }): Vocabulary<(keyof Entries & string) | Key<Parents[number]>> {
        const vocab: Record<string, Query> = {};
        for (const parent of args.inherit ?? []) {
            for (const [key, value] of parent.tokens.entries()) {
                vocab[key] = value;
            }
        }
        Object.assign(vocab, args.declare);
        const tokens = map(
            vocab,
            sortBy(({ key, value }) =>
                typeof value === 'string' ? value.length : key.length,
            ),
            sortBy(({ key: _, value }) => (typeof value === 'string' ? -1 : 1)),
        );
        return {
            tokens,
            config: args.config ?? {},
        };
    }
}
