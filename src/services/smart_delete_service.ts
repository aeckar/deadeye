import {
    commands,
    ExtensionContext,
    Position,
    Range,
    Selection,
    TextEditor,
} from 'vscode'
import { Token } from '../languages'
import { Direction } from '../misc'
import DocumentInfoService from './document_info_service'

class SmartDeleteService {
    static start(ctx: ExtensionContext) {
        // Smart backspace key
        ctx.subscriptions.push(
            commands.registerTextEditorCommand('deleteLeft', editor => {
                this.applySmartDelete(editor, 'left')
            }),
        )

        // Smart delete key
        ctx.subscriptions.push(
            commands.registerTextEditorCommand('deleteRight', editor => {
                this.applySmartDelete(editor, 'right')
            }),
        )
    }

    static async applySmartDelete(editor: TextEditor, direction: Direction) {
        if (!editor.selection.isEmpty) {
            this.applySmartSelectionDelete(editor)
            return
        }
        this.applySmartCaretDelete(editor, direction)
    }

    static async applySmartSelectionDelete(editor: TextEditor) {
        const { document, selection } = editor
        const { tokens } = DocumentInfoService.get(document)
        const selectionBegin = document.offsetAt(selection.start)
        const selectionEnd = document.offsetAt(selection.end)
        let minBegin = selectionBegin
        let maxEnd = selectionEnd
        const begin = tokens.findIndex(e => e.includes(selectionBegin))
        let foundOverlap = false
        for (let idx = begin; idx < tokens.length; ++idx) {
            const token = tokens[idx]
            const overlaps =
                token.begin < selectionEnd && token.end > selectionBegin
            if (overlaps) {
                foundOverlap = true
                if (token.kind !== 'ID') {
                    if (token.begin < minBegin) {
                        minBegin = token.begin
                    }
                    if (token.end > maxEnd) {
                        maxEnd = token.end
                    }
                } else {
                    // cut through identifier
                    if (token.begin < minBegin) {
                        minBegin = selectionBegin
                    }
                    if (token.end > maxEnd) {
                        maxEnd = selectionEnd
                    }
                }
            } else if (foundOverlap) {
                break
            }
        }
        editor.edit(editBuilder => {
            editBuilder.delete(
                new Range(
                    document.positionAt(minBegin),
                    document.positionAt(maxEnd),
                ),
            )
        })
    }

    static async applySmartCaretDelete(
        editor: TextEditor,
        direction: Direction,
    ) {
        const { document, selection } = editor
        const active = selection.active
        const offset = document.offsetAt(active)
        const { tokens } = DocumentInfoService.get(document)
        const token = tokens[Token.findNearest(tokens, offset, direction)]
        if (token.kind === 'ID') {
            this.applyCharacterDelete(editor, direction)
        }
        const begin = document.positionAt(token.begin)
        const end = document.positionAt(token.end)
        const success = await editor.edit(editBuilder => {
            editBuilder.delete(new Range(begin, end))
        })
        if (success && direction === 'left') {
            editor.selection = new Selection(begin, begin)
        }
    }

    /**
     * Since we have overriden the default `deleteLeft` and `deleteRight`
     * commands, we must re-implement deleting a single character.
     */
    static applyCharacterDelete(editor: TextEditor, direction: Direction) {
        const { document, selection } = editor
        const active = selection.active
        editor.edit(editBuilder => {
            if (direction === 'left') {
                if (active.character > 0) {
                    // delete one character behind the cursor
                    editBuilder.delete(
                        new Range(active.translate(0, -1), active),
                    )
                } else if (active.line > 0) {
                    // line wrap delete: join with previous line
                    const prevLineLength = document.lineAt(active.line - 1).text
                        .length
                    const endOfPrevLine = new Position(
                        active.line - 1,
                        prevLineLength,
                    )
                    editBuilder.delete(new Range(endOfPrevLine, active))
                }
            } else {
                const currentLineLength = document.lineAt(active.line).text
                    .length
                if (active.character < currentLineLength) {
                    // delete one character ahead of the cursor
                    editBuilder.delete(
                        new Range(active, active.translate(0, 1)),
                    )
                } else if (active.line < document.lineCount - 1) {
                    // line wrap delete: join with next line
                    const startOfNextLine = new Position(active.line + 1, 0)
                    editBuilder.delete(new Range(active, startOfNextLine))
                }
            }
        })
    }
}

export default SmartDeleteService
