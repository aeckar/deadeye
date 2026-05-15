//! Extension entry point.
import {
    ExtensionContext,
    Position,
    Range,
    Selection,
    SnippetString,
    TextDocumentContentChangeEvent,
    TextEditor,
    ThemeColor,
    commands,
    window,
    workspace,
} from 'vscode';

import { Completion, CompletionContext, Shorthand } from './completion_utils';
import scopeResolvers from './lang/scope_resolvers';
import shorthands from './lang/shorthands';
import { getCachedScopes } from './scope_utils';
import Tape from './tape';

/* # Implementation Notes
 *
 * - Manual text insertion and snippet injection have a negligible performance difference,
 * so the latter is chosen for ergonomics
 * - Scoped completions may fall back to a line-based form to promote better performance
 *
 * # Style Guide
 *
 * - Top-level functions should use `function` notation over arrow function constants
 */

const chordDecoration = window.createTextEditorDecorationType({
    backgroundColor: new ThemeColor('editor.findMatchHighlightBackground'),
    borderColor: new ThemeColor('editorInfo.foreground'),
    border: '1px solid',
    borderRadius: '3px',
    color: new ThemeColor('editorInfo.foreground'),
});

let completionOnTrigger: Completion | undefined;

/** Extension initializer. */
export function activate(context: ExtensionContext) {
    commands.registerCommand('deadeye.trigger', () => {
        const editor = window.activeTextEditor;
        if (!editor) {
            return;
        }
        if (!completionOnTrigger) {
            editor.edit(editBuilder => {
                editBuilder.insert(editor.selection.active, ' ');
            });
        }
        applyCompletion(editor, completionOnTrigger!);
        completionOnTrigger = undefined;
    });

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
        },
    );

    context.subscriptions.push(validateThenResolveCompletion);
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
        completionOnTrigger = completion;
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
