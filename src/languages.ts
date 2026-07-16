//! Algorithms and data structures for tokenizing language-specific input.
//!
//! For general utilities related to text manipulation, refer to `text_utils.ts`.
import { ALPHA, DIGIT, MAX_TOKEN_SEEK } from './completions'
import { Member, rebindToMap, sortBy, Span } from './misc'
import Tape from './tape'

// These are stored outside of `Language` for easy access by configurations
export const CURLIES = ['OPEN_CURLY', 'CLOSE_CURLY'] as const
export const PARENS = ['OPEN_PAREN', 'CLOSE_PAREN'] as const

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

/** A unique numerical identifier. */
export type Tag = number & { __brand: 'Tag' }

/** Wraps each object with a tag, according to a counter held by this instance. */
export class Tagger {
    private count = 0

    tag<T>(value: T): Tagged<T> {
        const next = new Tagged(this.count as Tag, value)
        this.count += 1
        return next
    }
}

/** An object assigned tag. */
export class Tagged<T> {
    constructor(
        readonly tag: Tag,
        readonly value: T,
    ) {}
}

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
 *
 * This type is not branded so users do not need to perform a cast just
 * to provide these values to a configuration object
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
 * - **Head:** `'<head>' @ 0..0`
 * - **Tail:** `'<tail>' @ -1..-1`
 * - **Unknown:** `'<unknown>' @ {begin}..{end}`
 */
export class Token extends Span {
    private constructor(
        begin: number,
        end: number,
        readonly tag: Tag,
        readonly kind: TokenKind,
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

    get isHead(): boolean {
        return this.tag === Token.HEAD_TAG
    }

    get isTail(): boolean {
        return this.tag === Token.TAIL_TAG
    }

    get isUnknown(): boolean {
        return this.tag === Token.UNKNOWN_TAG
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

    static readonly HEAD_KIND: TokenKind = '<head>' as TokenKind
    static readonly TAIL_KIND: TokenKind = '<tail>' as TokenKind
    static readonly UNKNOWN_KIND: TokenKind = '<unknown>' as TokenKind
    static readonly HEAD_TAG = -1 as Tag
    static readonly TAIL_TAG = -2 as Tag
    static readonly UNKNOWN_TAG = -3 as Tag

    /**
     * Returns the first token in the token stream.
     *
     * The {@link kind} of the root token is always an empty string.
     *
     * The returned token should act as an anchor for all trailing tokens.
     * Once the token stream is complete, this node is popped from the beginning of the list.
     */
    static newStream(): Token {
        const head = new Token(0, 0, Token.HEAD_TAG, Token.HEAD_KIND)
        head.appendTail()
        return head
    }

    private appendTail() {
        this._next = new Token(-1, -1, Token.TAIL_TAG, Token.TAIL_KIND, this)
    }

    appendUnknown(length: number, start: number): Token {
        return this.append(Token.UNKNOWN_TAG, Token.UNKNOWN_KIND, length, start)
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
        tag: Tag,
        kind: TokenKind,
        length: number = kind.length /* works well with EOF */,
        start: number = this.end,
    ): Token {
        if (this.isTail) {
            return this
        }
        const oldNext = this._next
        const node = new Token(start, start + length, tag, kind, this, oldNext)
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
                count += 1
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
        this.appendTail()
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

/** Parses tokens manually as a last resort when strings and regexes will not suffice. */
export type TokenResolver = (tape: Tape) => string

/**
 * Configuration parameter for {@link Language}.
 * @see {@link Language.newInstance}
 */
export type LanguageCfg = {
    /** Each item supplied becomes a string or pattern token in this language. */
    readonly declare: Record<string, string | RegExp | TokenResolver>

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
    readonly $ignore?: RegExp

    /** @see {@link Language.idRule} */
    readonly $idRule?: IdRuleResolvable
}

/** Any input to {@link Language.resolve}. */
export type LanguageResolvable = Language | Member<typeof LanguagePreset>

/** Specifies a vocabulary of tokens that can be used to tokenize a source file. */
export class Language {
    private readonly tagsForKinds: Map<TokenKind, Tag>
    private readonly kindsForTags: Map<Tag, TokenKind>
    private readonly matchingCloseTags: Map<Tag, Tag>
    private readonly matchingOpenTags: Map<Tag, Tag>

    private constructor(
        /**
         * Tokens matching an exact keywordose token names.
         * This are tested such that they must be a whole word.
         */
        private readonly keywords: Map<TokenKind, Tagged<string>>,

        /** Tokens matching exact strings. */
        private readonly strings: Map<TokenKind, Tagged<string>>,

        /** Tokens matching regular expressions. */
        private readonly patterns: Map<TokenKind, Tagged<RegExp>>,

        /** Tokens matched by manipulating a tape. */
        private readonly resolvers: Map<TokenKind, Tagged<TokenResolver>>,

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
    ) {
        this.tagsForKinds = new Map<TokenKind, Tag>([
            ...[...keywords].map(([kind, kword]) => [kind, kword.tag] as const),
            ...[...strings].map(([kind, text]) => [kind, text.tag] as const),
            ...[...patterns].map(
                ([kind, pattern]) => [kind, pattern.tag] as const,
            ),
            [Token.HEAD_KIND, Token.HEAD_TAG],
            [Token.TAIL_KIND, Token.TAIL_TAG],
            [Token.UNKNOWN_KIND, Token.UNKNOWN_TAG],
        ])

        this.kindsForTags = new Map<Tag, TokenKind>([
            [Token.HEAD_TAG, Token.HEAD_KIND],
            [Token.TAIL_TAG, Token.TAIL_KIND],
            [Token.UNKNOWN_TAG, Token.UNKNOWN_KIND],
            ...[...this.tagsForKinds].map(
                ([kind, tag]) => [tag, kind] as const,
            ),
        ])
        this.matchingCloseTags = new Map()
        this.matchingOpenTags = new Map()
        for (const [kind, tag] of this.tagsForKinds) {
            if (kind.includes('OPEN')) {
                const closeKind = kind.replace('OPEN', 'CLOSE') as TokenKind
                const closeTag = this.tagsForKinds.get(closeKind)
                if (closeTag !== undefined) {
                    this.matchingCloseTags.set(tag, closeTag)
                    this.matchingOpenTags.set(closeTag, tag)
                }
            }
        }
    }

    tagForKind(kind: UnknownTokenKind): Tag | undefined {
        return this.tagsForKinds.get(kind as TokenKind)
    }

    kindForTag(tag: Tag): TokenKind | undefined {
        return this.kindsForTags.get(tag)
    }

    matchingOpenTag(close: Tag): Tag | undefined {
        return this.matchingOpenTags.get(close)
    }

    matchingCloseTag(open: Tag): Tag | undefined {
        return this.matchingCloseTags.get(open)
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
        const tagger = new Tagger()
        const kwords = [...(cfg.keywords ?? [])].map(kword => tagger.tag(kword))
        const strings: Record<TokenKind, Tagged<string>> = {}
        const patterns: Record<TokenKind, Tagged<RegExp>> = {}
        const resolvers: Record<TokenKind, Tagged<TokenResolver>> = {}
        for (const kind in cfg.declare) {
            const tokenKind = kind as TokenKind
            const matcher = cfg.declare[kind]
            if (typeof matcher === 'string') {
                strings[tokenKind] = tagger.tag(matcher)
            } else if (matcher instanceof RegExp) {
                patterns[tokenKind] = tagger.tag(matcher)
            } else {
                resolvers[tokenKind] = tagger.tag(matcher)
            }
        }
        for (const parent of cfg.inherit ?? []) {
            const lang = Language.resolve(parent)
            for (const [kind, text] of lang.strings.entries()) {
                strings[kind] = tagger.tag(text.value)
            }

            // For keywords and patterns, collect from parent as last step to ensure
            // locally defined tokens are parsed first.
            for (const [kind, pattern] of lang.patterns.entries()) {
                patterns[kind] = tagger.tag(pattern.value)
            }
            for (const [kind, resolver] of lang.resolvers.entries()) {
                resolvers[kind] = tagger.tag(resolver.value)
            }
            for (const [_, kword] of lang.keywords) {
                kwords.push(tagger.tag(kword.value))
            }
        }
        return new Language(
            new Map(kwords.map(e => [e.value.toUpperCase() as TokenKind, e])),
            rebindToMap(
                strings,
                sortBy(prop => -prop.value.value.length), // parse longer tokens first
            ),
            rebindToMap(patterns),
            rebindToMap(resolvers),
            cfg.$ignore,
            IdRule.resolve(cfg.$idRule ?? IdRule.resolve('STRICT')),
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
            for (const [kind, kword] of this.keywords) {
                const { tag, value } = kword
                if (tape.isAtIdentifier(value)) {
                    // Execute check for letter on both ends,
                    // as some keywords contain leading/trailing symbols
                    node = node.append(tag, kind, value.length, tape.pos)
                    tape.pos += value.length
                    break
                }
            }
            if (tape.pos !== start) {
                this.skip(tape)
                continue
            }

            // === 2. Test Strings ===
            for (const [kind, text] of this.strings.entries()) {
                const { tag, value } = text
                if (tape.isAt(value)) {
                    node = node.append(tag, kind, value.length, tape.pos)
                    tape.pos += value.length
                }
            }
            if (tape.pos !== start) {
                this.skip(tape)
                continue
            }

            // === 3. Test Patterns ===
            for (const [kind, pattern] of this.patterns.entries()) {
                const { tag, value } = pattern
                value.lastIndex = tape.pos
                if (value.test(tape.raw)) {
                    const length = value.lastIndex - tape.pos
                    node = node.append(tag, kind as TokenKind, length, tape.pos)
                    tape.pos += length
                    break
                }
            }
            if (tape.pos !== start) {
                this.skip(tape)
                continue
            }

            // === 4. Test Resolvers ===
            for (const [kind, resolver] of this.resolvers.entries()) {
                const { tag, value } = resolver
                const match = value(tape)
                if (match.length !== 0) {
                    node = node.append(
                        tag,
                        kind as TokenKind,
                        match.length,
                        tape.pos,
                    )
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
            node = node.appendUnknown(tape.pos - start, start)
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
            OPEN_ANGLE: '<',
            CLOSE_ANGLE: '>',
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
