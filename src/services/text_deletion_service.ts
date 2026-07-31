import { Token } from '@/api/language_api'
import Tape from '@/tape'
import { Direction } from '@/utils/strings'
import { DocumentContext } from '@/utils/vscode'
import { commands, ExtensionContext, TextEditor } from 'vscode'
import DocumentInfoService from './document_info_service'

/**
 * # Implementation
 *
 * When performing smart deletions, it is important to strip away as much known redundant
 * data as possible. For example, if redundant whitespace is found while scanning,
 * it should be discarded even if it does not affect the position of the cursor.
 * This gives peace of mind to the client so they can place their cursor where they
 * expect it to go.
 */
class TextDeletionService {
    private static isActive = false
    private constructor() {}

    static async start(ctx: ExtensionContext) {
        if (this.isActive) {
            return
        }
        await DocumentInfoService.start(ctx)
        ctx.subscriptions.push(
            // Smart backspace key
            commands.registerTextEditorCommand('deleteLeft', editor => {
                this.applySmartDelete(editor, 'left')
            }),

            // Smart delete key
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
        let foundOverlap = false
        const begin = Token.findNearest(tokens, selectionBegin, 'right')
        const rel = DocumentContext.newInstance(document)
        if (begin === -1) {
            await rel.delete(minBegin, maxEnd, editor)
            return
        }
        for (let idx = begin; idx < tokens.length; ++idx) {
            const tok = tokens[idx]
            const overlaps = tok.begin < selectionEnd && tok.end > selectionBegin
            if (overlaps) {
                foundOverlap = true
                if (!Token.isEditable(tok.kind)) {
                    if (tok.begin < minBegin) {
                        minBegin = tok.begin
                    }
                    if (tok.end > maxEnd) {
                        maxEnd = tok.end
                    }
                } else {
                    // cut through identifier
                    if (tok.begin < minBegin) {
                        minBegin = selectionBegin
                    }
                    if (tok.end > maxEnd) {
                        maxEnd = selectionEnd
                    }
                }
            } else if (foundOverlap) {
                break
            }
        }
        await rel.delete(minBegin, maxEnd, editor)
    }

    static async applySmartCaretDelete(editor: TextEditor, direction: Direction) {
        const { document, selection } = editor
        const offset = document.offsetAt(selection.active)
        const rel = DocumentContext.newInstance(document)
        const { tokens, text } = DocumentInfoService.get(document)
        let idx = Token.findNearest(tokens, offset, direction)
        if (idx === -1) {
            // no tokens; delete all whitespace
            await rel.delete(0, text.length, editor)
            return
        }
        let token = tokens[idx]
        if (direction === 'left') {
            if (offset === token.begin && idx !== 0) {
                // cursor directly before token; backspace should target previous token
                idx -= 1
                token = tokens[idx]
            }
        } else if (token.end < offset) {
            // no tokens right of cursor; delete trailing whitespace
            const tape = Tape.over(text, offset)
            tape.putBack(ch => ch === '\n' || ch === '\r' || Tape.isWs(ch))
            await rel.delete(tape.pos + 1, text.length, editor)
            return
        }
        if (direction === 'left' && token.begin > offset) {
            // no tokens left of cursor; delete leading whitespace
            const tape = Tape.over(text, offset)
            tape.consume(ch => ch === '\n' || ch === '\r' || Tape.isWs(ch))
            await rel.delete(0, tape.pos, editor)
            return
        }
        if (Token.isEditable(token.kind)) {
            this.applyCaretDelete(editor, direction)
            return
        }
        // between tokens; perform deletion between lines also
        if (direction === 'left') {
            // preserve leading whitespace for indentation
            if (token.isOpenBracket()) {
                const close = token.findCloseBracket(tokens, idx + 1)
                if (close) {
                    await rel.delete(token.begin, close.end, editor)
                    return
                }
            }
            if (token.isCloseBracket()) {
                const open = token.findOpenBracket(tokens, idx - 1)
                if (open) {
                    await rel.delete(open.begin, offset, editor)
                    return
                }
            }
            const tape = Tape.over(text, offset)
            const ws = tape.consumeWs().length
            if (tape.isAtLineSep()) {
                // no tokens right of cursor in current line; delete trailing whitespace
                await rel.delete(token.begin, offset + ws, editor)
                return
            }
            await rel.delete(token.begin, offset, editor)
            return
        }
        if (token.isOpenBracket()) {
            const close = token.findCloseBracket(tokens, idx + 1)
            if (close) {
                await rel.delete(offset, close.end, editor)
                return
            }
        }
        if (token.isCloseBracket()) {
            const open = token.findOpenBracket(tokens, idx - 1)
            if (open) {
                await rel.delete(open.begin, token.end, editor)
                return
            }
        }
        const tape = Tape.over(text, token.end)
        const ws = tape.consumeWs().length
        if (tape.isAtLineSep()) {
            // deleting token leaves cursor at end of line; strip leading whitespace
            await rel.delete(offset, token.end + ws, editor)
            return
        }
        await rel.delete(offset, token.end, editor)
    }

    /**
     * Since we have overriden the default `deleteLeft` and `deleteRight`
     * commands, we must re-implement deleting a single character.
     */
    static applyCaretDelete(editor: TextEditor, direction: Direction) {
        const { document, selection } = editor
        const cursor = document.offsetAt(selection.active)
        const rel = DocumentContext.newInstance(document)
        if (direction === 'left') {
            rel.delete(cursor - 1, cursor, editor)
        } else {
            rel.delete(cursor, cursor + 1, editor)
        }
    }
}

export default TextDeletionService
