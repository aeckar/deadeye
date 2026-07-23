import {
    ExtensionContext,
    StatusBarAlignment,
    TextEditor,
    window,
} from 'vscode'
import DocumentInfoService from './document_info_service'
import { BREADCRUMB_SEP } from '../constants'

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
        if (document.languageId !== 'rust') {
            // unsupported language
            this.statusBarItem.hide()
            return
        }
        const offset = document.offsetAt(editor.selection.active)
        const breadcrumbs =
            DocumentInfoService.get(document).getBreadcrumbs(offset)
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