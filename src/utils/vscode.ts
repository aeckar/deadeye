import { Position, TextEditorEdit, TextDocument, Range, Selection, TextEditor } from 'vscode'

export function insert(pos: Position, text: string): (editBuilder: TextEditorEdit) => void {
    return editBuilder => {
        editBuilder.insert(pos, text)
    }
}

/**
 * Translates offsets to `vscode` data structures over text documents.
 *
 * Resolving line-character positions from indices incurs a small
 * performance hit--**use this class with caution**.
 */
export class DocumentContext {
    private constructor(private readonly document: TextDocument) {}

    static newInstance(document: TextDocument): DocumentContext {
        return new this(document)
    }

    /** Returns the `Position.line` number for the position at the given offset. */
    line(offset: number): number {
        return this.pos(offset).line
    }

    /** Returns the absolute `Position` for the given offset */
    pos(offset: number): Position {
        return this.document.positionAt(offset)
    }

    /** Returns the absolute `Range` for the given offsets. */
    range(begin: number, end: number): Range {
        return new Range(this.pos(begin), this.pos(end))
    }

    /** Returns the absolute `Selection` for the given offsets. */
    selection(begin: number, end: number = begin): Selection {
        if (begin === end) {
            const pos = this.pos(begin) // resolve once
            return new Selection(pos, pos)
        }
        return new Selection(this.pos(begin), this.pos(end))
    }

    /**
     * Performs the text insertion by converting the given offset to an absolute `Position`.
     *
     * Returns true if the operation succeeded.
     */
    async insert(offset: number, text: string, editor: TextEditor): Promise<boolean> {
        return editor.edit(editBuilder => {
            editBuilder.insert(this.pos(offset), text)
        })
    }

    /**
     * Performs the text insertion by converting the given offsets to an absolute `Selection`.
     *
     * Returns true if the operation succeeded.
     */
    async delete(begin: number, end: number, editor: TextEditor): Promise<boolean> {
        return editor.edit(editBuilder => {
            editBuilder.delete(this.selection(begin, end))
        })
    }
}

/**
 * Returns the range before the cursor on the same line
 * containing `cursor.character` characters.
 *
 * For a larger `from` value, the range grows left from the cursor.
 * Omitting `from` gives the entire line before the cursor,
 * and passing zero gives a zero-length selection at the cursor.
 */
export function rangeBefore(cursor: Position, from: number = cursor.character): Range {
    if (from < 0) {
        // handle to prevent silent failure
        throw new RangeError(`'from' must be non-negative, got ${from}`)
    }
    if (from > cursor.character) {
        throw new RangeError(
            `'from' (${from}) exceeds cursor character position (${cursor.character})`,
        )
    }
    return new Range(
        new Position(cursor.line, cursor.character - from),
        new Position(cursor.line, cursor.character),
    )
}

/**
 * Returns the position on the same line directly after the cursor,
 * with the given number of characters skipped also.
 */
export function after(cursor: Position, skip: number = 0): Position {
    return new Position(cursor.line, cursor.character + skip + 1)
}
