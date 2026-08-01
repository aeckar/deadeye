//! Language API and utilities.
//!
//! For general utilities related to text manipulation, refer to `text_utils.ts`.
import { IdRuleResolvable, IdRule } from '@/id_rule'
import Tape from '@/tape'
import { compareBy, rebindToMap, select } from '@/utils/collections'
import { Direction, escapeRegex, hashCode, Span } from '@/utils/strings'
import { Member } from '@/utils/types'

// =============================================================================================
// Tokens
// =============================================================================================

/** A unique numerical identifier. */
export type Tag = number & { __brand: 'Tag' }

/** Wraps each object with a tag, according to a counter held by this instance. */
export class Tagger {
    private count = 0

    tag<T>(value: T): Tagged<T> {
        const next = Tagged.newInstance(this.count as Tag, value)
        this.count += 1
        return next
    }
}

/** An object assigned tag. */
export class Tagged<T> {
    private constructor(
        readonly tag: Tag,
        readonly value: T,
    ) {}

    static newInstance<T>(tag: Tag, value: T): Tagged<T> {
        return new this(tag, value)
    }
}

/**
 * An identifier assigned to a token that is unique per language.
 *
 * Invalid source code is assigned a token of `UNKNOWN`.
 */
export type TokenKind = Uppercase<string> & { __brand: 'TokenName' }

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
export type UnknownTokenKind = Uppercase<string>

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

        /**
         * A unique hash to discern whether this token is a bracket.
         * If it is not, this is set to 0.
         *
         * The LSB is 0 for open brackets and 1 for close brackets.
         *
         * To derive the open or close form if this token is a bracket, apply a bitwise NOT. */
        readonly bracketHash: number,
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

    /**
     * Searches the array linearly starting at the given index
     * for the matching close bracket.
     *
     * Returns the index of the token, or -1 if none is found or this is not an open bracket.
     */
    findCloseBracket(tokens: readonly Token[], start: number = 0): number {
        if (!this.isOpenBracket()) {
            return -1
        }
        const closeHash = ~this
        let depth = 0
        for (let idx = start; idx < tokens.length; ++idx) {
            const tok = tokens[idx]
            if (depth === 0 && tok.bracketHash === closeHash) {
                return idx
            }
            if (tok.isOpenBracket()) {
                depth += 1
            } else if (tok.isCloseBracket()) {
                depth -= 1
            }
        }
        return -1
    }

    /**
     * Searches the array linearly backwards starting at the given index
     * for the matching open bracket.
     *
     * Returns the index of the token, or -1 if none is found or this is not a close bracket.
     */
    findOpenBracket(tokens: readonly Token[], start: number = tokens.length - 1): number {
        if (!this.isCloseBracket()) {
            return -1
        }
        const openHash = ~this.bracketHash
        let depth = 0
        for (let idx = start; idx >= 0; --idx) {
            const tok = tokens[idx]
            if (depth === 0 && tok.bracketHash === openHash) {
                return idx
            }
            if (tok.isCloseBracket()) {
                depth += 1
            } else if (tok.isOpenBracket()) {
                depth -= 1
            }
        }
        return -1
    }

    static newInstance(begin: number, length: number, tag: Tag, kind: TokenKind) {
        let bracketHash: number
        if (kind.startsWith('OPEN_')) {
            bracketHash = hashCode(kind.slice('OPEN_'.length)) << 1
        } else if (kind.startsWith('CLOSE_')) {
            bracketHash = ~(hashCode(kind.slice('CLOSE_'.length)) << 1)
        } else {
            bracketHash = 0
        }
        return new this(begin, begin + length, tag, kind, bracketHash)
    }

    static unknown(begin: number, length: number): Token {
        return new this(begin, begin + length, Token.UNKNOWN_TAG, Token.UNKNOWN_KIND, 0)
    }

    /**
     * Returns true if the token is editable per character.
     *
     * This attribute is purposely left uncached to reduce overhead during tokenization.
     */
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
    static findNearest(tokens: readonly Token[], offset: number, bias: Direction): number {
        if (tokens.length === 0) {
            return -1
        }
        let low = 0
        let high = tokens.length - 1

        // 1. Biased binary search to find exact overlap or the tightest containing bounds
        while (low <= high) {
            const mid = (low + high) >> 1 // fast floor division
            const tok = tokens[mid]
            if (offset >= tok.begin && offset <= tok.end) {
                if (
                    offset === tok.end &&
                    mid < tokens.length - 1 &&
                    tokens[mid + 1].begin === offset
                ) {
                    return bias === 'left' ? mid : mid + 1
                }
                if (offset === tok.begin && mid > 0 && tokens[mid - 1].end === offset) {
                    return bias === 'left' ? mid - 1 : mid
                }
                return mid // internal hit
            }
            if (offset < tok.begin) {
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

    isBracket(): boolean {
        return this.bracketHash !== 0
    }

    isOpenBracket(): boolean {
        return this.isBracket() && (this.bracketHash & 1) === 0
    }

    isCloseBracket(): boolean {
        return this.isBracket() && (this.bracketHash & 1) === 1
    }
}

// =============================================================================================
// Language (Lexer) Description
// =============================================================================================

/** Parses tokens manually as a last resort when strings and regexes will not suffice. */
export type TokenResolver = (tape: Tape) => string

/**
 * Configuration parameter for {@link Language}.
 * @see {@link Language.newInstance}
 */
export type LanguageConfig = {
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
            ...[...patterns].map(([kind, pattern]) => [kind, pattern.tag] as const),
            [Token.UNKNOWN_KIND, Token.UNKNOWN_TAG],
        ])

        this.kindsForTags = new Map<Tag, TokenKind>([
            ...[...this.tagsForKinds].map(([kind, tag]) => [tag, kind] as const),
            [Token.UNKNOWN_TAG, Token.UNKNOWN_KIND],
        ])
    }

    tagForKind(kind: UnknownTokenKind): Tag | undefined {
        return this.tagsForKinds.get(kind as TokenKind)
    }

    kindForTag(tag: Tag): TokenKind | undefined {
        return this.kindsForTags.get(tag)
    }

    /** Returns the sub-language from the tokens whose kinds match the pattern. */
    select(pattern: string | RegExp): Language {
        if (typeof pattern === 'string') {
            pattern = new RegExp(escapeRegex(pattern))
        }
        return new Language(
            select(this.keywords, k => pattern.test(k)),
            select(this.strings, k => pattern.test(k)),
            select(this.patterns, k => pattern.test(k)),
            select(this.resolvers, k => pattern.test(k)),
            this.ignore,
            this.idRule,
        )
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
    static newInstance(cfg: LanguageConfig): Language {
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
        return new this(
            new Map(kwords.map(e => [e.value.toUpperCase() as TokenKind, e])),
            rebindToMap(
                strings,
                compareBy(prop => -prop[1].value.length), // parse longer tokens first
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
        const tape = typeof target === 'string' ? Tape.over(target, 0, this.idRule) : target
        this.skip(tape)
        while (!tape.isExhausted()) {
            const start = tape.pos

            // 1. Test Keywords
            for (const [kind, kword] of this.keywords) {
                const { tag, value } = kword
                if (tape.isAtIdentifier(value)) {
                    // Execute check for letter on both ends,
                    // as some keywords contain leading/trailing symbols
                    buf.push(Token.newInstance(tape.pos, value.length, tag, kind))
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
                    buf.push(Token.newInstance(tape.pos, value.length, tag, kind))
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
                    buf.push(Token.newInstance(tape.pos, length, tag, kind as TokenKind))
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
                    buf.push(Token.newInstance(tape.pos, match.length, tag, kind as TokenKind))
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
