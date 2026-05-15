//! Extension entry point.
//!
//! # Implementation Notes
//!
//! - Manual text insertion and snippet injection have a negligible performance difference,
//! so the latter is chosen for ergonomics
//! - Scoped completions may fall back to a line-based form to promote better performance
//!
//! # Style Guide (not enforced by .prettierrc)
//!
//! - Top-level functions should use `function` notation over arrow function constants
import {
    ExtensionContext,
    Hover,
    Position,
    Range,
    Selection,
    SnippetString,
    TextDocumentContentChangeEvent,
    TextEditor,
    ThemeColor,
    commands,
    languages,
    window,
    workspace,
} from 'vscode';

import {
    Completion,
    CompletionContext,
    CompletionStrategy,
    Shorthand,
} from './completion_utils';
import scopeResolvers from './lang/scope_resolvers';
import shorthands from './lang/shorthands';
import { getCachedScopes } from './scope_utils';
import Tape from './tape';

let completionStrategy: CompletionStrategy | undefined;

const shorthandDecoration = window.createTextEditorDecorationType({
    borderColor: new ThemeColor('editorInfo.foreground'),
    border: '1px solid',
    borderRadius: '3px',
    color: new ThemeColor('editorInfo.foreground'),
});

function cancelCompletion(editor: TextEditor) {
    completionStrategy = undefined;
    editor.setDecorations(shorthandDecoration, []);
}

function startShorthandHighlightSync(): {
    setInterval();
};

function stopShorthandHighlightSync(): {
    setInterval();
};

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
        const completion = completionStrategy.completion;
        const position = editor.selection.active;
        if (completionStrategy.position !== position) {
            // sync end position
            const { start, end } = completion.target;
            completion.target = new Range(start, position);
        }
        runCompletion(editor, completionStrategy.completion);
        completionStrategy = undefined;
    });

    const syncShorthandHighlighting = window.onDidChangeWindowState(event => {
        if (event.focused) {
            startShorthandHighlightSync();
        } else {
            stopShorthandHighlightSync();
        }
    });

    const cancelOnSelectionChange = window.onDidChangeTextEditorSelection(
        event => {
            cancelCompletion(event.textEditor);
        },
    );

    const validateThenResolveCompletionStrategy =
        workspace.onDidChangeTextDocument(async event => {
            // `editor.selection.active` is stale here
            const change = event.contentChanges[0];
            const editor = window.activeTextEditor;
            if (!editor || !change || change.text.length === 0) {
                // check for deletion
                return;
            }
            await editor.document.save(); // sync changes
            await getCompletionStrategy(change, editor);
        });

    const showDocsOnHover = languages.registerHoverProvider('rust', {
        provideHover(_, __, ___) {
            if (!completionStrategy) {
                return null;
            }
            let docs = completionStrategy.shorthand
            return completionStrategy
                ? new Hover(completionStrategy.shorthand.docs)
                : null;
        },
    });

    context.subscriptions.push(
        validateThenResolveCompletionStrategy,
        showDocsOnHover,
        syncShorthandHighlighting,
        cancelOnSelectionChange,
        { dispose: () => stopShorthandHighlightSync() },
    );
}

/**
 * Runs every line-based completion for the current language.
 *
 * @return `true` if a line-based shorthand was expanded.
 */
async function getCompletionStrategy(
    change: TextDocumentContentChangeEvent,
    editor: TextEditor,
): Promise<void> {
    const position = change.range.start.translate(0, change.text.length);
    const langId = editor.document.languageId;
    const line = editor.document.lineAt(position.line).text;
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
            new CompletionContext(Tape.of(line), position, editor),
        );
        if (!completion) {
            continue;
        }
        completionStrategy = { shorthand, completion, position };
        editor.setDecorations(shorthandDecoration, [completion.target]);
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
