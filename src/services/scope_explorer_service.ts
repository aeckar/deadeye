import {
    Event,
    EventEmitter,
    ExtensionContext,
    Range,
    Selection,
    TextDocument,
    TextEditor,
    TreeDataProvider,
    TreeItem,
    TreeItemCollapsibleState,
    TreeView,
    commands,
    window,
    workspace,
} from 'vscode'
import { Language } from '../languages'
import { DocumentContext } from '../misc'
import { Scope } from '../scope'
import DocumentInfoService, { DocumentInfo } from './document_info_service'

/**
 * # Implementation
 *
 * Tree items should not have symbol icons, since they may be ambiguous
 * when shown next to matched lexemes.
 */
class ScopeTreeItem extends TreeItem {
    readonly children: ScopeTreeItem[] = []

    private constructor(
        readonly scope: Scope<string>,
        readonly parent: ScopeTreeItem | undefined,
        docInfo: DocumentInfo<string>,
    ) {
        const marker = docInfo.tokens[scope.markerTokenPos]
        const markerSlice = docInfo.text.slice(marker.begin, marker.end)
        super(markerSlice, TreeItemCollapsibleState.None)
        this.description = scope.kind
        this.tooltip = scope.toString() // complete information
        this.command = {
            command: 'deadeye.scopeExplorer.jumpTo',
            title: 'Jump to scope',
            arguments: [scope],
        }
    }

    static newInstance(
        scope: Scope<string>,
        parent: ScopeTreeItem | undefined,
        docInfo: DocumentInfo<string>,
    ): ScopeTreeItem {
        return new this(scope, parent, docInfo)
    }
}

class ScopeTreeDataProvider implements TreeDataProvider<ScopeTreeItem> {
    private _onDidChangeTreeData = new EventEmitter<void>()
    private roots: ScopeTreeItem[] = []
    treeView?: TreeView<ScopeTreeItem>

    // override
    readonly onDidChangeTreeData: Event<void> = this._onDidChangeTreeData.event

    // override
    getParent(element: ScopeTreeItem): ScopeTreeItem | undefined {
        return element.parent
    }

    // override
    getChildren(element?: ScopeTreeItem): ScopeTreeItem[] {
        if (element) {
            return element.children
        }
        if (this.roots.length === 0) {
            const document = window.activeTextEditor?.document
            this.roots = this.getRootItems(document)
        }
        return this.roots
    }

    // override
    getTreeItem(element: ScopeTreeItem): TreeItem {
        return element
    }

    refresh() {
        this.roots = []
        this._onDidChangeTreeData.fire()
    }

    revealActiveItem(editor: TextEditor) {
        if (!this.treeView || !Language.isSupported(editor.document.languageId)) {
            return
        }
        const offset = editor.document.offsetAt(editor.selection.active)
        const item = this.findDeepestItem(this.roots, offset)
        if (item) {
            this.treeView.reveal(item, {
                select: true,
                focus: false,
                expand: true,
            })
        }
    }

    private getRootItems(document: TextDocument | undefined): ScopeTreeItem[] {
        if (!document || !Language.isSupported(document.languageId)) {
            return []
        }
        const docInfo = DocumentInfoService.get(document)
        return ScopeTreeDataProvider.buildItemTree(docInfo.scopes.items.map(e => e.value))
    }

    private findDeepestItem(items: ScopeTreeItem[], offset: number): ScopeTreeItem | undefined {
        for (const item of items) {
            if (offset >= item.scope.begin && offset < item.scope.end) {
                return this.findDeepestItem(item.children, offset) ?? item
            }
        }
        return undefined
    }

    /** Transforms a flat, properly-nested interval list into a tree via a stack sweep. */
    private static buildItemTree<K extends string>(scopes: Scope<K>[]): ScopeTreeItem[] {
        const sorted = [...scopes].sort((a, b) => a.begin - b.begin || b.end - a.end)
        const roots: ScopeTreeItem[] = []
        const stack: ScopeTreeItem[] = []
        const document = window.activeTextEditor!.document
        const docInfo = DocumentInfoService.get(document)
        for (const scope of sorted) {
            while (stack.length && stack[stack.length - 1].scope.end <= scope.begin) {
                stack.pop()
            }
            const parentNode = stack[stack.length - 1]
            const node = ScopeTreeItem.newInstance(scope, parentNode, docInfo)
            if (parentNode) {
                parentNode.children.push(node)
            } else {
                roots.push(node)
            }
            stack.push(node)
        }

        const fixCollapsibleState = (node: ScopeTreeItem) => {
            node.collapsibleState = node.children.length
                ? TreeItemCollapsibleState.Collapsed
                : TreeItemCollapsibleState.None
            node.children.forEach(fixCollapsibleState)
        }
        roots.forEach(fixCollapsibleState)

        return roots
    }
}
export class ScopeExplorerService {
    private static isActive = false
    private static treeDataProvider = new ScopeTreeDataProvider()

    private constructor() {}

    static async start(ctx: ExtensionContext) {
        if (this.isActive) {
            return
        }
        await DocumentInfoService.start(ctx)
        const treeView = window.createTreeView('scopeExplorer', {
            treeDataProvider: this.treeDataProvider,
        })
        this.treeDataProvider.treeView = treeView

        ctx.subscriptions.push(
            // Derive tree data from tree view
            treeView,

            // Jump to scope in active document
            commands.registerCommand('deadeye.scopeExplorer.jumpTo', (scope: Scope<string>) => {
                const editor = window.activeTextEditor
                if (!editor) {
                    return
                }
                const rel = DocumentContext.newInstance(editor.document)
                const begin = rel.pos(scope.begin)
                const end = rel.pos(scope.end)
                editor.selection = new Selection(begin, end)
                editor.revealRange(new Range(begin, end))
            }),

            // Refresh on edits in active document
            workspace.onDidChangeTextDocument(event => {
                if (event.document === window.activeTextEditor?.document) {
                    this.treeDataProvider.refresh()
                }
            }),

            // Refresh on editor change
            window.onDidChangeActiveTextEditor(() => this.treeDataProvider.refresh()),

            // Follow the cursor: Expand and select the innermost active scope
            window.onDidChangeTextEditorSelection(event =>
                this.treeDataProvider.revealActiveItem(event.textEditor),
            ),
        )
    }
}

export default ScopeExplorerService
