//! Algorithms and data structures for tokenizing language-specific input.
//!
//! For general utilities related to text manipulation, refer to `text_utils.ts`.
import { ALPHA, DIGIT } from './constants'
import { Direction, Member, rebindToMap, sortBy, Span } from './misc'
import Tape from './tape'

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
 * Illegal tokens are assigned a kind of `UNKNOWN` and a tag of -1.
 */
export class Token extends Span {
    private constructor(
        begin: number,
        end: number,
        readonly tag: Tag,
        readonly kind: TokenKind,
    ) {
        super(begin, end)
    }

    get isUnknown(): boolean {
        return this.tag === Token.UNKNOWN_TAG
    }

    toString(): string {
        return `${this.kind}${super.toString()}`
    }

    static readonly UNKNOWN_KIND: TokenKind = 'UNKNOWN' as TokenKind
    static readonly UNKNOWN_TAG = -1 as Tag

    static newInstance(
        begin: number,
        length: number,
        tag: Tag,
        kind: TokenKind,
    ) {
        return new Token(begin, begin + length, tag, kind)
    }

    static unknown(begin: number, length: number): Token {
        return new Token(
            begin,
            begin + length,
            Token.UNKNOWN_TAG,
            Token.UNKNOWN_KIND,
        )
    }

    static isEditable(kind: TokenKind): boolean {
        return kind === 'ID' || kind.endsWith('COMMENT')
    }

    /**
     * Returns the index of the closest token for a given cursor offset
     * and in the given direction, resolving whitespace gaps.
     * 
     * If one is not found, returns -1.
     *
     * @param tokens Flat array of tokens, strictly sorted by token.begin.
     * @param offset The active numeric cursor position.
     * @param bias Directional preference when cursor sits in a whitespace gap or between tokens.
     */
    static findNearest(
        tokens: Token[],
        offset: number,
        bias: Direction,
    ): number {
        if (tokens.length === 0) {
            return -1
        }
        let low = 0
        let high = tokens.length - 1

        // 1. Biased binary search to find exact overlap or the tightest containing bounds
        while (low <= high) {
            const mid = (low + high) >> 1 // fast floor division
            const token = tokens[mid]
            if (offset >= token.begin && offset <= token.end) {
                if (
                    offset === token.end &&
                    mid < tokens.length - 1 &&
                    tokens[mid + 1].begin === offset
                ) {
                    return bias === 'left' ? mid : mid + 1
                }
                if (
                    offset === token.begin &&
                    mid > 0 &&
                    tokens[mid - 1].end === offset
                ) {
                    return bias === 'left' ? mid - 1 : mid
                }
                return mid // internal hit
            }
            if (offset < token.begin) {
                high = mid - 1
            } else {
                low = mid + 1
            }
        }

        // 2. Fallback: The cursor is in a whitespace gap between two tokens.
        // At this point, 'high' points to the token immediately before the gap,
        // and 'low' points to the token immediately after the gap.
        if (high < 0) {
            return 0
        }
        if (low >= tokens.length) {
            return tokens.length - 1
        }
        return bias === 'left' ? high : low
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
            [Token.UNKNOWN_KIND, Token.UNKNOWN_TAG],
        ])

        this.kindsForTags = new Map<Tag, TokenKind>([
            ...[...this.tagsForKinds].map(
                ([kind, tag]) => [tag, kind] as const,
            ),
            [Token.UNKNOWN_TAG, Token.UNKNOWN_KIND],
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
                sortBy(prop => -prop[1].value.length), // parse longer tokens first
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
     * Tokenizes the input, and returns the buffer.
     *
     * If `target` is a string, it is converted to a `Tape` with the `idRule` of the given language.
     */
    tokenize(target: string | Tape, buf: Token[] = []): Token[] {
        const tape =
            typeof target === 'string'
                ? Tape.over(target, 0, this.idRule)
                : target
        this.skip(tape)
        while (!tape.isExhausted()) {
            const start = tape.pos

            // 1. Test Keywords
            for (const [kind, kword] of this.keywords) {
                const { tag, value } = kword
                if (tape.isAtIdentifier(value)) {
                    // Execute check for letter on both ends,
                    // as some keywords contain leading/trailing symbols
                    buf.push(
                        Token.newInstance(tape.pos, value.length, tag, kind),
                    )
                    tape.pos += value.length
                    break
                }
            }
            if (tape.pos !== start) {
                this.skip(tape)
                continue
            }

            // 2. Test Strings
            for (const [kind, text] of this.strings.entries()) {
                const { tag, value } = text
                if (tape.isAt(value)) {
                    buf.push(
                        Token.newInstance(tape.pos, value.length, tag, kind),
                    )
                    tape.pos += value.length
                }
            }
            if (tape.pos !== start) {
                this.skip(tape)
                continue
            }

            // 3. Test Patterns
            for (const [kind, pattern] of this.patterns.entries()) {
                const { tag, value } = pattern
                value.lastIndex = tape.pos
                if (value.test(tape.raw)) {
                    const length = value.lastIndex - tape.pos
                    buf.push(
                        Token.newInstance(
                            tape.pos,
                            length,
                            tag,
                            kind as TokenKind,
                        ),
                    )
                    tape.pos += length
                    break
                }
            }
            if (tape.pos !== start) {
                this.skip(tape)
                continue
            }

            // 4. Test Resolvers
            for (const [kind, resolver] of this.resolvers.entries()) {
                const { tag, value } = resolver
                const match = value(tape)
                if (match.length !== 0) {
                    buf.push(
                        Token.newInstance(
                            tape.pos,
                            match.length,
                            tag,
                            kind as TokenKind,
                        ),
                    )
                    break
                }
            }
            if (tape.pos !== start) {
                this.skip(tape)
                continue
            }

            // 4. Attempt Recovery
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
            buf.push(Token.unknown(start, tape.pos - start))
        }
        return buf
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
