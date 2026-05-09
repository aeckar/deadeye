//! Extension entry point.
import { ExtensionContext, Position, Range, Selection, SnippetString, TextDocumentContentChangeEvent, TextEditor, window, workspace } from 'vscode';



import lineCompletions from './completions';
import Tape from './tape';
import { Replacement } from './utils';
import { getScopeCached } from './scopes';












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

/** Extension initializer. */
export function activate(context: ExtensionContext) {
    context.subscriptions.push(
        workspace.onDidChangeTextDocument(async event => {
            // editor.selection.active is stale here

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
            await runLineCompletions(change, editor);
        }),
    );
}

/**
 * Runs every line-based completion for the current language.
 *
 * @return `true` if a line-based shorthand was expanded.
 */
async function runLineCompletions(
    change: TextDocumentContentChangeEvent,
    editor: TextEditor,
): Promise<boolean> {
    const pos = change.range.start.translate(0, change.text.length);
    const langId = editor.document.languageId;
    const line = editor.document.lineAt(pos.line).text;
    if (!line) {
        // ensure line is not empty before passing to handlers
        return false;
    }
    const scopes = await getScopeCached(editor.document, pos);
    for (const completion of lineCompletions[langId]) {
        let repl = completion(Tape.of(line), pos, scopes);
        if (!repl) {
            continue;
        }
        applyReplacement(editor, repl);
        return true;
    }
    return false;
}

async function applyReplacement(editor: TextEditor, repl: Replacement) {
    await editor.insertSnippet(new SnippetString(repl.snippet), repl.target);
    if (!repl.displacement) {
        return;
    }
    const { line: lineDelta, char: charDelta } = repl.displacement;
    const current = editor.selection.active;
    const targetLine = current.line + (lineDelta ?? 0);
    const targetChar = Math.max(0, current.character + (charDelta ?? 0));
    if (targetLine >= editor.document.lineCount) {
        const linesToAdd = targetLine - (editor.document.lineCount - 1);
        await editor.edit(e => {
            const lastLine = editor.document.lineAt(
                editor.document.lineCount - 1,
            );
            e.insert(lastLine.range.end, '\n'.repeat(linesToAdd));
        });
    }
    const lineLength = editor.document.lineAt(targetLine).text.length;
    const clampedChar = Math.min(targetChar, lineLength);
    const newPos = new Position(targetLine, clampedChar);
    editor.selection = new Selection(newPos, newPos);
    editor.revealRange(new Range(newPos, newPos));
}
