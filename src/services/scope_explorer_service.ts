import {
    Event,
    EventEmitter,
    ExtensionContext,
    Range,
    Selection,
    TreeDataProvider,
    TreeItem,
    TreeItemCollapsibleState,
    TreeView,
    commands,
    window,
    workspace,
} from 'vscode'
import { Scope } from '../scope'

class ScopeTreeItem<K extends string> extends TreeItem {
    children: ScopeTreeItem<K>[] = []

    constructor(
        readonly scope: Scope<K>,
        readonly parent: ScopeTreeItem<K> | undefined,
    ) {
        const begin = scope.begin.toString().padStart(6)
        const end = scope.end
            .toString()
            .padStart(6)
        super(
            `${begin} ${end} ${scope.kind}`,
            TreeItemCollapsibleState.None,
        )
        this.command = {
            command: 'deadeye.scopeExplorer.jumpTo',
            title: 'Jump to scope',
            arguments: [scope],
        }
    }
}

/** Turns a flat, properly-nested interval list into a tree via a stack sweep. */
function buildScopeTree<K extends string>(scopes: Scope<K>[]): ScopeTreeItem<K>[] {
    const sorted = [...scopes].sort((a, b) => a.begin - b.begin || b.end - a.end)
    const roots: ScopeTreeItem<K>[] = []
    const stack: ScopeTreeItem<K>[] = []

    for (const scope of sorted) {
        while (stack.length && stack[stack.length - 1].scope.end <= scope.begin) {
            stack.pop()
        }
        const parentNode = stack[stack.length - 1]
        const node = new ScopeTreeItem(scope, parentNode)
        if (parentNode) {
            parentNode.children.push(node)
        } else {
            roots.push(node)
        }
        stack.push(node)
    }

    const fixCollapsibleState = (node: ScopeTreeItem<K>) => {
        node.collapsibleState = node.children.length
            ? TreeItemCollapsibleState.Collapsed
            : TreeItemCollapsibleState.None
        node.children.forEach(fixCollapsibleState)
    }
    roots.forEach(fixCollapsibleState)

    return roots
}

export class ScopeExplorerService implements TreeDataProvider<ScopeTreeItem<string>> {
    private static instance = new ScopeExplorerService()

    private _onDidChangeTreeData = new EventEmitter<void>()
    readonly onDidChangeTreeData: Event<void> = this._onDidChangeTreeData.event

    private roots: ScopeTreeItem<string>[] = []
    private treeView?: TreeView<ScopeTreeItem<string>>

    private constructor() {}

    static start(ctx: ExtensionContext) {
        const treeView = window.createTreeView('scopeListView', {
            treeDataProvider: this.instance,
        })
        this.instance.treeView = treeView
        ctx.subscriptions.push(treeView)

        ctx.subscriptions.push(
            commands.registerCommand('scopeExplorer.jumpTo', (scope: Scope<string>) => {
                const editor = window.activeTextEditor
                if (!editor) return
                const pos = editor.document.positionAt(scope.begin)
                editor.selection = new Selection(pos, pos)
                editor.revealRange(new Range(pos, pos))
            }),
        )

        ctx.subscriptions.push(
            workspace.onDidChangeTextDocument(event => {
                if (event.document === window.activeTextEditor?.document) {
                    this.instance.refresh()
                }
            }),
        )

        ctx.subscriptions.push(
            window.onDidChangeActiveTextEditor(() => this.instance.refresh()),
        )

        // Follow the cursor: expand + select the innermost active scope
        ctx.subscriptions.push(
            window.onDidChangeTextEditorSelection(e =>
                this.instance.revealActiveScope(e.textEditor),
            ),
        )
    }

    private refresh() {
        this.roots = []
        this._onDidChangeTreeData.fire()
    }

    getTreeItem(element: ScopeTreeItem<string>): TreeItem {
        return element
    }

    getParent(element: ScopeTreeItem<string>): ScopeTreeItem<string> | undefined {
        return element.parent
    }

    getChildren(element?: ScopeTreeItem<string>): ScopeTreeItem<string>[] {
        if (element) return element.children
        if (this.roots.length === 0) {
            this.roots = this.buildRootsForActiveDocument()
        }
        return this.roots
    }

    private buildRootsForActiveDocument(): ScopeTreeItem<string>[] {