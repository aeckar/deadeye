import { Language, Token } from '@/api/language_api'
import { ScopeRegistry } from '@/api/scope_api'
import Scope from '@/scope'
import Tape from '@/tape'
import { ExtensionContext, TextDocument, TextDocumentContentChangeEvent, workspace } from 'vscode'
import IntervalTreeService, { IntervalTree, itemsAt } from './interval_tree_service'
import LanguageInfoService from './language_info_service'

/** Contains a cache of useful information for a given text document. */
export class DocumentInfo<ScopeKind extends string> {
    private _tokens?: Token[]
    private _scopes?: IntervalTree<Scope<ScopeKind>>
    private _text?: string
    private _version: number

    constructor(
        readonly document: TextDocument,
        readonly language: Language,
        readonly scopeRegistry: ScopeRegistry<ScopeKind>,
    ) {
        this._version = document.version
    }

    /** The exact version of the content buffer, including undo/redo. */
    get version(): number {
        return this._version
    }

    /** Returns the entire source code as a string */
    get text(): string {
        if (!this._text) {
            this._text = this.document.getText()
        }
        return this._text!
    }

    /** To easily get the head token, use `this.tokens[0][0]`. */
    get tokens(): Token[] {
        if (!this._tokens) {
            this._tokens = this.language.tokenize(this.text)
        }
        return this._tokens!
    }

    /** Returns an interval tree of every found scope in this file. */
    get scopes(): IntervalTree<Scope<ScopeKind>> {
        if (!this._scopes) {
            this._scopes = this.scopeRegistry.extractScopes(this.tokens)
        }
        return this._scopes!
    }

    registerChanges(changes: readonly TextDocumentContentChangeEvent[]) {
        this._text = undefined
        this._scopes = undefined
        this._version = this.document.version
        const text = this.text // rehydrated
        let minEditStart = text.length
        for (const change of changes) {
            if (change.rangeOffset < minEditStart) {
                minEditStart = change.rangeOffset
            }
        }
        let resumeIdx = 0
        let resumeOffset = 0
        const tokens = this.tokens // stale
        for (let idx = 0; idx < tokens.length; ++idx) {
            if (tokens[idx].end >= minEditStart) {
                resumeIdx = idx
                if (idx > 0) {
                    resumeOffset = tokens[idx - 1].end
                }
                break
            }
        }
        tokens.length = resumeIdx
        const lang = this.language
        lang.tokenize(Tape.over(text, resumeOffset, lang.idRule), tokens)
    }

    getScopeBreadcrumbs(offset: number): string[] {
        const activeScopes = itemsAt(this.scopes, offset)
        activeScopes.sort((a, b) => a.begin - b.begin)
        return activeScopes.map(scope => scope.kind)
    }
}

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
            const { language, scopes } = LanguageInfoService.get(document.languageId)
            const file = new DocumentInfo(document, language, scopes)
            this.files.set(uri, file)
            return file as DocumentInfo<ScopeKind>
        }
        return this.files.get(uri)! as DocumentInfo<ScopeKind>
    }
}

export default DocumentInfoService
