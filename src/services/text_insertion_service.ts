import { Completion, CompletionContext, CompletionStrategy } from '@/api/completion_api'
import {
    commands,
    ExtensionContext,
    Hover,
    languages,
    Position,
    Selection,
    SnippetString,
    TextEditor,
    ThemeColor,
    window,
} from 'vscode'
import DocumentInfoService from './document_info_service'
import LanguageInfoService from './language_info_service'

/**
 * Provides an interface to the current completion strategy,
 * as well as methods to apply it when the associated completion is triggered.
 */
class TextInsertionService {
    private static isActive = false
    private static _curStrategy?: CompletionStrategy

    static get curStrategy(): CompletionStrategy {
        return this._curStrategy!
    }

    static async start(ctx: ExtensionContext) {
        if (this.isActive) {
            return
        }
        await DocumentInfoService.start(ctx)
        await LanguageInfoService.start()
        ctx.subscriptions.push(
            // Cancel completion on selection change
            window.onDidChangeTextEditorSelection(event => {
                TextInsertionService.cancelCompletion(event.textEditor)
            }),

            // Prepare completion on keystroke
            //
            // Prefer low-level command to `onDidChangeActiveTextEditor` listener
            // for optimal recognition of fast keystroke combos.
            commands.registerCommand('type', async args => {
                const editor = window.activeTextEditor
                if (!editor) {
                    return
                }
                const keyIn = (args.text as string).replace(/^ +$/g, '') // sometimes preceded by space
                const strategy = this._curStrategy
                if (!keyIn) {
                    // pressed space
                    if (!strategy) {
                        // fixme for hot completions, other triggers
                        editor.edit(editBuilder => {
                            editBuilder.insert(editor.selection.active, ' ')
                        })
                        return
                    }
                    this.applyCompletion(editor, strategy.completion)
                    this._curStrategy = undefined
                    return
                }
                commands.executeCommand('default:type', args) // manually perform insertion
                this.updateCompletionStrategy(keyIn, editor)
                if (strategy) {
                    editor.setDecorations(this.decoration, [strategy.completion.target])
                }
            }),

            // Show documentation on hover
            languages.registerHoverProvider('rust', {
                provideHover(_, position) {
                    const strategy = TextInsertionService._curStrategy
                    if (!strategy || !strategy.completion.target.contains(position)) {
                        return null
                    }
                    return new Hover(strategy.family.docs)
                },
            }),

            // Show preview on hover
            languages.registerHoverProvider('rust', {
                provideHover(_, position) {
                    const strategy = TextInsertionService._curStrategy
                    const target = strategy?.completion.target
                    if (!strategy || !target?.contains(position)) {
                        return null
                    }
                    return new Hover(strategy.preview())
                },
            }),
        )
    }

    //todo refine
    private static decoration = window.createTextEditorDecorationType({
        borderColor: new ThemeColor('editorInfo.foreground'),
        border: '1px solid',
        borderRadius: '3px',
        color: new ThemeColor('editorInfo.foreground'),
    })

    /**
     * Tests every completion resolver for the completion family of the current language.
     * If a `Completion` is returned, it is stored in a `CompletionStrategy` and
     * that completion is sent once the trigger is pressed.
     */
    static updateCompletionStrategy(keyIn: string, editor: TextEditor) {
        const document = editor.document
        const active = editor.selection.active
        const cursor = new Position(active.line, active.character + 1) // adjust for key-in
        const ctx = new CompletionContext(document, keyIn, cursor)
        const { completions } = LanguageInfoService.get(document.languageId)
        for (const [trigger, families] of completions) {
            for (const family of families) {
                ctx.resetLine()
                const completion = family.resolver(ctx)
                if (!completion) {
                    continue
                }
                this._curStrategy = new CompletionStrategy(family, trigger, completion, cursor)
                return
            }
        }
    }

    static async applyCompletion(editor: TextEditor, completion: Completion) {
        await editor.insertSnippet(new SnippetString(completion.snippet), completion.target)
        if (!completion.endCursorPos) {
            return
        }
        editor.selection = new Selection(completion.endCursorPos, completion.endCursorPos)
    }

    static cancelCompletion(editor: TextEditor) {
        const strategy = this._curStrategy
        if (strategy && editor.selection.active.isEqual(strategy.pos)) {
            // waiting for insertion of pressed key
            return
        }
        this._curStrategy = undefined
        editor.setDecorations(this.decoration, []) // reset decorations
    }
}

export default TextInsertionService
