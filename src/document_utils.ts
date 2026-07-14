import {
    ExtensionContext,
    TextDocument,
    TextDocumentContentChangeEvent,
    workspace,
} from 'vscode'
import { IntervalTree } from './interval_utils'
import allLanguages from './lang/all_languages'
import allScopeRegistries from './lang/all_scope_registries'
import { Language, Token } from './language_utils'
import { extractScopes, ScopeRegistry } from './scope_registry_utils'
import { Scope } from './scope_utils'

/**
 * Organized every token in array form, organized by line.
 *
 * The size of the returned array is equal to the number of lines in the file.
 * The tokens in each line array are ordered by first appearance.
 *
 * @see {@link DocumentInfo}
 */
export type TokenBuckets = readonly (readonly Token[])[]

/** Contains a cache of useful information for a given text document. */
export class DocumentInfo<ScopeKind extends string> {
    private isTokensDirty = false
    private _head?: Token
    private _tokens?: TokenBuckets
    private _scopes?: IntervalTree<Scope<ScopeKind>>
    private _text?: string

    constructor(
        readonly document: TextDocument,
        readonly language: Language,
        readonly scopeRegistry: ScopeRegistry<ScopeKind>,
    ) {}

    get tokens(): TokenBuckets {
        if (!this.isTokensDirty && this._tokens) {
            return this._tokens
        }
        const tokens: Token[][] = []
        let node = this.head.next
        while (!node.isTail) {
            const lineBegin = this.document.lineAt(node.begin).lineNumber
            const lineEnd = this.document.lineAt(node.end).lineNumber
            for (let line = lineBegin; line < lineEnd; ++line) {
                tokens[line].push(node)
            }
            node = node.next
        }
        this._tokens = tokens
        return this._tokens
    }

    /** Returns an interval tree of every found scope in this file. */
    get scopes(): IntervalTree<Scope<ScopeKind>> {
        if (!this._scopes) {
            this._scopes = extractScopes(this.tokens[0][0], this.scopeRegistry)
        }
        return this._scopes!
    }

    /** Returns the entire source code as a string */
    get text(): string {
        if (!this._text) {
            this._text = this.document.getText()
        }
        return this._text!
    }

    private get head(): Token {
        if (!this._head) {
            this._head = this.language.tokenize(this.text)
        }
        return this._head!
    }

    registerChanges(changes: readonly TextDocumentContentChangeEvent[]) {
        let minEditStart = this.text.length
        for (const change of changes) {
            if (change.rangeOffset < minEditStart) {
                minEditStart = change.rangeOffset
            }
        }
        let resumeIdx = 0
        let node = this.head
        while (!node.isTail) {
            if (node.end >= minEditStart) {
                node = node.prev
                node.deleteRest()
                resumeIdx = node.end
                break
            }
            node = node.next
        }
        node.appendAll(this.language.tokenize(this.text.slice(resumeIdx)))
        this.isTokensDirty = true
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
                this.get(document).registerChanges(event.contentChanges)
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
