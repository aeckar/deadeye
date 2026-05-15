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

/** Extension initializer. */
export function activate(context: ExtensionContext) {
    commands.registerCommand('deadeye.trigger', () => {
        const editor = window.activeTextEditor;
        if (!editor) {
            return;
        }
        const completion = completionStrategy?.completion;
        if (!completion) {
            editor.edit(editBuilder => {
                editBuilder.insert(editor.selection.active, ' ');
            });
            return;
        }
        applyCompletion(editor, completion);
        completionStrategy = undefined;
    });

    const cancelOnSelectionChange = window.onDidChangeTextEditorSelection(
        event => {
            cancelCompletion(event.textEditor);
        },
    );

    const validateThenResolveCompletion = workspace.onDidChangeTextDocument(
        async event => {
            // `editor.selection.active` is stale here
            const change = event.contentChanges[0];
            if (
                !change ||
                change.text.length === 0 || // deletion, backspace, cut
                change.text.length > 1 // paste, autocomplete, programmatic insertion
            ) {
                return;
            }
            const editor = window.activeTextEditor;
            if (!editor) {
                return;
            }
            await resolveCompletion(change, editor);
            cancelCompletion(editor);
        },
    );

    const showDocsOnHover = languages.registerHoverProvider('rust', {
        provideHover(_, __, ___) {
            return completionStrategy
                ? new Hover(completionStrategy.shorthand.docs)
                : null;
        },
    });

    context.subscriptions.push(
        validateThenResolveCompletion,
        showDocsOnHover,
        cancelOnSelectionChange,
    );
}

/**
 * Runs every line-based completion for the current language.
 *
 * @return `true` if a line-based shorthand was expanded.
 */
async function resolveCompletion(
    change: TextDocumentContentChangeEvent,
    editor: TextEditor,
): Promise<boolean> {
    const pos = change.range.start.translate(0, change.text.length);
    const langId = editor.document.languageId;
    const line = editor.document.lineAt(pos.line).text;
    if (!line) {
        // ensure line is not empty before passing to resolvers
        return false;
    }
    const scopes = await getCachedScopes(
        editor.document,
        pos,
        scopeResolvers[langId],
    );
    for (const shorthand of shorthands[langId]) {
        let completion = shorthand.resolver(
            new CompletionContext(Tape.of(line), pos, editor),
        );
        if (!completion) {
            continue;
        }
        completionStrategy = { shorthand, completion };
        editor.setDecorations(shorthandDecoration, [completion.target]);
        return true;
    }
    return false;
}

async function applyCompletion(editor: TextEditor, completion: Completion) {
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

// const { line: lineDelta, char: charDelta } = sub.newCursorPos;
// const current = editor.selection.active;
// const targetLine = current.line + (lineDelta ?? 0);
// const targetChar = Math.max(0, current.character + (charDelta ?? 0));
// if (targetLine >= editor.document.lineCount) {
//     const linesToAdd = targetLine - (editor.document.lineCount - 1);
//     await editor.edit(e => {
//         const lastLine = editor.document.lineAt(
//             editor.document.lineCount - 1,
//         );
//         e.insert(lastLine.range.end, '\n'.repeat(linesToAdd));
//     });
// }
// const lineLength = editor.document.lineAt(targetLine).text.length;
// const clampedChar = Math.min(targetChar, lineLength);
// const newPos = new Position(targetLine, clampedChar);
// editor.selection = new Selection(newPos, newPos);
// editor.revealRange(new Range(newPos, newPos));
