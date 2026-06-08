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
//! to easily discern from top-level constants ... unless its a closure with captured variables
//! or you are implementing a closure type
// Use U+FF0F to escape `*/` in doc comment
// todo vocab--completion (family),
//  shorthand, snippet, terminator, trigger, basic form, preview, docs

import {
    ExtensionContext,
    Hover,
    MarkdownString,
    Position,
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
    CompletionContext,
    CompletionStrategy,
} from './completion_utils';
import completionFamilies from './lang/completion_families';
import scopeResolvers from './lang/scope_resolvers';
import { Scope } from './scoping_utils';
import Tape from './tape';
import { expandTabStops } from './text_utils';

let strategy: CompletionStrategy | undefined;
let decorationSyncTimeout: NodeJS.Timeout | undefined; // todo store by window/lang

const decoration = window.createTextEditorDecorationType({
    borderColor: new ThemeColor('editorInfo.foreground'),
    border: '1px solid',
    borderRadius: '3px',
    color: new ThemeColor('editorInfo.foreground'),
});

function cancelCompletion(editor: TextEditor) {
    if (strategy && editor.selection.active.isEqual(strategy.position)) {
        // waiting for insertion of pressed key
        return;
    }
    strategy = undefined;
    editor.setDecorations(decoration, []); // reset decorations
}

/** Extension initializer. */
export function activate(context: ExtensionContext) {
    const cancelCompletionOnSelectionChange =
        window.onDidChangeTextEditorSelection(event => {
            cancelCompletion(event.textEditor);
        });

    // Prefer low-level command to `onDidChangeActiveTextEditor` listener
    // for optimal recognition of fast keystroke combos.
    const prepareCompletionOnKeystroke = commands.registerCommand(
        'type',
        async args => {
            const editor = window.activeTextEditor;
            if (!editor) {
                return;
            }
            const key = (args.text as string).trim(); // sometimes preceded by space
            if (!key) {
                // pressed space
                if (!strategy) {
                    // fixme for hot completions
                    editor.edit(editBuilder => {
                        editBuilder.insert(editor.selection.active, ' ');
                    });
                    return;
                }
                applyCompletion(editor, strategy.completion);
                strategy = undefined;
                return;
            }

            await updateStrategy(key, editor);
            commands.executeCommand('default:type', args); // manually perform insertion
            if (strategy) {
                editor.setDecorations(decoration, [strategy.completion.target]);
            }
        },
    );

    const showDocsOnHover = languages.registerHoverProvider('rust', {
        provideHover(_, position, __) {
            if (!strategy || !strategy.completion.target.contains(position)) {
                return null;
            }
            return new Hover(strategy.family.docs);
        },
    });

    const showPreviewOnHover = languages.registerHoverProvider('rust', {
        provideHover(_, position, __) {
            if (!strategy || !strategy.completion.target.contains(position)) {
                return null;
            }
            // Since there can be multiple code blocks in a preview, don't bother
            // highlighting them by turning them into fenced code blocks.
            return new Hover(expandTabStops(strategy.completion.preview));
        },
    });

    context.subscriptions.push(
        prepareCompletionOnKeystroke,
        cancelCompletionOnSelectionChange,
        showPreviewOnHover,
        showDocsOnHover,
    );
}

/** Runs every line-based completion for the current language. */
async function updateStrategy(key: string, editor: TextEditor) {
    const active = editor.selection.active;
    const position = new Position(active.line, active.character + 1); // adjust for key-in
    const langId = editor.document.languageId;
    const line = editor.document.lineAt(position.line).text + key;
    if (!line) {
        return; // ensure line is not empty before passing to resolvers
    }
    const newContext = (scopeTree: Scope<any>[]): CompletionContext<any> => {
        return new CompletionContext(
            Tape.of(line),
            position,
            editor,
            scopeTree,
        );
    };
    // const scopeTree = await getCachedScopes(
    //     editor.document,
    //     position,
    //     newContext([]),
    //     scopeResolvers[langId],
    // );
    for (const family of completionFamilies[langId]) {
        const completion = family.resolver(newContext(scopeTree));
        if (!completion) {
            continue;
        }
        strategy = { family, completion, position };
        return;
    }
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
