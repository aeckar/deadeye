import * as vscode from 'vscode'; // Visual Studio Code API
import Tape from './tape';
import lineCompletions from './line_completions';

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
export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(async event => {
            // editor.selection.active is stale here

            const change = event.contentChanges[0];
            if (!change) {
                return;
            }
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }
            await handleLineCompletion(change, editor);
        }),
    );
}

async function handleLineCompletion(
    change: vscode.TextDocumentContentChangeEvent,
    editor: vscode.TextEditor,
): Promise<boolean> {
    const pos = change.range.start.translate(0, change.text.length);
    const langId = editor.document.languageId;
    const line = editor.document.lineAt(pos.line).text;
    if (!line) {
        // ensure line is not empty before passing to handlers
        return false;
    }
    for (const handler of lineCompletions[langId]) {
        let res = handler(Tape.over(line), pos.character);
        if (!res) {
            continue;
        }
        const range = new vscode.Range(
            pos.with(undefined, pos.character - res.length),
            pos,
        );
        await editor.insertSnippet(
            new vscode.SnippetString(res.snippet),
            range,
        );
        return true;
    }
    return false;
}

// called when extension is deactivated
export function deactivate() {}
