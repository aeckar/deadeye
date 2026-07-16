import {
    ExtensionContext,
    TextDocument,
    TextDocumentContentChangeEvent,
    workspace,
} from 'vscode'
import { IntervalTree } from './interval_tree'
import allLanguages from './lang/all_languages'
import allScopeRegistries from './lang/all_scope_registries'
import { Language, Token } from './languages'
import { extractScopes, ScopeRegistry } from './scopes'
import { Scope } from './scopes_base'
import Tape from './tape'

/** Contains a cache of useful information for a given text document. */
export class DocumentInfo<ScopeKind extends string> {
    private _tokens?: Token[]
    private _scopes?: IntervalTree<Scope<ScopeKind>>
    private _text?: string

    constructor(
        readonly document: TextDocument,
        readonly language: Language,
        readonly scopeRegistry: ScopeRegistry<ScopeKind>,
    ) {}
    
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
            this._scopes = extractScopes(this.tokens, this.scopeRegistry)
        }
        return this._scopes!
    }

    retokenize(changes: readonly TextDocumentContentChangeEvent[]) {
        const text = this.text // resolve
        let minEditStart = text.length
        for (const change of changes) {
            if (change.rangeOffset < minEditStart) {
                minEditStart = change.rangeOffset
            }
        }
        let resumeIdx = 0
        const tokens = this.tokens // resolve
        for (let idx = 0; idx < tokens.length; ++idx) {
            if (tokens[idx].end >= minEditStart) {
                tokens.length = idx
                resumeIdx = idx
                break
            }
        }
        const lang = this.language
        lang.tokenize(Tape.over(text, resumeIdx, lang.idRule), tokens)
    }
}

export class DocumentService {
    private static files = new Map<string, DocumentInfo<string>>()

    private constructor() {}

    static start(ctx: ExtensionContext) {
        // Listen for text buffer edits
        ctx.subscriptions.push(
            workspace.onDidChangeTextDocument(event => {
                const document = event.document
                if (
                    event.contentChanges.length === 0 ||
                    document.uri.scheme !== 'file'
                ) {
                    return
                }
                this.get(document).retokenize(event.contentChanges)
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
     *
     * It is the responsibility of the caller to ensure the correct type for `ScopeKind`.
     */
    static get<ScopeKind extends string>(
        document: TextDocument,
    ): DocumentInfo<ScopeKind> {
        const uri = document.uri.toString()
        if (!this.files.has(uri)) {
            const langId = document.languageId
            const file = new DocumentInfo(
                document,
                allLanguages[langId],
                allScopeRegistries[langId],
            )
            this.files.set(uri, file)
            return file as DocumentInfo<ScopeKind>
        }
        return this.files.get(uri)! as DocumentInfo<ScopeKind>
    }
}

export default DocumentService
