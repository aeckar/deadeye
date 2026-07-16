//! Algorithms and data structures for tokenizing language-specific input.
//!
//! For general utilities related to text manipulation, refer to `text_utils.ts`.
import { ALPHA, DIGIT, MAX_TOKEN_SEEK } from './completions'
import { Member, rebindToMap, sortBy, Span } from './misc'
import Tape from './tape'

export const CURLIES = ['OPEN_CURLY', 'CLOSE_CURLY'] as const

// =============================================================================================
// Identifier Rules
// =============================================================================================

/** Any input to {@link IdRule.resolve}. */
export type IdRuleResolvable =
    IdRule | Member<typeof IdRulePreset> | [string, string]

/** Contains the possiblities for the first and subsequent characters in an identifier. */
export class IdRule {
    constructor(
        readonly startPool: string,
        readonly partPool: string,
    ) {}

    isStart(ch: string): boolean {
        return this.startPool.includes(ch)
    }

    isPart(ch: string): boolean {
        return this.partPool.includes(ch)
    }

    /**
     * Presets:
     * - `STRICT`: ["", ""]
     * - `C_LIKE`: [ALPHA + "_", ALPHA + DIGIT + "_"]
     */
    static resolve(key: IdRuleResolvable): IdRule {
        if (key instanceof IdRule) {
            return key
        }
        return typeof key === 'string'
            ? IdRulePreset[`__${key}`]
            : new IdRule(key[0], key[1])
    }
}

/**
 * # API
 *
 * Members should not be accessed directly,
 * but should instead be obtained from {@link Language.resolve}.
 */
export class IdRulePreset {
    // https://stackoverflow.com/a/3609335/14178487
    /** Ensures identifiers never occur next to any starting or partial characters. */
    static __STRICT = new IdRule('', '')

    static __C_LIKE = new IdRule(ALPHA + '_', ALPHA + DIGIT + '_')
}

// =============================================================================================
// Token API
// =============================================================================================

/**
 * An identifier assigned to a token that is unique per language.
 *
 * Invalid source code is assigned a token of `UNKNOWN`.
 */
export type TokenKind = string & { __brand: 'TokenName' }

/**
 * Newtype over `string` to denote that the value should be equal to a valid `TokenKind`,
 * but that this cannot be guaranteed at compile-time.
 *
 * # Implementation
 *
 * Support for propogating {@link TokenKind} types was considered.
 * However, after much experimentation, it was deemed too complex to implement
 * without creating many foot-guns with the type system.
 */
export type UnknownTokenKind = string

/**
 * A token, implemented as a node in a linked list (token stream).
 *
 * Tokens matching an empty query will not be emitted.
 * Token streams always contain at least two elements: the head and tail.
 * Only these tokens are allowed to be zero-length.
 *
 * Special tokens:
 * - **Head:** undefined @ 0..0
 * - **Tail:** '' @ -1..-1
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
    static newStream(): Token {
        const head = new Token(0, 0)
        head._next = Token.tail(head)
        return head
    }

    private static tail(prev: Token) {
        return new Token(-1, -1, '' as TokenKind, prev)
    }

    /**
     * Appends a new token to the stream with the given properties, directly after in the input.
     * Preserves the original next token.
     *
     * If this is a tail node, does nothing and returns this instance.
     *
     * @returns The inserted token.
     */
    append(
        kind: TokenKind,
        length: number = kind.length /* works well with EOF */,
        start: number = this.end,
    ): Token {
        if (this.isTail) {
            return this
        }
        const oldNext = this._next
        const node = new Token(start, start + length, kind, this, oldNext)
        this._next = node
        if (oldNext) {
            oldNext._prev = node
        }
        return node
    }

    /**
     * Appends the given token stream to this. Preserves the original next token.
     *
     * If this is a tail node, does nothing.
     */
    appendAll(stream: Token) {
        if (this.isTail) {
            return
        }
        const oldNext = this._next
        stream.next._prev = this // unlink head
        this._next = stream.next
        while (!stream.isTail) {
            stream = stream.next
        }
        stream = stream.prev
        stream._next = oldNext // unlink tail
        if (oldNext) {
            oldNext._prev = stream
        }
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

    /** Deletes all nodes after this one, then appends the tail node. */
    deleteRest() {
        if (this.isTail) {
            return
        }
        let node = this.next
        do {
            // unlink all nodes to free memory
            node._prev = undefined
            const next = node.next
            node._next = undefined
            node = next
        } while (node)
        this._next = Token.tail(this)
    }

    /**
     * Returns an array containing every token in the stream, omitting the head and tail.
     *
     * For performance reasons, this function should only be used for debugging.
     */
    __all(): Token[] {
        let node = this as Token
        while (!node.isHead) {
            node = node.prev
        }
        node = node.next
        const stream: Token[] = []
        while (!node.isTail) {
            stream.push(node)
            node = node.next
        }
        return stream
    }
}

// =============================================================================================
// Language (Lexer) Description API
// =============================================================================================

/**
 * Configuration parameter for {@link Language}.
 * @see {@link Language.newInstance}
 */
export type LanguageCfg = {
    /** Each item supplied becomes a string or pattern token in this language. */
    readonly declare: Record<string, string | RegExp>

    /**
     * Each item supplied becomes a {@link Language} instance,
     * then inherits all tokens from that instance.
     *
     * # Implementation
     *
     * Care must be taken not to inherit from language presets before they are initialized.
     */
    readonly inherit?: LanguageResolvable[]

    /** @see {@link Language.keywords} */
    readonly keywords?: readonly string[]

    /** @see {@link Language.ignore} */
    readonly ignore?: RegExp

    /** @see {@link Language.idRule} */
    readonly idRule?: IdRuleResolvable
}

/** Any input to {@link Language.resolve}. */
export type LanguageResolvable = Language | Member<typeof LanguagePreset>

/** Specifies a vocabulary of tokens that can be used to tokenize a source file. */
export class Language {
    private constructor(
        /**
         * Tokens matching an exact keywordose token names.
         * This are tested such that they must be a whole word.
         */
        readonly keywords: Map<TokenKind, string>,

        /** Tokens matching exact strings. */
        readonly strings: Map<TokenKind, string>,

        /** Tokens matching regular expressions. */
        readonly patterns: Map<TokenKind, RegExp>,

        /**
         * If a pattern is assigned to the property `$ignore` determines which characters are ignored
         * before the first token and after each subsequent token (e.g., whitespace).
         */
        readonly ignore: RegExp | undefined,

        /**
         * Used to determine boundaries between keywords and other tokens.
         *
         * Defaults to `IdentifierBounds.EXACT`.
         */
        readonly idRule: IdRule,
    ) {}

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
            const lang = Language.resolve(parent)
            for (const [kind, query] of lang.strings.entries()) {
                strings[kind] = query
            }

            // For keywords and patterns, collect from parent as last step to ensure
            // locally defined tokens are parsed first.
            for (const [kind, query] of lang.patterns.entries()) {
                patterns[kind] = query
            }
            for (const [_, kword] of lang.keywords) {
                keywords.push(kword)
            }
        }
        return new Language(
            new Map(keywords.map(e => [e.toUpperCase() as TokenKind, e])),
            rebindToMap(
                strings,
                sortBy(prop => -prop.value.length), // parse longer tokens first
            ),
            rebindToMap(patterns),
            cfg.ignore,
            IdRule.resolve(cfg.idRule ?? IdRule.resolve('STRICT')),
        )
    }

    static resolve(key: LanguageResolvable): Language {
        return typeof key === 'string' ? LanguagePreset[`__${key}`] : key
    }

    /**
     * Returns the token stream found within the given source code.
     *
     * If `target` is a string, it is converted to a `Tape` with the `idRule` of the given language.
     */
    tokenize(target: string | Tape): Token {
        const tape =
            typeof target === 'string'
                ? Tape.over(target, 0, this.idRule)
                : target
        const root = Token.newStream()
        let node = root
        this.skip(tape)
        while (!tape.isExhausted()) {
            const start = tape.pos

            // === 1. Test Keywords ===
            for (const [name, kword] of this.keywords) {
                if (tape.isAtIdentifier(kword)) {
                    // Execute check for letter on both ends,
                    // as some keywords contain leading/trailing symbols
                    node = node.append(name, kword.length, tape.pos)
                    tape.pos += kword.length
                    break
                }
            }
            if (tape.pos !== start) {
                this.skip(tape)
                continue
            }

            // === 2. Test Strings ===
            for (const [name, query] of this.strings.entries()) {
                if (tape.isAt(query)) {
                    node = node.append(name, query.length, tape.pos)
                    tape.pos += query.length
                }
            }
            if (tape.pos !== start) {
                this.skip(tape)
                continue
            }

            // === 3. Test Patterns ===
            for (const [name, query] of this.patterns.entries()) {
                query.lastIndex = tape.pos
                if (query.test(tape.raw)) {
                    const length = query.lastIndex - tape.pos
                    node = node.append(name as TokenKind, length, tape.pos)
                    tape.pos += length
                    break
                }
            }
            if (tape.pos !== start) {
                this.skip(tape)
                continue
            }

            // === 4. Attempt Recovery ===
            if (tape.isExhausted()) {
                continue
            }
            while (!tape.isExhausted() && tape.raw[tape.pos] !== '\n') {
                // Advance past the rest of the current line (or to EOF)
                tape.pos += 1
            }
            if (tape.pos === start) {
                // Stuck on newline itself; skip it so we always make progress
                tape.pos += 1
            }
            node = node.append('UNKNOWN' as TokenKind, tape.pos - start, start)
        }
        return root
    }

    private skip(tape: Tape) {
        const pattern = this.ignore
        if (!pattern) {
            return
        }
        pattern.lastIndex = tape.pos
        if (pattern.test(tape.raw)) {
            tape.pos = pattern.lastIndex // advance cursor
        }
    }
}

/**
 * Constants must be defined as static variables in this class,
 * since declaration as plain object incurs errors due to recursive reference of `inherit`.
 *
 * Since {@link Language.newInstance} accesses this class before it is initialized,
 * members must inherit from instances and not member keys.
 *
 * # API
 *
 * Members should not be accessed directly,
 * but should instead be obtained from {@link Language.resolve}.
 */
export class LanguagePreset {
    static __BRACKETS = Language.newInstance({
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
    static __ARITH = Language.newInstance({
        declare: {
            PLUS: '+',
            MINUS: '-',
            ASTERISK: '*',
            SLASH: /\/(?![/*])/y,
        },
    })

    static __ARITH_ASSIGN = Language.newInstance({
        declare: {
            PLUS_ASSIGN: '+=',
            MINUS_ASSIGN: '-=',
            MULT_ASSIGN: '*=',
            DIV_ASSIGN: '/=',
        },
        inherit: [LanguagePreset.__ARITH],
    })

    static __REM_ASSIGN = Language.newInstance({
        declare: {
            REM: '%',
            REM_ASSIGN: '%=',
        },
    })

    static __BIT_OPS = Language.newInstance({
        declare: {
            AND: '&',
            OR: '|',
            XOR: '^',
            SHL: '<<',
            SHR: '>>',
        },
    })

    static __BIT_OPS_ASSIGN = Language.newInstance({
        declare: {
            AND_ASSIGN: '&=',
            OR_ASSIGN: '|=',
            XOR_ASSIGN: '^=',
            SHL_ASSIGN: '<<=',
            SHR_ASSIGN: '>>=',
        },
        inherit: [LanguagePreset.__BIT_OPS],
    })

    static __BOOL_LOGIC = Language.newInstance({
        declare: {
            AND_AND: '&&',
            OR_OR: '||',
            BANG: '!',
            LESS: '<',
            GREATER: '>',
            EQ_EQ: '==',
            NOT_EQ: '!=',
            LE: '<=',
            GE: '>=',
        },
    })

    static __C_COMMENTS = Language.newInstance({
        declare: {
            LINE_COMMENT: /\/\/.*/y,
            BLOCK_COMMENT: /\/\*[\s\S]*?\*\//y,
        },
    })

    static __C_PUNCT = Language.newInstance({
        declare: {
            EQUALS: '=',
            COLON: ':',
            DOT: '.',
            COMMA: ',',
            SEMICOLON: ';',
        },
    })

    static __C_ID = Language.newInstance({
        declare: {
            ID: /[a-zA-Z_][a-zA-Z_0-9]*/y,
        },
    })

    static __C_CHAR = Language.newInstance({
        declare: {
            CHAR: /'\\?.'/y,
        },
    })
}
