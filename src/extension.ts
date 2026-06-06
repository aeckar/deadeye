//! Extension entry point.
//!
//! # Implementation Notes
//!
//! - Manual text insertion and snippet injection have a negligible performance difference,
//! so the latter is chosen for ergonomics
//! - Scoped completions may fall back to a line-based form to promote better performance
//! - Hover messages like those of rust-analyzer must be diagnostics to look that way, if desired
//!
//! # Style Guide (not enforced by .prettierrc)
//!
//! - Top-level functions should use `function` notation over arrow function constants
//! to easily discern from top-level constants
import {
    ExtensionContext,
    Hover,
    MarkdownString,
    Position,
    Range,
    Selection,
    SnippetString,
    TextEditor,
    ThemeColor,
    commands,
    languages,
    window,
} from 'vscode';

import {
    Completion,
    CompletionResolverContext,
    CompletionStrategy,
} from './completion_utils';
import scopeResolvers from './lang/scope_resolvers';
import shorthands from './lang/shorthands';
import { getCachedScopes } from './scope_utils';
import Tape from './tape';

let completionStrategy: CompletionStrategy | undefined;
let decorationSyncTimeout: NodeJS.Timeout | undefined; // todo store by window/lang

const decoration = window.createTextEditorDecorationType({
    borderColor: new ThemeColor('editorInfo.foreground'),
    border: '1px solid',
    borderRadius: '3px',
    color: new ThemeColor('editorInfo.foreground'),
});

function cancelCompletion(editor: TextEditor) {
    if (
        completionStrategy &&
        editor.selection.active.isEqual(completionStrategy.position)
    ) {
        // waiting for insertion of pressed key
        return;
    }
    completionStrategy = undefined;
    editor.setDecorations(decoration, []);
}

/** Extension initializer. */
export function activate(context: ExtensionContext) {
    commands.registerCommand('deadeye.trigger', () => {
        const editor = window.activeTextEditor;
        if (!editor) {
            return;
        }
        if (!completionStrategy) {
            editor.edit(editBuilder => {
                editBuilder.insert(editor.selection.active, ' ');
            });
            return;
        }
        runCompletion(editor, completionStrategy.completion);
        completionStrategy = undefined;
    });

    const cancelOnSelectionChange = window.onDidChangeTextEditorSelection(
        event => {
            cancelCompletion(event.textEditor);
        },
    );

    // Prefer low-level command to `onDidChangeActiveTextEditor` listener
    // so extremely keystroke combos can be recognized.
    const getCompletionStrategyThenType = commands.registerCommand(
        'type',
        async args => {
            const editor = window.activeTextEditor;
            if (!editor) {
                return;
            }

            // sometimes key is preceded by space
            await getCompletionStrategy((args.text as string).trim(), editor);

            commands.executeCommand('default:type', args); // manually perform insertion
            if (completionStrategy) {
                editor.setDecorations(decoration, [
                    completionStrategy.completion.target,
                ]);
            }
        },
    );

    const showDocsOnHover = languages.registerHoverProvider('rust', {
        provideHover(_, position, __) {
            if (
                !completionStrategy ||
                !completionStrategy.completion.target.contains(position)
            ) {
                return null;
            }
            return new Hover(completionStrategy.shorthand.docs);
        },
    });

    const showPreviewOnHover = languages.registerHoverProvider('rust', {
        provideHover(_, position, __) {
            if (
                !completionStrategy ||
                !completionStrategy.completion.target.contains(position)
            ) {
                return null;
            }
            let title = completionStrategy.completion.preview;
            if (typeof title === 'string') {
                title = new MarkdownString(title);
            }
            return new Hover(title);
        },
    });

    context.subscriptions.push(
        getCompletionStrategyThenType,
        showPreviewOnHover,
        showDocsOnHover,
        cancelOnSelectionChange,
    );
}

/**
 * Runs every line-based completion for the current language.
 *
 * **CAUTION:** This function is **very** fragile.
 *
 * @return `true` if a line-based shorthand was expanded.
 */
async function getCompletionStrategy(key: string, editor: TextEditor) {
    const active = editor.selection.active;
    const position = new Position(active.line, active.character + 1); // adjust for key-in
    const langId = editor.document.languageId;
    const line = editor.document.lineAt(position.line).text + key;
    if (!line) {
        // ensure line is not empty before passing to resolvers
        return;
    }
    const scopes = await getCachedScopes(
        editor.document,
        position,
        scopeResolvers[langId],
    );
    for (const shorthand of shorthands[langId]) {
        const completion = shorthand.resolver(
            new CompletionResolverContext(Tape.of(line), position, editor),
        );
        if (!completion) {
            continue;
        }
        completionStrategy = { shorthand, completion, position };
        return;
    }
}

async function runCompletion(editor: TextEditor, completion: Completion) {
    await editor.insertSnippet(
        new SnippetString(completion.snippet),
        completion.target,
    );
    if (!completion.endCursorPos) {
        return;
    }
    editor.selection = new Selection(
        completion.endCursorPos,
        completion.endCursorPos,
    );
}
