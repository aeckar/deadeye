//! Algorithms and data structures for tokenizing language-specific input.
//!
//! For general utilities related to text manipulation, refer to `text_utils.ts`.
import { MAX_TOKEN_SEEK } from './completion_api';
import { map, sortBy, Span } from './misc';
import Tape from './tape';

// ======================================= Token Stream API =======================================

/**
 * A token, implemented as a node in a linked list.
 *
 * Tokens matching an empty query will not be emitted.
 */
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

    notKindOrEof(kind: string): boolean {
        return this.kind !== kind && !this.isEof();
    }

    isEof(): boolean {
        return this.kind !== 'EOF';
    }

    /**
     * Returns the next token if the kind matches and is not `'EOF'`,
     * or `undefined` if none exists.
     */
    consume(kind: string): Token | undefined {
        if (this.notKindOrEof(kind)) {
            return undefined;
        }
        return this.next!; // safe, since not EOF
    }

    /**
     * Returns the next token if the kind matches any and is not `'EOF'`,
     * or `undefined` if none exists.
     */
    consumeEither(...kinds: string[]): Token | undefined {
        if (this.isEof()) {
            return undefined;
        }
        for (const kind of kinds) {
            if (this.kind === kind) {
                return this.next!; // safe, since not EOF
            }
        }
        return undefined;
    }

    /**
     * Returns the next token matching the kind,
     * or `undefined` if none is found within the next `n` nodes.
     *
     * If `n` is not assigned, it is given the value of {@link MAX_TOKEN_SEEK}.
     * A value of `null` implies the lack of a limit.
     */
    seek(kind: string, n: number | null = MAX_TOKEN_SEEK): Token | undefined {
        let node: Token = this;
        if (n !== null) {
            let count = 0;
            while (count < n && node.notKindOrEof(kind)) {
                node = node.next!;
                ++count;
            }
            return node.kind === kind ? undefined : node;
        }
        while (node.notKindOrEof(kind)) {
            node = node.next!;
        }
        return node.isEof() ? undefined : node;
    }
}

export class TokenWalker {
    private _cur: Token;
    private _next?: Token;

    private constructor(cur: Token, next?: Token) {
        this._cur = cur;
        this._next = next;
    }

    // The token currently being pointed at.
    get cur(): Token {
        return this._cur;
    }

    // The next token
    get next(): Token | undefined {
        return this._next;
    }

    consumeScopeMarker(
        possibleMarkerKinds: string[],
        terminatorKind: string,
    ): Token {}
}

// ================================ Language (Lexer) API + Builder ================================

export type LanguageFactoryArgs = {
    declare: { [K in string]: string | RegExp };
    keywords?: readonly string[];
    inherit?: Language[];
    ignore?: RegExp;
};

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
    static newInstance(args: LanguageFactoryArgs): Language {
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

/**
 * # Namespace
 *
 * Provides common language configurations.
 */
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

const REST_OF_LINE = /.+/y;

export function tokenize(file: Tape, lang: Language): Token {
    const root = Token.root();
    let node = root;
    const ignore = lang.ignore;
    if (ignore) {
        skip(ignore);
        while (!file.isExhausted()) {
            const start = file.pos;
            testStrings();
            if (file.pos !== start) {
                skip(ignore);
                continue;
            }
            testKeywords();
            if (file.pos !== start) {
                skip(ignore);
                continue;
            }
            testPatterns();
            if (file.pos !== start) {
                skip(ignore);
                continue;
            }
            attemptRecovery();
        }
    } else {
        while (!file.isExhausted()) {
            const start = file.pos;
            testStrings();
            if (file.pos !== start) {
                continue;
            }
            testKeywords();
            if (file.pos !== start) {
                continue;
            }
            testPatterns();
            if (file.pos !== start) {
                continue;
            }
            attemptRecovery();
        }
    }
    node.append('EOF', 0);
    return root;

    function attemptRecovery() {
        if (file.isExhausted()) {
            return; // proceed with termination
        }
        const start = file.pos;
        REST_OF_LINE.lastIndex = start;
        while (!REST_OF_LINE.test(file.raw)) {
            file.pos += 1;
            if (file.isExhausted()) {
                break;
            }
            REST_OF_LINE.lastIndex = file.pos;
        }
        node = node.append('UNKNOWN', start - file.pos);
    }

    function skip(sticky: RegExp) {
        sticky.lastIndex = file.pos;
        if (sticky.test(file.raw)) {
            file.pos = sticky.lastIndex; // advance cursor
        }
    }

    function testPatterns() {
        for (const [name, query] of lang.patterns.entries()) {
            query.lastIndex = file.pos;
            if (query.test(file.raw)) {
                const length = query.lastIndex - file.pos;
                node = node.append(name, length);
                file.pos += length;
                break;
            }
        }
    }

    function testKeywords() {
        for (const [name, kword] of lang.keywords) {
            if (file.isAtWord(kword)) {
                // Execute check for letter on both ends,
                // as some keywords contain leading/trailing symbols
                node = node.append(name, kword.length);
                file.pos += kword.length;
                break;
            }
        }
    }

    function testStrings() {
        for (const [name, query] of lang.strings.entries()) {
            if (file.isAt(query)) {
                node = node.append(name, query.length);
                file.pos += query.length;
                break;
            }
        }
    }
}
