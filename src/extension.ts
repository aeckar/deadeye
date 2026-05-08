import {
    Position,
    workspace,
    ExtensionContext,
    window,
    TextDocumentContentChangeEvent,
    TextEditor,
    SnippetString,
} from 'vscode'; // Visual Studio Code API
import Tape from './tape';
import lineCompletions from './line_completions';

// todo config api

// manual insertion and snippet with $0 is negligible perf diff
// fallbacks for top-level completions as scoped after some whitespace

// top-level functions should use `function` notation

// props: trigger charset
// params: line-tape
// returns: how far back to replace, snippet
/*
    for scoped:
    params: +scope tree w/ rich info, 
*/

// called on first time command is executed
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
            await insertFromCursor(change, editor);
        }),
    );
}

async function insertFromCursor(
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
