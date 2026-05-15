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
    MarkdownString,
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
let decorationSyncId: number | undefined; // todo store by window/lang

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

function startDecorationSync() {
    console.log('hello\n');

    if (decorationSyncId !== undefined) {
        return decorationSyncId;
    }
    decorationSyncId = setInterval(() => {
        syncDecoration();
    }, 500);
}

function stopDecorationSync() {
    clearInterval(decorationSyncId);
    decorationSyncId = undefined;
}

function syncDecoration() {
    const editor = window.activeTextEditor;
    if (!editor || !completionStrategy) {
        return;
    }
    const completion = completionStrategy.completion;
    const position = editor.selection.active;
    if (completionStrategy.position !== position) {
        completion.target = new Range(completion.target.start, position);
    }
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

    const syncDecoration = window.onDidChangeWindowState(event => {
        if (event.focused) {
            startDecorationSync();
        } else {
            stopDecorationSync();
        }
    });

    const cancelOnSelectionChange = window.onDidChangeTextEditorSelection(
        event => {
            cancelCompletion(event.textEditor);
        },
    );

    // Prefer low-level command to `onDidChangeActiveTextEditor` listener
    // so extremely keystroke combos can be recognized.
    const validateThenResolveCompletionStrategy = commands.registerCommand(
        'type',
        async args => {
            const editor = window.activeTextEditor;
            if (!editor) {
                return;
            }
            await getCompletionStrategy(args.text, editor);
            commands.executeCommand('default:type', args); // manually perform insertion
            if (completionStrategy) {
                editor.setDecorations(decoration, [
                    completionStrategy.completion.target,
                ]);
            }
        },
    );

    const showDocsOnHover = languages.registerHoverProvider('rust', {
        provideHover(_, __, ___) {
            if (!completionStrategy) {
                return null;
            }
            return new Hover(completionStrategy.shorthand.docs);
        },
    });

    const showTitleOnHover = languages.registerHoverProvider('rust', {
        provideHover(_, __, ___) {
            if (!completionStrategy) {
                return null;
            }
            return new Hover(completionStrategy.completion.title);
        },
    });

    context.subscriptions.push(
        validateThenResolveCompletionStrategy,
        showTitleOnHover,
        showDocsOnHover,
        // syncDecoration,
        cancelOnSelectionChange,
        // { dispose: () => stopDecorationSync() },
    );
}

/**
 * Runs every line-based completion for the current language.
 *
 * @return `true` if a line-based shorthand was expanded.
 */
async function getCompletionStrategy(key: string, editor: TextEditor) {
    const active = editor.selection.active;
    const position = new Position(active.line, active.character + 1);
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
            new CompletionContext(Tape.of(line + key), position, editor),
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
