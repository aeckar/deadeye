import {
    ExtensionContext,
    TextDocument,
    TextDocumentChangeEvent,
    workspace,
} from 'vscode'
import languagesById from './lang/languages'
import { Language, Token } from './language_utils'

class OpenFile {
    private needs

    private constructor(
        readonly lang: Language,
        readonly head: Token,
        private readonly tokensByLine?: readonly (readonly Token[])[],
    ) {}

    static newInstance(lang: Language, head: Token, document: TextDocument): OpenFile {
        const file = new OpenFile(lang, head)
        return file
    }

    
}

export class OpenFileManager {
    private files = new Map<string, OpenFile>()

    constructor(ctx: ExtensionContext) {
        // Listen for text buffer edits
        ctx.subscriptions.push(
            workspace.onDidChangeTextDocument(event => {
                this.tokenizeDocument(event)
            }),
        )

        // Clear cache when a file is closed to free up memory
        ctx.subscriptions.push(
            workspace.onDidCloseTextDocument(document => {
                this.files.delete(document.uri.toString())
            }),
        )
    }

    /**
     * Retrieves the token stream for a specific file.
     * Tokenizes the file if not done so yet.
     */
    get(document: TextDocument): OpenFile {
        const uri = document.uri.toString()
        if (!this.files.has(uri)) {
            // initial full tokenization on first access
            const lang = languagesById[document.languageId]
            const head = lang.tokenize(document.getText())
            const stream = OpenFile.newInstance(lang, head, document)
            this.files.set(uri, stream)
            return stream
        }
        return this.files.get(uri)!
    }

    private tokenizeDocument(event: TextDocumentChangeEvent) {
        if (event.contentChanges.length === 0) {
            // no content changes (e.g. metadata save events)
            return
        }
        const document = event.document
        if (document.uri.scheme !== 'file') {
            // skip non-code files or output panels
            return
        }
        if (!this.files.has(document.uri.toString())) {
            this.get(document)
            return
        }
        const file = this.get(document)
        const text = document.getText()
        let minEditStart = text.length
        for (const change of event.contentChanges) {
            if (change.rangeOffset < minEditStart) {
                minEditStart = change.rangeOffset
            }
        }
        let resumeIdx = 0
        let node = file.head
        while (!node.isTail) {
            if (node.end >= minEditStart) {
                node = node.prev
                node.deleteRest()
                resumeIdx = node.end
                break
            }
            node = node.next
        }
        node.appendAll(file.lang.tokenize(text.slice(resumeIdx)))
    }
}
