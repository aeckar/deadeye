//! Completion API and utilities.
//!
//! Also provides algorithms and data structures used to parse completion shorthands.
import { MarkdownString, Position, Range, TextDocument, window } from 'vscode'

import Scope from '@/scope'
import DocumentInfoService, { DocumentInfo } from '@/services/document_info_service'
import Tape from '@/tape'
import { md } from '@/utils/diagnostics'
import { reverse } from '@/utils/strings'
import { rangeBefore } from '@/utils/vscode'
import { Token } from './language_api'

// =============================================================================================
// Utilities & Constants: Special Characters
// =============================================================================================

export type FlagChar =
    | 'a'
    | 'b'
    | 'c'
    | 'd'
    | 'e'
    | 'f'
    | 'g'
    | 'h'
    | 'i'
    | 'j'
    | 'k'
    | 'l'
    | 'm'
    | 'n'
    | 'o'
    | 'p'
    | 'q'
    | 'r'
    | 's'
    | 't'
    | 'u'
    | 'v'
    | 'w'
    | 'x'
    | 'y'
    | 'z'
    | '!'

/**
 * A flag for some shorthand, representing a single lowercase letter or symbol.
 *
 * Can represent a range of characters by prepending a '-' and declaring two characters.
 */
export type Flag = FlagChar | `-${FlagChar}${FlagChar}`

/** Returned as values in the map returned by `Tape.consumeFlags`. */
export type FlagMatch = {
    readonly expansion: string
    readonly range: Range
}

/**
 * The key used to trigger a completion.
 *
 * Triggers are not considered part of a completion, and this is helpful
 * because it allows the completion itself to be highlighted and show suggestions before
 * being fired.
 *
 * If provided, a trigger must take the form of either:
 * - ` `
 * - `;`
 * - [ENTER]
 *
 * An empty string means there is no set trigger key,
 * and the completion will fire as soon as it is matched.
 */
export type Trigger = '' | ' ' | ';' | '.' | 'enter'

// =============================================================================================
// Utilities & Constants: Letter Case
// =============================================================================================

/** Concatenates the strings and applies PascalCase. */
export function toPascalCase(chunks: string[]): string {
    return chunks.map(capitalize).join('')
}

/** Concatenates the strings and applies SCREAMING_SNAKE_CASE. */
export function toScreamCase(chunks: string[]): string {
    return chunks.map(s => s.toUpperCase()).join('_')
}

/** Concatenates the strings and applies snake_case. */
export function toSnakeCase(chunks: string[]): string {
    return chunks.map(s => s.toLowerCase()).join('_')
}

/** Concatenates the strings and applies camelCase. */
export function toCamelCase(chunks: string[]): string {
    return chunks.map((s, idx) => (idx === 0 ? s.toLowerCase() : capitalize(s))).join('')
}

/** Concatenates the strings and applies kebab-case. */
export function toKebabCase(chunks: string[]): string {
    return chunks.map(s => s.toLowerCase()).join('-')
}

/** Returns the same string with the first character capitalized. */
export function capitalize(s: string): string {
    if (!s) {
        return ''
    }
    return s[0].toUpperCase() + s.slice(1)
}

/** Returns true if the character is a digit. */
export function isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9'
}

/** Returns true if the character is an uppercase letter. */
export function isUpperLetter(ch: string): boolean {
    return ch >= 'A' && ch <= 'Z'
}

/** Returns true if the character is a lowercase letter. */
export function isLowerLetter(ch: string): boolean {
    return ch >= 'a' && ch <= 'z'
}

/** Returns true if the character is an uppercase or lowercase letter. */
export function isLetter(ch: string): boolean {
    return isLowerLetter(ch) || isUpperLetter(ch)
}

// =============================================================================================
// Completion Registry
// =============================================================================================

/** Contains all completion families for a given language, grouped by trigger. */
export class CompletionRegistry<ScopeKind extends string> extends Map<
    Trigger,
    CompletionFamily<ScopeKind>[]
> {
    private constructor() {
        super()
    }

    /**
     * Initializes a completion family for each configuration,
     * then stores each in a map, grouped by trigger.
     */
    static newInstance<ScopeKind extends string>(
        ...families: CompletionFamilyConfig<ScopeKind>[]
    ): CompletionRegistry<ScopeKind> {
        const self = new this<ScopeKind>()
        for (const cfg of families) {
            const family = CompletionFamily.newInstance(cfg)
            if (!self.has(family.trigger)) {
                self.set(family.trigger, [family])
            } else {
                self.get(family.trigger)!.push(family)
            }
        }
        return self
    }
}

export function substitute<ScopeKind extends string>(
    target: string,
    replacement: string,
): CompletionFamilyConfig<ScopeKind> {
    const length = target.length
    return {
        docs: md`
        Expands the text.
        
        \`${target}\` → \`${replacement}\`
        `,
        trigger: '',
        minLookbehind: length,
        resolver(ctx) {
            const tape = ctx.left().reversed()
            if (!tape.isAt(reverse(target))) {
                return undefined
            }
            return Completion.newInstance({
                preview: md`Insert \`${replacement}\`.`,
                target: rangeBefore(ctx.cursor, length),
                snippet: replacement.replaceAll('$', '\\$'),
            })
        },
    }
}

/**
 * Attempts to resolve a {@link Completion} using the local {@link CompletionContext context}.
 *
 * @see {@link CompletionFamily.resolver}
 */
export type CompletionResolver<ScopeKind extends string> = (
    ctx: CompletionContext<ScopeKind>,
) => Completion | undefined

/**
 * Configuration parameter for {@link CompletionFamily}.
 * @see {@link CompletionFamily.newInstance}
 */
export type CompletionFamilyConfig<ScopeKind extends string> = {
    /** @see {@link CompletionFamily.docs} */
    readonly docs: MarkdownString

    /** @see {@link CompletionFamily.minLookbehind} */
    readonly minLookbehind: number

    /** @see {@link CompletionFamily.resolver} */
    readonly resolver: CompletionResolver<ScopeKind>

    /** @see {@link CompletionFamily.trigger} */
    readonly trigger: Trigger
}

/**
 * A shorthand for a programming language element.
 *
 * Once a shorthand is detected, the user must key in a trigger (space, by default) to replace the
 * shorthand with its completion.
 *
 * Unlike chords or motions, shorthands always recognize a trigger. If the user has configured
 * the trigger to be an empty string, the default is used. This is due to the large vocabulary
 * of language-level shorthands, which makes collisions almost guaranteed.
 */
export class CompletionFamily<ScopeKind extends string> {
    private constructor(
        /**
         * A short description in Markdown, generated dynamically
         * to explain to user exactly what the shorthand does when triggered.
         * This documentation appears next to the cursor shortly after the
         * shorthand is detected but before it is triggered.
         */
        readonly docs: MarkdownString,

        /**
         * The minimum number of previous, consecutive character insertions
         * for a match to this shorthand to be valid. This is an optimization,
         * often the minimum number of characters for the base case. Can be assigned `NaN` so this
         * shorthand is always checked.
         */
        readonly minLookbehind: number,

        /**
         * The key that triggers the completion.
         *
         * If empty, this completion fires instantly.
         */
        readonly trigger: Trigger,

        /** The logic used to match this shorthand to a dynamic, context-aware completion. */
        readonly resolver: CompletionResolver<ScopeKind>,
    ) {}

    static newInstance<ScopeKind extends string>(cfg: CompletionFamilyConfig<ScopeKind>) {
        return new this(cfg.docs, cfg.minLookbehind, cfg.trigger, cfg.resolver)
    }
}

/**
 * Configuration parameter for {@link Completion}.
 * @see {@link Completion.newInstance}
 */
export type CompletionConfig = {
    /** @see {@link Completion.preview} */
    readonly preview: MarkdownString

    /** @see {@link Completion.target} */
    readonly target: Range

    /** @see {@link Completion.snippet} */
    readonly snippet: string

    /** @see {@link Completion.errors} */
    readonly errors?: readonly Range[]

    /** @see {@link Completion.warnings} */
    readonly warnings?: readonly Range[]

    /** @see {@link Completion.insertAt} */
    readonly insertAt?: Position

    /** @see {@link Completion.endCursorPos} */
    readonly endCursorPos?: Position
}

/** The result of {@link CompletionFamily.resolver}. */
export class Completion {
    private constructor(
        /**
         * A short description of what the completion of the shorthand does.
         *
         * This is created after each match to describe **exactly** how the code is modified.
         * This contrasts with {@link CompletionFamily.docs}, which is a general description of
         * the shorthand or family of shorthands.
         *
         * This is through `expandTabStops` before rendering.
         *
         * This must be given for every completion, even if {@link CompletionFamily.trigger} is `null`,
         * in case future APIs use expose this functionality to the user.
         */
        readonly preview: MarkdownString,

        /** The location of the actual shorthand, which is replaced. */
        readonly target: Range,

        /** The snippet that replaces the {@link target}. */
        readonly snippet: string,

        /**
         * The ranges in the source file within `target` that represent tokens
         * in the shorthand that would be replaced with illegal language constructs if triggered.
         *
         * If the trigger is pressed, the completion will fire according to the
         * all parts of the shorthand that are not highlighted as errors, as
         * enforced by the completion resolver.
         */
        readonly errors?: readonly Range[],

        /**
         * The ranges in the source file within `target`
         * that represent unoptimal tokens in the shorthand.
         *
         * If the trigger is pressed, the completion will fire according to the
         * all parts of the shorthand that are not highlighted as errors, as
         * enforced by the completion resolver.
         */
        readonly warnings?: readonly Range[],

        /**
         * If defined, is the position of the snippet to be inserted. Otherwise,
         * the snippet is inserted at the position of the cursor after the target is deleted.
         */
        readonly insertAt?: Position,

        /** The final position of the cursor after the snippet has been inserted. */
        readonly endCursorPos?: Position,
    ) {}

    static newInstance(cfg: CompletionConfig) {
        let errors: readonly Range[] | undefined
        if (cfg.errors) {
            const invalid = cfg.errors.filter(e => !cfg.target.contains(e))
            if (invalid.length > 0) {
                const strings = invalid
                    .map(
                        e =>
                            `(${e.start.line},${e.start.character}:${e.end.line},${e.end.character})`,
                    )
                    .join(', ')
                window.showWarningMessage(`Deadeye: Error range(s) outside of target: [${strings}]`)
                errors = cfg.errors.filter(e => cfg.target.contains(e))
            } else {
                errors = cfg.errors
            }
        }
        return new this(
            cfg.preview,
            cfg.target,
            cfg.snippet,
            errors,
            undefined, //todo warnings
            cfg.insertAt,
            cfg.endCursorPos,
        )
    }
}

/**
 * Captures the local context at the point of an edit. Used by completions
 * to determine whether a completion should be recognized.
 *
 * @see {@link ScopedCompletionContext}
 */
export class CompletionContext<ScopeKind extends string> {
    private _line: Tape

    /** All scopes found at the cursor, ordered from farthest to nearest. */
    private readonly scopesAtCursor: readonly Scope<ScopeKind>[]

    readonly docInfo: DocumentInfo<ScopeKind>
    readonly tokenPos: number

    private constructor(
        document: TextDocument,
        protected readonly keyIn: string,
        readonly cursor: Position,
    ) {
        const offset = document.offsetAt(this.cursor)
        this.docInfo = DocumentInfoService.get(document)
        this.scopesAtCursor = this.docInfo.selectScopes(offset)
        this.tokenPos = Token.findNearest(this.docInfo.tokens, offset, 'right')
        this._line = this.newLineBuffer() // initialize last
    }

    static newInstance(
        document: TextDocument,
        keyIn: string,
        cursor: Position,
    ): CompletionContext<string> {
        return new this(document, keyIn, cursor)
    }

    get line(): Tape {
        return this._line
    }

    get nearestScope(): Scope<ScopeKind> | undefined {
        return this.scopesAtCursor.at(-1)
    }

    resetLine() {
        this._line = this.newLineBuffer()
    }

    private newLineBuffer(): Tape {
        return Tape.over(
            this.docInfo.document.lineAt(this.cursor.line).text + this.keyIn,
            0,
            this.docInfo.language.idRule,
        )
    }

    /** Returns a tape over the current line up to the cursor. */
    left(): Tape {
        return this._line.before(this.cursor)
    }

    /** Returns a tape over the current line after the cursor. */
    right(): Tape {
        return this._line.after(this.cursor)
    }

    /**
     * Performing a check using this function is faster than declaring a scope selector.
     *
     * Pass an array to check if any pass the test.
     */
    inScope(kind: ScopeKind | readonly ScopeKind[]): boolean {
        if (typeof kind !== 'string') {
            return kind.some(this.inScope)
        }
        return this.scopesAtCursor.find(e => e.kind === kind) !== undefined
    }

    /**
     * Returns true if `kind` is the scope whose starting index is nearest to the cursor.
     *
     * Pass an array to check if any pass the test.
     */
    isNearestScope(kind: ScopeKind | readonly ScopeKind[]): boolean {
        if (typeof kind !== 'string') {
            return kind.some(e => this.isNearestScope(e))
        }
        return this.scopesAtCursor.at(-1)?.kind === kind
    }
}

/** Created and stored after a shorthand is matched, and recalled once the trigger is pressed. */
export class CompletionStrategy {
    private constructor(
        readonly family: CompletionFamily<string>,
        readonly trigger: Trigger,
        readonly completion: Completion,

        /** The position of the cursor the instance this object was created. */
        readonly pos: Position,
    ) {}

    static newInstance(
        family: CompletionFamily<string>,
        trigger: Trigger,
        completion: Completion,
        pos: Position,
    ): CompletionStrategy {
        return new this(family, trigger, completion, pos)
    }

    /** Returns the Markdown string for the completion preview, with placeholders made fancy. */
    preview(): MarkdownString {
        const preview = this.completion.preview.value
        return new MarkdownString(
            preview
                .replace('$0', '/* stop here */')
                .replace(/\$\{?(\d)(?::.*?\})?/, '/* placeholder $1 */'),
        )
    }
}
