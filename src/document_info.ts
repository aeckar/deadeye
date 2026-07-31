import { Language, Token } from '@/api/language_api'
import { ScopeRegistry } from '@/api/scope_api'
import Scope from '@/scope'
import Tape from '@/tape'
import { TextDocument, TextDocumentContentChangeEvent } from 'vscode'
import { IntervalTree } from './services/interval_tree_service'

export type AsiResolver = (tokens: Token[]) => void

/** Contains a cache of useful information for a given text document. */
class DocumentInfo<ScopeKind extends string> {
    private _tokens?: Token[]
    private _scopes?: IntervalTree<Scope<ScopeKind>>
    private _text?: string
    private _version: number

    private constructor(
        readonly document: TextDocument,
        readonly language: Language,
        readonly scopeRegistry: ScopeRegistry<ScopeKind>,
        private readonly asi: AsiResolver | undefined,
    ) {
        this._version = document.version
    }

    static newInstance<ScopeKind extends string>(
        document: TextDocument,
        language: Language,
        scopeRegistry: ScopeRegistry<ScopeKind>,
        asi: AsiResolver | undefined,
    ): DocumentInfo<ScopeKind> {
        return new this<ScopeKind>(document, language, scopeRegistry, asi)
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

    /** Returns an array of every token in this file. */
    get tokens(): readonly Token[] {
        if (!this._tokens) {
            this._tokens = this.language.tokenize(this.text)
            if (this.asi) {
                this.asi(this._tokens)
            }
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
        const tokens = this._tokens! // stale
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

    /** Returns an array of scopes at this offset, sorted by their begin index. */
    selectScopes(offset: number): Scope<ScopeKind>[] {
        return this.scopes.search([offset, offset + 1]).sort((a, b) => a.begin - b.begin)
    }
}

export default DocumentInfo
