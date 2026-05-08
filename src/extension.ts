//! Extension entry point.
import {
    ExtensionContext,
    SnippetString,
    TextDocumentContentChangeEvent,
    TextEditor,
    window,
    workspace,
} from 'vscode';

import lineCompletions from './line_completions';
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
            (await runLineCompletions(change, editor)) ||
                (await runScopedCompletions(change, editor));
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
    for (const handler of lineCompletions[langId]) {
        let res = handler(Tape.of(line), pos);
        if (!res) {
            continue;
        }
        await editor.insertSnippet(new SnippetString(res.snippet), res.target);
        return true;
    }
    return false;
}

/**
 * Runs ever
 *
 * @return `true` if a scope-based shorthand was expanded.
 */
async function runScopedCompletions(
    change: TextDocumentContentChangeEvent,
    editor: TextEditor,
): Promise<boolean> {
    //params: +scope tree w/ rich info,
    return true;
}
