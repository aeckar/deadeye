//! Extension entry point.
//!
//! # Implementation Notes
//!
//! - Manual text insertion and snippet injection have a negligible performance difference,
//! so the latter is chosen for ergonomics
//! - Scoped completions may fall back to a line-based form to promote better performance
//! - Hover messages like those of rust-analyzer must be diagnostics to look that way, if desired
import {
    commands,
    ExtensionContext,
    Hover,
    languages,
    MarkdownString,
    Position,
    Selection,
    SnippetString,
    TextEditor,
    ThemeColor,
    window,
} from 'vscode'

import {
    Completion,
    CompletionContext,
    CompletionStrategy,
} from './completions'
import DocumentInfoService from './document_info_service'
import IntervalTreeService from './interval_tree_service'
import allCompletionRegistries from './lang/all_completion_registries'
import ScopeBreadcrumbsService from './scope_breadcrumbs_service'
import { applySmartDeletion } from './smart_delete'

let completionStrategy: CompletionStrategy | undefined

const decoration = window.createTextEditorDecorationType({
    borderColor: new ThemeColor('editorInfo.foreground'),
    border: '1px solid',
    borderRadius: '3px',
    color: new ThemeColor('editorInfo.foreground'),
})

function cancelCompletion(editor: TextEditor) {
    if (
        completionStrategy &&
        editor.selection.active.isEqual(completionStrategy.pos)
    ) {
        // waiting for insertion of pressed key
        return
    }
    completionStrategy = undefined
    editor.setDecorations(decoration, []) // reset decorations
}

/** Extension initializer. */
export function activate(context: ExtensionContext) {
    DocumentInfoService.start(context)
    IntervalTreeService.start()
    ScopeBreadcrumbsService.start(context)

    const cancelCompletionOnSelectionChange =
        window.onDidChangeTextEditorSelection(event => {
            cancelCompletion(event.textEditor)
        })

    const smartBackspaceKey = commands.registerTextEditorCommand(
        'deleteLeft',
        editor => {
            applySmartDeletion(editor, 'left')
        },
    )

    const smartDeleteKey = commands.registerTextEditorCommand(
        'deleteRight',
        editor => {
            applySmartDeletion(editor, 'right')
        },
    )

    // Prefer low-level command to `onDidChangeActiveTextEditor` listener
    // for optimal recognition of fast keystroke combos.
    const prepareCompletionOnKeystroke = commands.registerCommand(
        'type',
        async args => {
            const editor = window.activeTextEditor
            if (!editor) {
                return
            }
            const keyIn = (args.text as string).replace(/^ +$/g, '') // sometimes preceded by space
            if (!keyIn) {
                // pressed space
                if (!completionStrategy) {
                    // fixme for hot completions, other triggers
                    editor.edit(editBuilder => {
                        editBuilder.insert(editor.selection.active, ' ')
                    })
                    return
                }
                applyCompletion(editor, completionStrategy.completion)
                completionStrategy = undefined
                return
            }
            commands.executeCommand('default:type', args) // manually perform insertion
            await updateCompletionStrategy(keyIn, editor)
            if (completionStrategy) {
                editor.setDecorations(decoration, [
                    completionStrategy.completion.target,
                ])
            }
        },
    )

    const showDocsOnHover = languages.registerHoverProvider('rust', {
        provideHover(_, position) {
            if (
                !completionStrategy ||
                !completionStrategy.completion.target.contains(position)
            ) {
                return null
            }
            return new Hover(completionStrategy.family.docs)
        },
    })

    const showPreviewOnHover = languages.registerHoverProvider('rust', {
        provideHover(_, position) {
            if (
                !completionStrategy ||
                !completionStrategy.completion.target.contains(position)
            ) {
                return null
            }
            // Since there can be multiple code blocks in a preview, don't bother
            // highlighting them by turning them into fenced code blocks.
            return new Hover(
                new MarkdownString(
                    completionStrategy.completion.preview.value
                        .replace('$0', '/* stop here */')
                        .replace(
                            /\$\{?(\d)(?::.*?\})?/,
                            '/* placeholder $1 */',
                        ),
                ),
            )
        },
    })

    context.subscriptions.push(
        smartBackspaceKey,
        smartDeleteKey,
        prepareCompletionOnKeystroke,
        cancelCompletionOnSelectionChange,
        showPreviewOnHover,
        showDocsOnHover,
    )
}

/** Runs every line-based completion for the current language. */
async function updateCompletionStrategy(keyIn: string, editor: TextEditor) {
    const document = editor.document
    const active = editor.selection.active
    const cursor = new Position(active.line, active.character + 1) // adjust for key-in
    const langId = document.languageId
    const ctx = new CompletionContext(document, keyIn, cursor)
    for (const [trigger, families] of allCompletionRegistries[langId]) {
        for (const family of families) {
            ctx.resetLine()
            const completion = family.resolver(ctx)
            if (!completion) {
                continue
            }
            completionStrategy = new CompletionStrategy(
                family,
                trigger,
                completion,
                cursor,
            )
            return
        }
    }
}

async function applyCompletion(editor: TextEditor, completion: Completion) {
    await editor.insertSnippet(
        new SnippetString(completion.snippet),
        completion.target,
    )
    if (!completion.endCursorPos) {
        return
    }
    editor.selection = new Selection(
        completion.endCursorPos,
        completion.endCursorPos,
    )
}
