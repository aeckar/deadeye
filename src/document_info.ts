import { Language, Token } from '@/api/language_api'
import { ScopeRegistry } from '@/api/scope_api'
import { logger } from '@/logger'
import Scope from '@/scope'
import { IntervalTree } from '@/services/interval_tree_service'
import Tape from '@/tape'
import { DocumentContext } from '@/utils/vscode'
import { LogLevel, TextDocument, TextDocumentContentChangeEvent } from 'vscode'
import LanguageInfo from '@/language_info'

export type AsiResolver = (tokens: Token[]) => void

/** Contains a cache of useful information for a given text document. */
class DocumentInfo<ScopeKind extends string> {
    private _tokens?: Token[]
    private _scopes?: IntervalTree<Scope<ScopeKind>>
    private _text?: string
    private _version: number

    /** Persistent document context object, cached to reduce garbage collection. */
    readonly context: DocumentContext

    private constructor(
        readonly document: TextDocument,
        readonly langInfo: LanguageInfo<ScopeKind>,
    ) {
        this._version = document.version
        this.context = DocumentContext.newInstance(document)
    }

    static newInstance<ScopeKind extends string>(
        document: TextDocument,
        langInfo: LanguageInfo<ScopeKind>,
    ): DocumentInfo<ScopeKind> {
        return new this<ScopeKind>(document, langInfo)
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
            const text = this.text // rehydrated
            const start = performance.now()
            const { language, asi } = this.langInfo
            this._tokens = language.tokenize(text)
            const t = (performance.now() - start).toFixed(2)
            if (logger.logLevel === LogLevel.Info) {
                logger.info(
                    `${this.document.fileName}: Parsed ${this._tokens.length} tokens in ${t}ms `,
                )
            }
            if (asi) {
                asi(this._tokens)
            }
        }
        return this._tokens!
    }

    /** Returns an interval tree of every found scope in this file. */
    get scopes(): IntervalTree<Scope<ScopeKind>> {
        if (!this._scopes) {
            const tokens = this.tokens // rehydrated
            const start = performance.now()
            this._scopes = this.langInfo.scopes.extractScopes(tokens)
            const t = (performance.now() - start).toFixed(2)
            if (logger.logLevel === LogLevel.Info) {
                logger.info(
                    `${this.document.fileName}: Parsed ${this._scopes.items.length} scopes in ${t}ms `,
                )
            }
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
        const lang = this.langInfo.language
        const start = performance.now()
        lang.tokenize(Tape.over(text, resumeOffset, lang.idRule), tokens)
        const t = (performance.now() - start).toFixed(2)
        if (logger.logLevel === LogLevel.Info) {
            logger.info(
                `${this.document.fileName}: Parsed ${tokens.length - resumeIdx} tokens in ${t}ms `,
            )
        }
    }

    /** Returns an array of scopes at this offset, sorted by their begin index. */
    selectScopes(offset: number): Scope<ScopeKind>[] {
        return this.scopes.search([offset, offset + 1]).sort((a, b) => a.begin - b.begin)
    }
}

export default DocumentInfo
