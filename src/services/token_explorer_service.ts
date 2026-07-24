import {
    Event,
    EventEmitter,
    ExtensionContext,
    Range,
    Selection,
    TreeDataProvider,
    TreeItem,
    TreeItemCollapsibleState,
    commands,
    window,
    workspace,
} from 'vscode'
import DocumentInfoService, { DocumentInfo } from './document_info_service'
import { Token } from '../languages'
import { DocumentContext } from '../misc'

/**
 * Previous versions supported icons for tree items.
 * This became confusing, especially for sigil tokens, so this feature was scrapped.
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

    private constructor() {}

    static start(ctx: ExtensionContext) {
        const subscribe = ctx.subscriptions.push

        // Derive tree data from singleton instance
        subscribe(
            window.registerTreeDataProvider('tokenListView', this.instance),
        )

        // Jump to token in active document
        subscribe(
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
        )

        // Refresh on edits in active document
        subscribe(
            workspace.onDidChangeTextDocument(event => {
                if (event.document === window.activeTextEditor?.document) {
                    this.instance.refresh()
                }
            }),
        )

        // Refresh on editor change
        subscribe(
            window.onDidChangeActiveTextEditor(() => this.instance.refresh()),
        )

        // Follow the cursor: Select the active token
        subscribe()
    }

    private refresh() {
        this._onDidChangeTreeData.fire()
    }

    // override
    getTreeItem(element: TokenTreeItem): TreeItem {
        return element
    }

    // override
    getChildren(): TokenTreeItem[] {
        const document = window.activeTextEditor?.document
        if (!document) {
            return []
        }
        const docInfo = DocumentInfoService.get(document)
        return docInfo.tokens.map(e => new TokenTreeItem(e, docInfo))
    }
}

export default TokenExplorerService
