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

class TokenTreeDataProvider implements TreeDataProvider<TokenTreeItem> {
    private _onDidChangeTreeData = new EventEmitter<void>()
    private items: TokenTreeItem[] = []
    treeView?: TreeView<TokenTreeItem>

    // override
    readonly onDidChangeTreeData: Event<void> = this._onDidChangeTreeData.event

    // override
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
            this.items = this.buildItemTree()
        }
        return this.items
    }

    refresh() {
        this.items = []
        this._onDidChangeTreeData.fire()
    }

    revealActiveItem(editor: TextEditor) {
        if (!this.treeView) return
        if (editor.document !== window.activeTextEditor?.document) return

        const offset = editor.document.offsetAt(editor.selection.active)
        const item = this.findItemAt(offset)
        if (item) {
            this.treeView.reveal(item, { select: true, focus: false })
        }
    }

    private buildItemTree(): TokenTreeItem[] {
        const document = window.activeTextEditor?.document
        if (!document) {
            return []
        }
        const docInfo = DocumentInfoService.get(document)
        return docInfo.tokens.map(e => new TokenTreeItem(e, docInfo))
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

export class TokenExplorerService {
    private static isActive = false
    private static treeDataProvider = new TokenTreeDataProvider()

    private constructor() {}

    static async start(ctx: ExtensionContext) {
        if (this.isActive) {
            return
        }
        await DocumentInfoService.start(ctx)
        const treeView = window.createTreeView('tokenExplorer', {
            treeDataProvider: this.treeDataProvider,
        })
        this.treeDataProvider.treeView = treeView

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
                    this.treeDataProvider.refresh()
                }
            }),

            // Refresh on editor change
            window.onDidChangeActiveTextEditor(() =>
                this.treeDataProvider.refresh(),
            ),

            // Follow the cursor: select the active token
            window.onDidChangeTextEditorSelection(event =>
                this.treeDataProvider.revealActiveItem(event.textEditor),
            ),
        )
    }
}

export default TokenExplorerService
