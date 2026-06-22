//! Algorithms and data structures used to parse completion shorthands.
//!
//! todo explain vocab
import { MarkdownString, Position, Range, TextEditor, window } from 'vscode';

import { rangeBefore } from './misc';
import {
    ScopedCompletionContext,
    ScopeResolver,
    ScopeTree,
} from './scope_resolver_utils';
import Tape from './tape';
import {
    Brackets,
    IdentifierRule,
    toMarkdown as md,
    reverse,
} from './text_utils';

// ==================================== Utilities + Constants ====================================

export const MAX_TOKEN_SEEK = 50;
export const MAX_LINE_SEEK = 50;
export const MAX_CHAR_SEEK = 2500;

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
    | '!';

/**
 * A flag for some shorthand, representing a single lowercase letter or symbol.
 *
 * Can represent a range of characters by prepending a '-' and declaring two characters.
 */
export type Flag = FlagChar | `-${FlagChar}${FlagChar}`;

/** Returned as values in the map returned by `Tape.consumeFlags`. */
export type FlagMatch = {
    readonly expansion: string;
    readonly range: Range;
};

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
export type Trigger = '' | ' ' | ';' | '.' | 'enter';

// ==================================== Registry API + Builder ====================================

/** Contains all completion families for a given language, grouped by trigger. */
export type CompletionRegistry<ScopeKind extends string> = Map<
    string,
    CompletionFamily<ScopeKind>[]
> & { __brand: 'CompletionRegistry' };

/**
 * # Namespace
 *
 * Provides `newInstance` as an initializer.
 */
export namespace CompletionRegistry {
    /**
     * Initializes a completion family for each configuration,
     * then stores each in a map, grouped by trigger.
     */
    export function newInstance<ScopeKind extends string>(
        ...families: CompletionFamilyCfg<ScopeKind>[]
    ): CompletionRegistry<ScopeKind> {
        const byTrigger = new Map() as CompletionRegistry<ScopeKind>;
        for (const cfg of families) {
            const family = CompletionFamily.newInstance(cfg);
            if (!byTrigger.has(family.trigger)) {
                byTrigger.set(family.trigger, [family]);
            } else {
                byTrigger.get(family.trigger)!.push(family);
            }
        }
        return byTrigger as CompletionRegistry<ScopeKind>;
    }
}

export function substitute<ScopeKind extends string>(
    target: string,
    replacement: string,
): CompletionFamilyCfg<ScopeKind> {
    const length = target.length;
    return {
        docs: md`
        Expands the text.
        
        \`${target}\` → \`${replacement}\`
        `,
        trigger: '',
        minLookbehind: length,
        resolver(ctx) {
            const tape = ctx.leftOfCursor().reversed();
            if (!tape.isAt(reverse(target))) {
                return undefined;
            }
            return Completion.newInstance({
                preview: md`Insert \`${replacement}\`.`,
                target: rangeBefore(ctx.cursor, length),
                snippet: replacement.replaceAll('$', '\\$'),
            });
        },
    };
}

export type CompletionResolver<ScopeKind extends string> = (
    ctx: ScopedCompletionContext<ScopeKind>,
) => Completion | undefined;

export type CompletionFamilyCfg<ScopeKind extends string> = {
    docs: MarkdownString;
    minLookbehind: number;
    resolver: CompletionResolver<ScopeKind>;
    trigger: Trigger;
    scoping?: readonly ScopeTree<ScopeKind>[];
};

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
         * to explain to user exactly what the shorthand does when triggered. This documentation appears
         * next to the cursor shortly after the shorthand is detected but before it is triggered.
         */
        readonly docs: MarkdownString,

        /**
         * The minimum number of previous, consecutive character insertions
         * for a match to this shorthand to be valid. This is an optimization, often the minimum number
         * of characters for the base case. Can be assigned `NaN` so this shorthand is always checked.
         */
        readonly minLookbehind: number,

        /**
         * The key that triggers the completion.
         *
         * If empty, this completion fires instantly.
         */
        readonly trigger: Trigger,

        /**
         * The possible scope trees required for this shorthand to match.
         *
         * If assigned an empty array, this shorthand matches in every scope.
         */
        readonly scoping: readonly ScopeTree<ScopeKind>[],

        /** The logic used to match this shorthand to a dynamic, context-aware completion. */
        readonly resolver: CompletionResolver<ScopeKind>,
    ) {}

    static newInstance<ScopeKind extends string>(
        cfg: CompletionFamilyCfg<ScopeKind>,
    ) {
        return new CompletionFamily(
            cfg.docs,
            cfg.minLookbehind,
            cfg.trigger,
            cfg.scoping ?? ([] as const),
            cfg.resolver,
        );
    }
}

export type CompletionCfg = {
    preview: MarkdownString;
    target: Range;
    snippet: string;
    errors?: Range[];
    warnings?: Range[];
    insertAt?: Position;
    endCursorPos?: Position;
};

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
        readonly errors?: Range[],

        /**
         * The ranges in the source file within `target`
         * that represent unoptimal tokens in the shorthand.
         *
         * If the trigger is pressed, the completion will fire according to the
         * all parts of the shorthand that are not highlighted as errors, as
         * enforced by the completion resolver.
         */
        readonly warnings?: Range[],

        /**
         * If defined, is the position of the snippet to be inserted. Otherwise,
         * the snippet is inserted at the position of the cursor after the target is deleted.
         */
        readonly insertAt?: Position,

        /** The final position of the cursor after the snippet has been inserted. */
        readonly endCursorPos?: Position,
    ) {}

    static newInstance(cfg: CompletionCfg) {
        let errors: Range[] | undefined;
        if (cfg.errors) {
            const invalid = cfg.errors.filter(e => !cfg.target.contains(e));
            if (invalid.length > 0) {
                const strings = invalid
                    .map(e => {
                        return (
                            `[${e.start.line}:${e.start.character}` +
                            `-${e.end.line}:${e.end.character}]`
                        );
                    })
                    .join(', ');
                window.showWarningMessage(
                    `Deadeye: Error range(s) outside of target: ${strings}`,
                );
                errors = cfg.errors.filter(e => cfg.target.contains(e));
            } else {
                errors = cfg.errors;
            }
        }
        return new Completion(
            cfg.preview,
            cfg.target,
            cfg.snippet,
            errors,
            undefined, //todo warnings
            cfg.insertAt,
            cfg.endCursorPos,
        );
    }
}

/**
 * Used to resolve {@link Scope scopes}.
 *
 * {@link Completion Completions} are {@link CompletionFamily.resolver resolved}
 * use the child class {@link ScopedCompletionContext}, since it contains the
 * scope tree for the current position of the cursor.
 */
export class CompletionContext {
    readonly line: Tape;

    constructor(
        protected readonly keyIn: string,
        readonly cursor: Position,
        readonly editor: TextEditor,
        protected readonly identifiers: IdentifierRule,
    ) {
        this.line = Tape.over(
            editor.document.lineAt(cursor.line).text + keyIn,
            undefined,
            identifiers,
        );
    }

    toScoped<ScopeKind extends string>(resolver: ScopeResolver<ScopeKind>) {
        return ScopedCompletionContext.withResolver(
            this.keyIn,
            this.cursor,
            this.editor,
            this.identifiers,
            resolver,
        );
    }

    /** Returns a tape over the current line up to the cursor. */
    leftOfCursor(): Tape {
        return this.line.before(this.cursor);
    }

    /** Returns a tape over the current line after the cursor. */
    rightOfCursor(): Tape {
        return this.line.after(this.cursor);
    }

    seekOpenBracket(brackets: Brackets): Position | undefined {
        return this._seekOpenBracket(brackets, this.cursor, true);
    }

    seekCloseBracket(brackets: Brackets): Position | undefined {
        return this._seekCloseBracket(brackets, this.cursor, true);
    }

    fileUpToCursor(): Tape {
        return Tape.over(
            this.editor.document.getText(
                new Range(new Position(0, 0), this.cursor),
            ),
        );
    }

    private static OTHER_BRACKETS: Record<string, string> = {
        ')': '}]>',
        '}': ')]>',
        ']': ')}>',
        '>': ')}]',
        '(': '{[<',
        '{': '([<',
        '[': '({<',
        '<': '({[',
    };

    private _seekOpenBracket(
        brackets: Brackets,
        start: Position,
        recur: boolean,
    ): Position | undefined {
        let depth = 0;
        let lineLookbehind = 0;
        const [open, closed] = brackets;
        for (let line = start.line; line >= 0; line--, lineLookbehind++) {
            if (lineLookbehind > MAX_LINE_SEEK) {
                return undefined;
            }
            const text = this.editor.document.lineAt(line).text;
            const end = line === start.line ? start.character : text.length;
            for (let character = end - 1; character >= 0; character--) {
                const ch = text[character];
                if (recur) {
                    if (CompletionContext.OTHER_BRACKETS[open].includes(ch)) {
                        // missing closer for other type of bracket
                        return undefined;
                    }
                    if (CompletionContext.OTHER_BRACKETS[closed].includes(ch)) {
                        const openPos = this._seekOpenBracket(
                            (ch === ')'
                                ? '('
                                : String.fromCharCode(
                                      ch.charCodeAt(0) - 2,
                                  )) as Brackets,
                            new Position(line, character),
                            false,
                        );
                        if (!openPos) {
                            return undefined;
                        }
                        line = openPos.line;
                        character = openPos.character;
                        continue;
                    }
                } else if (ch === open) {
                    if (depth === 0) {
                        return new Position(line, character + 1);
                    }
                    depth--;
                } else if (ch === closed) {
                    depth++;
                }
            }
        }
        return undefined;
    }

    private _seekCloseBracket(
        brackets: Brackets,
        start: Position,
        recur: boolean,
    ): Position | undefined {
        let depth = 0;
        let lineLookbehind = 0;
        const doc = this.editor.document;
        const [open, closed] = brackets;
        for (
            let line = start.line;
            line < doc.lineCount;
            line++, lineLookbehind++
        ) {
            if (lineLookbehind > MAX_LINE_SEEK) {
                return undefined;
            }
            const text = doc.lineAt(line).text;
            const end = line === start.line ? start.character : text.length;
            for (let character = 0; character < end; character++) {
                const ch = text[character];
                if (recur) {
                    if (CompletionContext.OTHER_BRACKETS[closed].includes(ch)) {
                        // missing closer for other type of bracket
                        return undefined;
                    }
                    if (CompletionContext.OTHER_BRACKETS[open].includes(ch)) {
                        const closedPos = this._seekCloseBracket(
                            (ch === ')'
                                ? '('
                                : String.fromCharCode(
                                      ch.charCodeAt(0) - 2,
                                  )) as Brackets,
                            new Position(line, character),
                            false,
                        );
                        if (!closedPos) {
                            return undefined;
                        }
                        line = closedPos.line;
                        character = closedPos.character;
                        continue;
                    }
                } else if (ch === closed) {
                    if (depth === 0) {
                        return new Position(line, character + 1);
                    }
                    depth--;
                } else if (ch === open) {
                    depth++;
                }
            }
        }
        return undefined;
    }
}

/** Created and stored after a shorthand is matched, and recalled once the trigger is pressed. */
export type CompletionStrategy = {
    readonly family: CompletionFamily<any>;
    readonly completion: Completion;

    /** The position of the cursor the instance this object was created. */
    readonly position: Position;
};
