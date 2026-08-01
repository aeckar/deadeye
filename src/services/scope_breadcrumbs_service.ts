import { Language } from '@/api/language_api'
import DocumentInfoService from '@/services/document_info_service'
import { BREADCRUMB_SEP } from '@/utils/constants'
import { ExtensionContext, StatusBarAlignment, TextEditor, window } from 'vscode'

class ScopeBreadcrumbsService {
    private static isActive = false
    private static statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 10000)

    static async start(ctx: ExtensionContext) {
        if (this.isActive) {
            return
        }
        await DocumentInfoService.start(ctx)
        this.updateBreadcrumbs(window.activeTextEditor)
        ctx.subscriptions.push(
            // Show status bar
            this.statusBarItem,

            // Listen for cursor movement
            window.onDidChangeTextEditorSelection(e => {
                this.updateBreadcrumbs(e.textEditor)
            }),

            // Listen for active editor switches
            window.onDidChangeActiveTextEditor(editor => {
                this.updateBreadcrumbs(editor)
            }),
        )
        this.isActive = true
    }

    private static updateBreadcrumbs(editor: TextEditor | undefined) {
        if (!editor) {
            this.statusBarItem.hide()
            return
        }
        const { document } = editor
        if (!Language.isSupported(document.languageId)) {
            // unsupported language
            this.statusBarItem.hide()
            return
        }
        const offset = document.offsetAt(editor.selection.active)
        const breadcrumbs = DocumentInfoService.get(document)
            .selectScopes(offset)
            .map(e => e.kind)
        if (breadcrumbs.length === 0) {
            this.statusBarItem.hide()
            return
        }
        this.statusBarItem.text = `$(symbol-class) ${breadcrumbs.join(` ${BREADCRUMB_SEP} `)}`
        this.statusBarItem.tooltip = 'Current Scope Hierarchy'
        this.statusBarItem.show()
    }
}

export default ScopeBreadcrumbsService
