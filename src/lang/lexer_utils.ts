import { map, sortBy } from '../misc';

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
export class Token {
    readonly span: Span;
    readonly kind?: string;
    private _prev?: Token;
    private _next?: Token;

    private constructor(span: Span, kind?: string, prev?: Token, next?: Token) {
        this.kind = kind;
        this.span = span;
        this._prev = prev;
        this._next = next;
    }

    get prev(): Token | undefined {
        return this._prev;
    }

    get next(): Token | undefined {
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
    static root(): Token {
        return new Token(new Span(0, 0));
    }

    /**
     * Appends a new token to the stream with the given properties.
     * Preserves the original next token.
     *
     * @returns The inserted token.
     */
    append(kind?: string, length: number = kind?.length ?? 0): Token {
        const node = new Token(
            new Span(this.span.begin, this.span.begin + length),
            kind,
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
    prepend(kind: string, length: number = kind.length): Token {
        const node = new Token(
            new Span(this.span.begin - length, this.span.begin),
            kind,
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

export type VocabularyConfig = {};

/** Specifies a vocabulary of tokens that can be used to tokenize a source file. */
export class Language {
    /**
     * Tokens matching an exact keywordose token names.
     * This are tested such that they must be a whole word.
     */
    keywords: Map<string, string>;

    /** Tokens matching exact strings. */
    strings: Map<string, string>;

    /** Tokens matching regular expressions. */
    patterns: Map<string, RegExp>;

    /**
     * If a pattern is assigned to the property `$ignore` determines which characters are ignored
     * before the first token and after each subsequent token (e.g., whitespace).
     */
    ignore?: RegExp;

    private constructor(
        keywords: readonly string[],
        strings: Map<string, string>,
        patterns: Map<string, RegExp>,
        ignore?: RegExp,
    ) {
        this.keywords = new Map(keywords.map(e => [e.toUpperCase(), e]));
        this.strings = strings;
        this.patterns = patterns;
        this.ignore = ignore;
    }

    /**
     * Returns a map of name-capture entries for each token.
     *
     * Evaluation order:
     * 1. String
     * 2. Keyword
     * 3. Pattern
     *
     * Precedence rules:
     * - **String:** Longer queries are matched first
     * - **Pattern:** Declaration order
     * - **Keyword:** Declaration order
     *
     * # Implementation
     *
     * An attempt was made to enforce vocabulary inheritance rules, but the consequences were:
     * 1. Too complex for not enough benefit
     * 2. Fragile API
     *
     * `declare` combines both string and pattern tokens to discourage clashing token names.
     */
    static newInstance(args: {
        declare: { [K in string]: string | RegExp };
        keywords?: readonly string[];
        inherit?: Language[];
        ignore?: RegExp;
    }): Language {
        const keywords = [...(args.keywords ?? [])];
        const strings: Record<string, string> = {};
        const patterns: Record<string, RegExp> = {};
        for (const parent of args.inherit ?? []) {
            for (const [name, query] of parent.strings.entries()) {
                strings[name] = query;
            }
            for (const [name, query] of parent.patterns.entries()) {
                patterns[name] = query;
            }
            for (const [_, kword] of parent.keywords) {
                keywords.push(kword);
            }
        }
        for (const name in args.declare) {
            if (typeof args.declare[name] === 'string') {
                strings[name] = args.declare[name];
            } else {
                patterns[name] = args.declare[name];
            }
        }
        return new Language(
            keywords,
            map(
                strings,
                sortBy(prop => prop.value.length),
            ),
            map(patterns),
            args.ignore,
        );
    }
}

/** Contains common language configurations. */
export namespace Language {
    export const BRACKETS = Language.newInstance({
        declare: {
            OPEN_PAR: '(',
            CLOSE_PAR: ')',
            OPEN_BRAC: '[',
            CLOSE_BRAC: ']',
            OPEN_CURLY: '{',
            CLOSE_CURLY: '}',
        },
    });

    export const ARITHMETIC = Language.newInstance({
        declare: {
            PLUS: '+',
            MINUS: '-',
            ASTERISK: '*',
            SLASH: '/',
        },
    });

    export const ARITHMETIC_ASSIGN = Language.newInstance({
        declare: {
            PLUS_ASSIGN: '+=',
            MINUS_ASSIGN: '-=',
            MULT_ASSIGN: '*=',
            DIV_ASSIGN: '/=',
        },
        inherit: [Language.ARITHMETIC],
    });

    export const REM_ASSIGN = Language.newInstance({
        declare: {
            REM: '%',
            REM_ASSIGN: '%=',
        },
    });

    export const BIT_OPS = Language.newInstance({
        declare: {
            AND: '&',
            OR: '|',
            XOR: '^',
            SHL: '<<',
            SHR: '>>',
        },
    });

    export const BIT_OPS_ASSIGN = Language.newInstance({
        declare: {
            AND_ASSIGN: '&=',
            OR_ASSIGN: '|=',
            XOR_ASSIGN: '^=',
            SHL_ASSIGN: '<<=',
            SHR_ASSIGN: '>>=',
        },
    });

    export const BOOL_LOGIC = Language.newInstance({
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

    export const C_COMMENTS = Language.newInstance({
        declare: {
            LINE_COMMENT: /\/\/.*/y,
            BLOCK_COMMENT: /\/\*[\s\S]*?\*\//y,
        },
    });

    export const C_PUNCT = Language.newInstance({
        declare: {
            EQUALS: '=',
            COLON: ':',
            DOT: '.',
            COMMA: ',',
            SEMICOLON: ';',
        },
    });

    export const C_ID = Language.newInstance({
        declare: {
            ID: /[a-zA-Z_][a-zA-Z_0-9]*/y,
        },
    });

    export const C_CHAR = Language.newInstance({
        declare: {
            CHAR: /'\\?.'/y,
        },
    });
}
