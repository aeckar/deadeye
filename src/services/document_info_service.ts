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
        await IntervalTreeService.start()
        await LanguageInfoService.start()
        ctx.subscriptions.push(
            // Listen for text buffer edits
            workspace.onDidChangeTextDocument(event => {
                const document = event.document
                if (event.contentChanges.length === 0 || document.uri.scheme !== 'file') {
                    return
                }
                this.get(document).registerChanges(event.contentChanges)
            }),

            // Clear cache when a file is closed to free up memory
            workspace.onDidCloseTextDocument(document => {
                this.files.delete(document.uri.toString())
            }),
        )
        this.isActive = true
    }

    /**
     * Retrieves the token stream for a specific file.
     * Tokenizes the file if not done so yet.
     *
     * It is the responsibility of the caller to ensure the correct type for `ScopeKind`.
     */
    static get<ScopeKind extends string>(document: TextDocument): DocumentInfo<ScopeKind> {
        const uri = document.uri.toString()
        if (!this.files.has(uri)) {
            const { language, scopes, asi } = LanguageInfoService.get(document.languageId)
            const file = DocumentInfo.newInstance(document, language, scopes, asi)
            this.files.set(uri, file)
            return file as DocumentInfo<ScopeKind>
        }
        return this.files.get(uri)! as DocumentInfo<ScopeKind>
    }
}

export default DocumentInfoService
