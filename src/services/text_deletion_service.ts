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
        // fixme doesnt work at whitespace
        const begin = tokens.findIndex(e => e.includes(selectionBegin + 1))
        let foundOverlap = false
        for (let idx = begin; idx < tokens.length; ++idx) {
            const token = tokens[idx]
            const overlaps = token.begin < selectionEnd && token.end > selectionBegin
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
        const rel = DocumentContext.newInstance(document)
        await rel.delete(minBegin, maxEnd, editor)
    }

    static async applySmartCaretDelete(editor: TextEditor, direction: Direction) {
        const { document, selection } = editor
        const cursor = document.offsetAt(selection.active)
        const rel = DocumentContext.newInstance(document)
        const { tokens, text } = DocumentInfoService.get(document)
        let idx = Token.findNearest(tokens, cursor, direction)
        if (idx === -1) {
            // no tokens; delete all whitespace
            await rel.delete(0, text.length, editor)
            return
        }
        let token = tokens[idx]
        if (direction === 'left') {
            if (cursor === token.begin && idx !== 0) {
                // cursor directly before token; backspace should target previous token
                idx -= 1
                token = tokens[idx]
            }
        } else if (token.end < cursor) {
            // no tokens right of cursor; delete trailing whitespace
            const tape = Tape.over(text, cursor)
            tape.putBack(ch => ch === '\n' || ch === '\r' || Tape.isWs(ch))
            await rel.delete(tape.pos + 1, text.length, editor)
            return
        }
        if (direction === 'left' && token.begin > cursor) {
            // no tokens left of cursor; delete leading whitespace
            const tape = Tape.over(text, cursor)
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
            const tape = Tape.over(text, cursor)
            const ws = tape.consumeWs().length
            if (tape.isAtLineSep()) {
                // no tokens right of cursor in current line; delete trailing whitespace
                await rel.delete(token.begin, cursor + ws, editor)
            } else {
                await rel.delete(token.begin, cursor, editor)
            }
        } else {
            //todo create snippets on the fly!

            //todo fix indentation delete
            //todo if last in line is OPEN_ (or COLON and langId == 'python'),
            //todo  then find next non blank line, extract indent, then delete such
            //todo  that the current line is now 1 indent less than that
            const tape = Tape.over(text, token.end)
            const ws = tape.consumeWs().length
            if (tape.isAtLineSep()) {
                // deleting token leaves cursor at end of line; strip leading whitespace
                await rel.delete(cursor, token.end + ws, editor)
            } else {
                await rel.delete(cursor, token.end, editor)
            }
        }
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
