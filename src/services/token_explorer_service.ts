import {
    Event,
    EventEmitter,
    ExtensionContext,
    ProviderResult,
    Range,
    Selection,
    TextEditor,
    TreeDataProvider,
    TreeItem,
    TreeItemCollapsibleState,
    TreeView,
    commands,
    window,
    workspace,
} from 'vscode'
import { Token } from '../languages'
import { DocumentContext } from '../misc'
import DocumentInfoService, { DocumentInfo } from './document_info_service'

/**
 * # Implementation
 *
 * Tree items should not have symbol icons, since they may be ambiguous
 * when shown next to matched lexemes.
 */
class TokenTreeItem extends TreeItem {
    constructor(
        readonly token: Token,
        docInfo: DocumentInfo<string>,
    ) {
        const slice = docInfo.text.slice(token.begin, token.end)
        super(slice, TreeItemCollapsibleState.None)
        this.description = token.kind
        this.tooltip = token.toString() // complete information
        this.command = {
            command: 'deadeye.tokenExplorer.jumpTo',
            title: 'Jump to token',
            arguments: [token],
        }
    }
}

export class TokenExplorerService implements TreeDataProvider<TokenTreeItem> {
    /** Singleton must be reduced to a variable to be able to implement interface. */
    private static instance = new TokenExplorerService()

    private _onDidChangeTreeData = new EventEmitter<void>()
    readonly onDidChangeTreeData: Event<void> = this._onDidChangeTreeData.event

    /** Cached so `reveal` can be called against the same object references handed to the tree. */
    private items: TokenTreeItem[] = []
    private treeView?: TreeView<TokenTreeItem>

    private constructor() {}

    static start(ctx: ExtensionContext) {
        const treeView = window.createTreeView('tokenListView', {
            treeDataProvider: this.instance,
        })
        this.instance.treeView = treeView

        ctx.subscriptions.push(
            treeView,

            // Jump to token in active document
            commands.registerCommand(
                'deadeye.tokenExplorer.jumpTo',
                (token: Token) => {
                    const editor = window.activeTextEditor
                    if (!editor) {
                        return
                    }
                    const rel = new DocumentContext(editor.document)
                    const begin = rel.pos(token.begin)
                    const end = rel.pos(token.end)
                    editor.selection = new Selection(begin, end)
                    editor.revealRange(new Range(begin, end))
                },
            ),

            // Refresh on edits in active document
            workspace.onDidChangeTextDocument(event => {
                if (event.document === window.activeTextEditor?.document) {
                    this.instance.refresh()
                }
            }),

            // Refresh on editor change
            window.onDidChangeActiveTextEditor(() => this.instance.refresh()),

            // Follow the cursor: select the active token
            window.onDidChangeTextEditorSelection(event =>
                this.instance.revealActiveItem(event.textEditor),
            ),
        )
    }

    private refresh() {
        this.items = []
        this._onDidChangeTreeData.fire()
    }

    getParent(_: TokenTreeItem): ProviderResult<TokenTreeItem> {
        
        return undefined
    }

    // override
    getTreeItem(element: TokenTreeItem): TreeItem {
        return element
    }

    // override
    getChildren(): TokenTreeItem[] {
        if (this.items.length === 0) {
            this.items = this.buildItemsForActiveDocument()
        }
        return this.items
    }

    private buildItemsForActiveDocument(): TokenTreeItem[] {
        const document = window.activeTextEditor?.document
        if (!document) {
            return []
        }
        const docInfo = DocumentInfoService.get(document)
        return docInfo.tokens.map(e => new TokenTreeItem(e, docInfo))
    }

    private revealActiveItem(editor: TextEditor) {
        if (!this.treeView) return
        if (editor.document !== window.activeTextEditor?.document) return

        const offset = editor.document.offsetAt(editor.selection.active)
        const item = this.findItemAt(offset)
        if (item) {
            this.treeView.reveal(item, { select: true, focus: false })
        }
    }

    /** Tokens are non-overlapping and sorted by `begin`, so binary search is safe. */
    private findItemAt(offset: number): TokenTreeItem | undefined {
        let lo = 0
        let hi = this.items.length - 1
        while (lo <= hi) {
            const mid = (lo + hi) >> 1
            const token = this.items[mid].token
            if (offset < token.begin) {
                hi = mid - 1
            } else if (offset >= token.end) {
                lo = mid + 1
            } else {
                return this.items[mid]
            }
        }
        return undefined
    }
}

export default TokenExplorerService
