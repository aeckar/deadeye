import { Completion, CompletionContext, CompletionStrategy } from '@/api/completion_api'
import { Token } from '@/api/language_api'
import { logger } from '@/logger'
import DocumentInfoService from '@/services/document_info_service'
import LanguageInfoService from '@/services/language_info_service'
import { CLOSE_BRACKETS } from '@/utils/constants'
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
                const keyIn = (args.text as string).replace(/^ +$/g, '') || ' '
                if (keyIn.length > 1) {
                    // bulk insertion, usually paste
                    editor.edit(editBuilder => {
                        editBuilder.insert(editor.selection.active, keyIn)
                    })
                    return
                }
                const strategy = this._strategy
                const trigger = strategy?.trigger
                if (strategy && (trigger === '' || trigger === keyIn)) {
                    this.runCompletion(editor, strategy.completion)
                    this._strategy = undefined
                    return
                }
                const updated = this.updateStrategy(editor, keyIn)
                await this.insertText(editor, keyIn)
                if (updated) {
                    editor.setDecorations(this.targetDecoration, [this.strategy.completion.target])
                }
            }),
        )

        for (const [langId] of LanguageInfoService.select(/.*/g)) {
            ctx.subscriptions.push(
                // Show documentation on hover
                languages.registerHoverProvider(langId, {
                    provideHover(_, position) {
                        const strategy = TextInsertionService._strategy
                        if (!strategy || !strategy.completion.target.contains(position)) {
                            return null
                        }
                        return new Hover(strategy.family.docs)
                    },
                }),

                // Show preview on hover
                languages.registerHoverProvider(langId, {
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
    }

    static async insertText(editor: TextEditor, keyIn: string) {
        const { document } = editor
        const tok = LanguageInfoService.get(document.languageId).openBrackets.tokenize(keyIn).at(0)
        if (!tok || !tok.isOpenBracket()) {
            await insertRawText()
            return
        }
        const docInfo = DocumentInfoService.get(document)
        let offset = document.offsetAt(editor.selection.active)
        const nearestScope = docInfo.selectScopes(offset).at(-1)
        if (!nearestScope) {
            await insertRawText()
            return
        }
        const { tokens } = docInfo
        const scopeTokens: Token[] = []
        let idx = Token.findNearest(tokens, offset, 'right')
        if (idx === -1) {
            await insertRawText()
            return
        }
        while (idx < tokens.length && offset < nearestScope.end) {
            scopeTokens.push(tokens[idx])
            offset += tokens[idx].length
            idx += 1
        }
        if (tok.findCloseBracket(scopeTokens)) {
            await insertRawText()
            return
        }
        await editor.edit(editBuilder => {
            editBuilder.insert(
                editor.selection.active,
                keyIn + document.getText(editor.selection) + CLOSE_BRACKETS[keyIn[0]],
            )
        })
        const pos = editor.selection.active.translate(0, -1)
        editor.selection = new Selection(pos, pos)

        async function insertRawText() {
            await editor.edit(editBuilder => {
                editBuilder.insert(editor.selection.active, keyIn)
            })
        }
    }

    /**
     * Tests every completion resolver for the completion family of the current language.
     * If a `Completion` is returned, it is stored in a `CompletionStrategy` and recorded.
     *
     * This function is guaranteed to never throw an exception so that in the case that
     * one is thrown, the user is not prevented from editing the docuoment.
     *
     * Returns true if the strategy was updated, or false if no completion was resolved or
     * an exception was thrown at any point.
     */
    static updateStrategy(editor: TextEditor, keyIn: string): boolean {
        try {
            const { document } = editor
            const active = editor.selection.active
            const cursor = new Position(active.line, active.character + 1) // adjust for key-in
            const ctx = CompletionContext.newInstance(
                document,
                keyIn,
                cursor,
                DocumentInfoService.get(document),
            )
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
