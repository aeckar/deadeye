import DocumentInfo from '@/document_info'
import IntervalTreeService from '@/services/interval_tree_service'
import LanguageInfoService from '@/services/language_info_service'
import { ExtensionContext, TextDocument, workspace } from 'vscode'

class DocumentInfoService {
    private static isActive = false
    private static files = new Map<string, DocumentInfo<string>>()

    private constructor() {}

    static async start(ctx: ExtensionContext) {
        if (this.isActive) {
            return
        }
        this.isActive = true
        await IntervalTreeService.start()
        await LanguageInfoService.start()
        ctx.subscriptions.push(
            // Listen for text buffer edits
            workspace.onDidChangeTextDocument(event => {
                const document = event.document
                if (event.contentChanges.length === 0 || document.uri.scheme !== 'file') {
                    return
                }
                this.get(document)?.registerChanges(event.contentChanges)
            }),

            // Clear cache when a file is closed to free up memory
            workspace.onDidCloseTextDocument(document => {
                this.files.delete(document.uri.toString())
            }),
        )
    }

    /**
     * Retrieves the token stream for a specific file.
     * Tokenizes the file if not done so yet.
     *
     * It is the responsibility of the caller to ensure the correct type for `ScopeKind`.
     *
     * Returns `undefined` if the language of the active document is unsupported.
     */
    static get<ScopeKind extends string>(
        document: TextDocument,
    ): DocumentInfo<ScopeKind> | undefined {
        const uri = document.uri.toString()
        if (!this.files.has(uri)) {
            const langInfo = LanguageInfoService.get<ScopeKind>(document.languageId)
            if (!langInfo) {
                return undefined
            }
            const file = DocumentInfo.newInstance<ScopeKind>(document, langInfo)
            this.files.set(uri, file as unknown as DocumentInfo<string>)
            return file
        }
        return this.files.get(uri)! as unknown as DocumentInfo<ScopeKind>
    }
}

export default DocumentInfoService
