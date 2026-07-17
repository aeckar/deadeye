import {
    ExtensionContext,
    StatusBarAlignment,
    TextEditor,
    window,
} from 'vscode'
import DocumentInfoService from './document_info_service'

export class ScopeBreadcrumbsService {
    private static statusBarItem = window.createStatusBarItem(
        StatusBarAlignment.Left,
        10000,
    )

    static start(ctx: ExtensionContext) {
        ctx.subscriptions.push(this.statusBarItem)

        // Listen for cursor movement
        ctx.subscriptions.push(
            window.onDidChangeTextEditorSelection(e => {
                this.updateBreadcrumbs(e.textEditor)
            }),
        )

        // Listen for active editor switches
        ctx.subscriptions.push(
            window.onDidChangeActiveTextEditor(editor => {
                this.updateBreadcrumbs(editor)
            }),
        )

        // Initial run
        this.updateBreadcrumbs(window.activeTextEditor)
    }

    private static updateBreadcrumbs(editor: TextEditor | undefined) {
        if (!editor) {
            this.statusBarItem.hide()
            return
        }

        const document = editor.document
        // Only run for your supported languages (e.g., Rust)
        if (document.languageId !== 'rust') {
            this.statusBarItem.hide()
            return
        }

        const cursorOffset = document.offsetAt(editor.selection.active)

        // Fetch from your custom registry manager instance
        // e.g., const scopesManager = this.getRegistryFor(document);
        const breadcrumbs =
            DocumentInfoService.get(document).getBreadcrumbs(cursorOffset)

        if (breadcrumbs.length === 0) {
            this.statusBarItem.hide()
            return
        }

        // Format with a clean breadcrumb separator symbol
        this.statusBarItem.text = `$(symbol-class) ${breadcrumbs.join(' > ')}`
        this.statusBarItem.tooltip = 'Current Scope Hierarchy'
        this.statusBarItem.show()
    }
}

export default ScopeBreadcrumbsService