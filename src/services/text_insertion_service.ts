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
import { logger } from '@/extension'

/**
 * Provides an interface to the current completion strategy,
 * as well as methods to apply it when the associated completion is triggered.
 */
class TextInsertionService {
    private static isActive = false
    private static _strategy?: CompletionStrategy

    private static targetDecoration = window.createTextEditorDecorationType({
        borderColor: new ThemeColor('editorInfo.foreground'),
        border: '1px solid',
        borderRadius: '3px',
        color: new ThemeColor('editorInfo.foreground'),
    })

    static get strategy(): CompletionStrategy {
        return this._strategy!
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
                const keyIn = (args.text as string).replace(/^ +$/g, '') // trim trailing spaces
                const strategy = this._strategy
                const trigger = strategy?.trigger
                if (
                    strategy &&
                    (trigger === '' || trigger === keyIn || (trigger === ' ' && keyIn === ''))
                ) {
                    this.runCompletion(editor, strategy.completion)
                    this._strategy = undefined
                    return
                }
                const { selection } = editor
                if (selection.anchor.isEqual(selection.active)) {
                    // no text currently selected
                    if (this.updateStrategy(editor, keyIn)) {
                        this.applyInsertion(editor, keyIn)
                    }
                    return
                }
                this.applyOverwrite(editor, keyIn)
            }),

            // Show documentation on hover
            languages.registerHoverProvider('rust', {
                provideHover(_, position) {
                    const strategy = TextInsertionService._strategy
                    if (!strategy || !strategy.completion.target.contains(position)) {
                        return null
                    }
                    return new Hover(strategy.family.docs)
                },
            }),

            // Show preview on hover
            languages.registerHoverProvider('rust', {
                provideHover(_, position) {
                    const strategy = TextInsertionService._strategy
                    const target = strategy?.completion.target
                    if (!strategy || !target?.contains(position)) {
                        return null
                    }
                    return new Hover(strategy.preview())
                },
            }),
        )
    }

    static applyInsertion(editor: TextEditor, keyIn: string) {
        editor.edit(editBuilder => {
            //todo figure out if need closing bracket or not (found open ==y; found close ==n; else ==y)<balanced>
            editBuilder.insert(editor.selection.active, keyIn)
        })
    }

    static applyOverwrite(editor: TextEditor, keyIn: string) {
        
    }

    /**
     * Tests every completion resolver for the completion family of the current language.
     * If a `Completion` is returned, it is stored in a `CompletionStrategy` and recorded.
     *
     * On success, applies target decorations.
     * 
     * This function is guaranteed to never throw an exception so that in the case that
     * one is thrown, the user is not prevented from editing the docuoment.
     *
     * Returns true if the strategy was updated, or false if no completion was resolved or
     * an exception was thrown at any point.
     */
    static updateStrategy(editor: TextEditor, keyIn: string): boolean {
        try {
            const document = editor.document
            const active = editor.selection.active
            const cursor = new Position(active.line, active.character + 1) // adjust for key-in
            const ctx = CompletionContext.newInstance(document, keyIn, cursor)
            const { completions } = LanguageInfoService.get(document.languageId)
            for (const [trigger, families] of completions) {
                for (const family of families) {
                    ctx.resetLine()
                    let completion: Completion | undefined
                    try {
                        completion = family.resolver(ctx)
                    } catch (e) {
                        logger.appendLine(`[Error] Exception while resolving completion: ${e}`)
                    }
                    if (!completion) {
                        continue
                    }
                    this._strategy = CompletionStrategy.newInstance(
                        family,
                        trigger,
                        completion,
                        cursor,
                    )
                    editor.setDecorations(this.targetDecoration, [this.strategy.completion.target])
                    return true
                }
            }
        } catch (e) {
            logger.appendLine(`[Error] Exception while updating strategy: ${e}`)
        }
        return false
    }

    static async runCompletion(editor: TextEditor, completion: Completion) {
        await editor.insertSnippet(new SnippetString(completion.snippet), completion.target)
        if (!completion.endCursorPos) {
            return
        }
        editor.selection = new Selection(completion.endCursorPos, completion.endCursorPos)
    }

    static cancelCompletion(editor: TextEditor) {
        const strategy = this._strategy
        if (strategy && editor.selection.active.isEqual(strategy.pos)) {
            // waiting for insertion of pressed key
            return
        }
        this._strategy = undefined
        editor.setDecorations(this.targetDecoration, []) // reset decorations
    }
}

export default TextInsertionService
