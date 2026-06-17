//! Algorithms and data structures used to parse completion shorthands.
//!
//! todo explain vocab
import { MarkdownString, Position, Range, TextEditor, window } from 'vscode';

import { rangeBefore } from './misc';
import Tape from './tape';
import { Brackets, toMarkdown as md, reverse } from './text_manip';

export const MAX_TOKEN_SEEK = 50;
export const MAX_LINE_SEEK = 50;
export const MAX_CHAR_SEEK = 2500;

// ========================================= Tape Interop =========================================

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

// ==================================== Registry API + Builder ====================================

/** Contains all completion families for a given language, grouped by trigger. */
export type FamilyRegistry<ScopeKind extends string> = Map<
    string,
    Family<ScopeKind>[]
> & { __brand: 'CompletionFamilyRegistry' };

/**
 * # Namespace
 *
 * Provides `newInstance` as an initializer.
 */
export namespace FamilyRegistry {
    /**
     * Initializes a completion family for each configuration,
     * then stores each in a map, grouped by trigger.
     */
    export function newInstance<ScopeKind extends string>(
        ...families: FamilyCtorArgs<ScopeKind>[]
    ): FamilyRegistry<ScopeKind> {
        const byTrigger = new Map() as FamilyRegistry<ScopeKind>;
        for (const args of families) {
            const family = new Family(args);
            if (!byTrigger.has(family.trigger)) {
                byTrigger.set(family.trigger, [family]);
            } else {
                byTrigger.get(family.trigger)!.push(family);
            }
        }
        return byTrigger as FamilyRegistry<ScopeKind>;
    }
}

export function substitute<ScopeKind extends string>(
    target: string,
    replacement: string,
    summary: string,
): FamilyCtorArgs<ScopeKind> {
    const length = target.length;
    return {
        docs: md`
        ${summary}
        
        \`${target}\` → \`${replacement}\`
        `,
        trigger: '',
        minLookbehind: length,
        resolver(ctx) {
            const tape = ctx.leftOfCursor().reversed();
            if (!tape.isAt(reverse(target))) {
                return undefined;
            }
            return new Completion({
                preview: md`Insert \`${replacement}\`.`,
                target: rangeBefore(ctx.cursor, length),
                snippet: replacement.replaceAll('$', '\\$'),
            });
        },
    };
}

// ===================================== Family API + Builder =====================================

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
export type Trigger = '' | ' ' | ';' | 'enter';

/**
 * A possible configuration of nested scopes.
 *
 * Scope kinds may be prefixed by `...` to indicate any sequence of scopes leading to that one.
 *
 * Nested scopes are not required to be adjacent; they must simply be present in the same order.
 * If not provided as an argument, the completion is matched in all scopes.
 * Passing an empty array is considered to be the top-level scope.
 */
export type ScopeTree<ScopeKind extends string> = (
    | ScopeKind
    | `...${ScopeKind}`
)[];

export type CompletionResolver<ScopeKind extends string> = (
    ctx: ScopedCompletionContext<ScopeKind>,
) => Completion | undefined;

export type FamilyCtorArgs<ScopeKind extends string> = {
    docs: MarkdownString;
    minLookbehind: number;
    resolver: CompletionResolver<ScopeKind>;
    trigger?: Trigger;
    scoping?: ScopeTree<ScopeKind>[];
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
 * 
 * # Implementation
 * 
 * Changed name from `CompletionFamily` to `Family` to reduce length of derived type names.
 */
export class Family<ScopeKind extends string> {
    /**
     * A short description in Markdown, generated dynamically
     * to explain to user exactly what the shorthand does when triggered. This documentation appears
     * next to the cursor shortly after the shorthand is detected but before it is triggered.
     */
    readonly docs: MarkdownString;

    /**
     * The minimum number of previous, consecutive character insertions
     * for a match to this shorthand to be valid. This is an optimization, often the minimum number
     * of characters for the base case. Can be assigned `NaN` so this shorthand is always checked.
     */
    readonly minLookbehind: number;

    /**
     * The key that triggers the completion.
     *
     * If empty, this completion fires instantly.
     */
    readonly trigger: Trigger;

    /**
     * The possible scope trees required for this shorthand to match.
     *
     * If assigned an empty array, this shorthand matches in every scope.
     */
    readonly scoping: ScopeTree<ScopeKind>[];

    /** The logic used to match this shorthand to a dynamic, context-aware completion. */
    readonly resolver: CompletionResolver<ScopeKind>;

    constructor(args: FamilyCtorArgs<ScopeKind>) {
        this.docs = args.docs;
        this.minLookbehind = args.minLookbehind;
        this.resolver = args.resolver;
        this.trigger = Family.orDefaultTrigger(args.trigger);
        this.scoping = Family.orDefaultScoping(args.scoping);
    }

    static orDefaultTrigger(trigger?: Trigger): Trigger {
        return trigger ?? ' ';
    }

    static orDefaultScoping<ScopeKind extends string>(
        scoping?: ScopeTree<ScopeKind>[],
    ): ScopeTree<ScopeKind>[] {
        return scoping ?? [];
    }
}

export type CompletionCtorArgs = {
    preview: MarkdownString;
    target: Range;
    snippet: string;
    errors?: Range[];
    insertAt?: Position;
    endCursorPos?: Position;
};

/** The result of {@link Family.resolver}. */
export class Completion {
    /**
     * A short description of what the completion of the shorthand does.
     *
     * This is created after each match to describe **exactly** how the code is modified.
     * This contrasts with {@link Family.docs}, which is a general description of
     * the shorthand or family of shorthands.
     *
     * This is through `expandTabStops` before rendering.
     *
     * This must be given for every completion, even if {@link Family.trigger} is `null`,
     * in case future APIs use expose this functionality to the user.
     */
    readonly preview: MarkdownString;

    /** The location of the actual shorthand, which is replaced. */
    readonly target: Range;

    /** The snippet that replaces the {@link target}. */
    readonly snippet: string;

    /**
     * The ranges in the source file within `target` that represent tokens
     * in the shorthand that would be replaced with illegal language constructs if triggered.
     *
     * If the trigger is pressed, the completion will fire according to the
     * all parts of the shorthand that are not highlighted as errors, as
     * enforced by the completion resolver.
     */
    readonly errors?: Range[];

    /**
     * The ranges in the source file within `target`
     * that represent unoptimal tokens in the shorthand.
     *
     * If the trigger is pressed, the completion will fire according to the
     * all parts of the shorthand that are not highlighted as errors, as
     * enforced by the completion resolver.
     */
    readonly warnings?: Range[];

    /**
     * If defined, is the position of the snippet to be inserted. Otherwise,
     * the snippet is inserted at the position of the cursor after the target is deleted.
     */
    readonly insertAt?: Position;

    /** The final position of the cursor after the snippet has been inserted. */
    readonly endCursorPos?: Position;

    constructor(args: CompletionCtorArgs) {
        if (args.errors) {
            const invalid = args.errors.filter(e => !args.target.contains(e));
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
                this.errors = args.errors.filter(e => args.target.contains(e));
            } else {
                this.errors = args.errors;
            }
        }
        this.preview = args.preview;
        this.target = args.target;
        this.snippet = args.snippet;
        this.insertAt = args.insertAt;
        this.endCursorPos = args.endCursorPos;
    }
}

/**
 * Used to resolve {@link Scope scopes}.
 *
 * {@link Completion Completions} are {@link Family.resolver resolved}
 * use the child class {@link ScopedCompletionContext}, since it contains the
 * scope tree for the current position of the cursor.
 */
export class CompletionContext {
    readonly line: Tape;
    readonly cursor: Position;
    readonly editor: TextEditor;
    protected readonly keyIn: string;

    constructor(keyIn: string, cursor: Position, editor: TextEditor) {
        this.line = Tape.over(editor.document.lineAt(cursor.line).text + keyIn);
        this.cursor = cursor;
        this.editor = editor;
        this.keyIn = keyIn;
    }

    toScoped<ScopeKind extends string>(resolver: ScopeResolver<ScopeKind>) {
        return ScopedCompletionContext.withResolver(
            this.keyIn,
            this.cursor,
            this.editor,
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

    seekOpener(brackets: Brackets): Position | undefined {
        return this.seekOpenerRecursive(brackets, this.cursor, true);
    }

    seekCloser(brackets: Brackets): Position | undefined {
        return this.seekCloserRecursive(brackets, this.cursor, true);
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

    private seekOpenerRecursive(
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
                        const openPos = this.seekOpenerRecursive(
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

    private seekCloserRecursive(
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
                        const closedPos = this.seekCloserRecursive(
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
    readonly family: Family<any>;
    readonly completion: Completion;

    /** The position of the cursor the instance this object was created. */
    readonly position: Position;
};

// ================================= Scope Resolver API + Builder =================================

/**
 * Implemented by a top-level constant for each language,
 * which is then be passed as an entry to `scopeResolvers` (`lang/scope_resolvers.ts`).
 * This then provides scope resolution for a given `langId`.
 */
export type ScopeResolver<ScopeKind extends string> = (
    ctx: CompletionContext,
) => Scope<ScopeKind>[];

/** Represents a member in the scope tree at a particular position in a file. */
export type Scope<ScopeKind extends string> = {
    /** The type of scope, as defined in `lang/<langId>/scopes.ts`. */
    readonly kind: ScopeKind;

    /**
     * The position of the first character of the scope marker
     * (`if`, `fn`, `impl`, `mod`, etc.), which is primarily useful to hot completions
     * that modify the scope signature.
     */
    readonly markerPos: Position;

    /** The position of the opening bracket that denotes this scope. */
    readonly openPos: Position;
};

/**
 * Contains the scope tree for the current cursor position.
 *
 * {@link Completion Completions} and completion prefixes are resolved
 * using instances of this class.
 *
 * @see CompletionContext
 */
export class ScopedCompletionContext<
    ScopeKind extends string,
> extends CompletionContext {
    readonly scopes: Scope<ScopeKind>[];

    constructor(
        keyIn: string,
        cursor: Position,
        editor: TextEditor,
        scopes: Scope<ScopeKind>[],
    ) {
        super(keyIn, cursor, editor);
        this.scopes = scopes;
    }

    static withResolver<ScopeKind extends string>(
        keyIn: string,
        cursor: Position,
        editor: TextEditor,
        resolver: ScopeResolver<ScopeKind>,
    ) {
        return new ScopedCompletionContext(
            keyIn,
            cursor,
            editor,
            resolver(new CompletionContext(keyIn, cursor, editor)),
        );
    }

    clone(): ScopedCompletionContext<ScopeKind> {
        return new ScopedCompletionContext(
            this.keyIn,
            this.cursor,
            this.editor,
            this.scopes,
        );
    }
}
