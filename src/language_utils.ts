//! Algorithms and data structures for tokenizing language-specific input.
//!
//! For general utilities related to text manipulation, refer to `text_utils.ts`.
import { MAX_TOKEN_SEEK } from './completion_registry_utils'
import { map, sortBy, Span } from './misc'
import Tape from './tape'
import { IdentifierRule } from './text_utils'

export const CURLIES = ['OPEN_CURLY', 'CLOSE_CURLY'] as const

// ======================================= Token API =======================================

/** An identifier assigned to a token that is unique per language. */
export type TokenKind = string & { __brand: 'TokenName' }

/**
 * Newtype over `string` to denote that the value should be equal to a valid `TokenKind`,
 * but that this cannot be guaranteed at compile-time.
 */
export type UnknownTokenKind = string

/**
 * A token, implemented as a node in a linked list (token stream).
 *
 * Tokens matching an empty query will not be emitted.
 * Token streams always contain at least two elements: the root node and the EOF node.
 *
 * Special token kinds:
 * - **Head:** `undefined`
 * - **Tail:** `''`
 *
 * Whether a token is special can be checked easily by using its kind as a condition itself,
 * since special token kinds are falsey.
 */
export class Token extends Span {
    private constructor(
        begin: number,
        end: number,
        readonly kind?: TokenKind,
        private _prev?: Token,
        private _next?: Token,
    ) {
        super(begin, end)
    }

    get prev(): Token {
        return this._prev!
    }

    get next(): Token {
        return this._next!
    }

    toString(): string {
        let kind: string
        if (this.isHead) {
            kind = '<head>'
        } else if (this.isTail) {
            kind = '<tail>'
        } else {
            kind = this.kind!
        }
        return `${kind} @ ${this.begin}..${this.end}`
    }

    /**
     * Returns the first token in the token stream.
     *
     * The {@link kind} of the root token is always an empty string.
     *
     * The returned token should act as an anchor for all trailing tokens.
     * Once the token stream is complete, this node is popped from the beginning of the list.
     */
    static head(): Token {
        const root = new Token(0, 0)
        root.append('' as TokenKind)
        return root
    }

    /**
     * Appends a new token to the stream with the given properties, directly after in the input.
     * Preserves the original next token.
     *
     * @returns The inserted token.
     */
    append(
        kind: TokenKind,
        length: number = kind.length /* works well with EOF */,
        start: number = this.end,
    ): Token {
        const oldNext = this._next
        const node = new Token(start, start + length, kind, this, oldNext)
        this._next = node
        if (oldNext) {
            oldNext._prev = node
        }
        return node
    }

    isNotKindNorTail(kind: string): boolean {
        return this.kind !== kind && !this.isTail
    }

    get isHead(): boolean {
        return this.kind === undefined
    }

    get isTail(): boolean {
        return this.kind === ''
    }

    /**
     * Returns the next token if the kind matches and is not `'EOF'`,
     * or `undefined` if none exists.
     */
    consume(kind: string): Token | undefined {
        if (this.isNotKindNorTail(kind)) {
            return undefined
        }
        return this.next! // safe, since not EOF
    }

    /**
     * Returns the next token if the kind matches any and is not `'EOF'`,
     * or `undefined` if none exists.
     */
    consumeEither(...kinds: string[]): Token | undefined {
        if (this.isTail) {
            return undefined
        }
        for (const kind of kinds) {
            if (this.kind === kind) {
                return this.next! // safe, since not EOF
            }
        }
        return undefined
    }

    /**
     * Returns the next token matching the kind,
     * or `undefined` if none is found within the next `n` nodes.
     *
     * If `n` is not assigned, it is given the value of {@link MAX_TOKEN_SEEK}.
     * A value of `null` implies the lack of a limit.
     */
    seek(kind: string, n: number | null = MAX_TOKEN_SEEK): Token | undefined {
        let node: Token = this as Token
        if (n !== null) {
            let count = 0
            while (count < n && node.isNotKindNorTail(kind)) {
                node = node.next!
                ++count
            }
            return node.kind === kind ? node : undefined
        }
        while (node.isNotKindNorTail(kind)) {
            node = node.next!
        }
        return node.isTail ? undefined : node
    }
}

// ================================ Language (Lexer) API + Builder ================================

export type LanguageCfg = {
    declare: { [K in string]: string | RegExp }
    keywords?: readonly string[]
    inherit?: readonly Language[]
    ignore?: RegExp
    identifiers?: IdentifierRule
}

/** Specifies a vocabulary of tokens that can be used to tokenize a source file. */
export class Language {
    /**
     * Tokens matching an exact keywordose token names.
     * This are tested such that they must be a whole word.
     */
    keywords: Map<TokenKind, string>

    /** Tokens matching exact strings. */
    strings: Map<TokenKind, string>

    /** Tokens matching regular expressions. */
    patterns: Map<TokenKind, RegExp>

    /**
     * If a pattern is assigned to the property `$ignore` determines which characters are ignored
     * before the first token and after each subsequent token (e.g., whitespace).
     */
    ignore?: RegExp

    /**
     * Used to determine boundaries between keywords and other tokens.
     *
     * Defaults to `IdentifierBounds.EXACT`.
     */
    identifiers: IdentifierRule

    private constructor(
        keywords: readonly string[],
        strings: Map<TokenKind, string>,
        patterns: Map<TokenKind, RegExp>,
        ignore?: RegExp,
        identifiers?: IdentifierRule,
    ) {
        this.keywords = new Map(
            keywords.map(e => [e.toUpperCase() as TokenKind, e]),
        )
        this.strings = strings
        this.patterns = patterns
        this.ignore = ignore
        this.identifiers = identifiers ?? IdentifierRule.STRICT
    }

    /**
     * Returns a map of name-capture entries for each token.
     *
     * Keywords are not strictly language keywords, but rather tokens whose kind is the same as
     * its matching string in all uppercase. They are given precedence over ordinary string tokens.
     *
     * Evaluation order:
     * 1. Keyword
     * 2. String
     * 3. Pattern
     *
     * Precedence rules:
     * - **Keyword:** Declaration order, declared first
     * - **String:** Longer queries are matched first
     * - **Pattern:** Declaration order, declared first
     *
     * # Implementation
     *
     * An attempt was made to enforce vocabulary inheritance rules, but the consequences were:
     * 1. Too complex for not enough benefit
     * 2. Fragile API
     *
     * `declare` combines both string and pattern tokens to discourage clashing token names.
     */
    static newInstance(cfg: LanguageCfg): Language {
        const keywords = [...(cfg.keywords ?? [])]
        const strings: Record<TokenKind, string> = {}
        const patterns: Record<TokenKind, RegExp> = {}
        for (const kind in cfg.declare) {
            if (typeof cfg.declare[kind] === 'string') {
                strings[kind as TokenKind] = cfg.declare[kind]
            } else {
                patterns[kind as TokenKind] = cfg.declare[kind]
            }
        }
        for (const parent of cfg.inherit ?? []) {
            for (const [kind, query] of parent.strings.entries()) {
                strings[kind] = query
            }

            // For keywords and patterns, collect from parent as last step to ensure
            // locally defined tokens are parsed first.
            for (const [kind, query] of parent.patterns.entries()) {
                patterns[kind] = query
            }
            for (const [_, kword] of parent.keywords) {
                keywords.push(kword)
            }
        }
        return new Language(
            keywords,
            map(
                strings,
                sortBy(prop => -prop.value.length), // parse longer tokens first
            ),
            map(patterns),
            cfg.ignore,
            cfg.identifiers,
        )
    }

    static BRACKETS = Language.newInstance({
        declare: {
            OPEN_PAREN: '(',
            CLOSE_PAREN: ')',
            OPEN_BRAC: '[',
            CLOSE_BRAC: ']',
            OPEN_CURLY: '{',
            CLOSE_CURLY: '}',
        },
    })

    /** Handles ambiguity between slash operator and comments */
    static C_MATH = Language.newInstance({
        declare: {
            PLUS: '+',
            MINUS: '-',
            ASTERISK: '*',
            SLASH: /\/(?![/*])/y,
        },
    })

    static C_MATH_ASSIGN = Language.newInstance({
        declare: {
            PLUS_ASSIGN: '+=',
            MINUS_ASSIGN: '-=',
            MULT_ASSIGN: '*=',
            DIV_ASSIGN: '/=',
        },
        inherit: [Language.C_MATH],
    })

    static REM_ASSIGN = Language.newInstance({
        declare: {
            REM: '%',
            REM_ASSIGN: '%=',
        },
    })

    static BIT_OPS = Language.newInstance({
        declare: {
            AND: '&',
            OR: '|',
            XOR: '^',
            SHL: '<<',
            SHR: '>>',
        },
    })

    static BIT_OPS_ASSIGN = Language.newInstance({
        declare: {
            AND_ASSIGN: '&=',
            OR_ASSIGN: '|=',
            XOR_ASSIGN: '^=',
            SHL_ASSIGN: '<<=',
            SHR_ASSIGN: '>>=',
        },
        inherit: [Language.BIT_OPS],
    })

    static BOOL_LOGIC = Language.newInstance({
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
    })

    static C_COMMENTS = Language.newInstance({
        declare: {
            LINE_COMMENT: /\/\/.*/y,
            BLOCK_COMMENT: /\/\*[\s\S]*?\*\//y,
        },
    })

    static C_PUNCT = Language.newInstance({
        declare: {
            EQUALS: '=',
            COLON: ':',
            DOT: '.',
            COMMA: ',',
            SEMICOLON: ';',
        },
    })

    static C_ID = Language.newInstance({
        declare: {
            ID: /[a-zA-Z_][a-zA-Z_0-9]*/y,
        },
    })

    static C_CHAR = Language.newInstance({
        declare: {
            CHAR: /'\\?.'/y,
        },
    })
}

export function tokenize(file: Tape, lang: Language): Token {
    const root = Token.head()
    let node = root
    const ignore = lang.ignore

    if (ignore) {
        skip(ignore)
        while (!file.isExhausted()) {
            const start = file.pos
            testKeywords()
            if (file.pos !== start) {
                skip(ignore)
                continue
            }
            testStrings()
            if (file.pos !== start) {
                skip(ignore)
                continue
            }
            testPatterns()
            if (file.pos !== start) {
                skip(ignore)
                continue
            }
            attemptRecovery()
        }
    } else {
        while (!file.isExhausted()) {
            const start = file.pos
            testKeywords()
            if (file.pos !== start) {
                continue
            }
            testStrings()
            if (file.pos !== start) {
                continue
            }
            testPatterns()
            if (file.pos !== start) {
                continue
            }
            attemptRecovery()
        }
    }
    return root

    function attemptRecovery() {
        if (file.isExhausted()) {
            return // proceed with termination
        }
        const start = file.pos
        // Advance past the rest of the current line (or to EOF)
        while (!file.isExhausted() && file.raw[file.pos] !== '\n') {
            file.pos += 1
        }
        if (file.pos === start) {
            // Stuck on a newline itself — skip it so we always make progress
            file.pos += 1
        }
        node = node.append('UNKNOWN' as TokenKind, file.pos - start, start)
    }

    function skip(sticky: RegExp) {
        sticky.lastIndex = file.pos
        if (sticky.test(file.raw)) {
            file.pos = sticky.lastIndex // advance cursor
        }
    }

    function testPatterns() {
        for (const [name, query] of lang.patterns.entries()) {
            query.lastIndex = file.pos
            if (query.test(file.raw)) {
                const length = query.lastIndex - file.pos
                node = node.append(name as TokenKind, length, file.pos)
                file.pos += length
                break
            }
        }
    }

    function testKeywords() {
        for (const [name, kword] of lang.keywords) {
            if (file.isAtIdentifier(kword)) {
                // Execute check for letter on both ends,
                // as some keywords contain leading/trailing symbols
                node = node.append(name, kword.length, file.pos)
                file.pos += kword.length
                break
            }
        }
    }

    function testStrings() {
        for (const [name, query] of lang.strings.entries()) {
            if (file.isAt(query)) {
                node = node.append(name, query.length, file.pos)
                file.pos += query.length
                break
            }
        }
    }
}
