//! Extension entry point.
import { ExtensionContext, window } from 'vscode'

import CompletionService from './services/completion_service'
import DocumentInfoService from './services/document_info_service'
import IntervalTreeService from './services/interval_tree_service'
import ScopeBreadcrumbsService from './services/scope_breadcrumbs_service'
import TextDeletionService from './services/text_deletion_service'
import TokenExplorerService from './services/token_explorer_service'
import ScopeExplorerService from './services/scope_explorer_service'

const logger = window.createOutputChannel('Your Extension Name')

/**
 * Extension initializer.
 *
 * Codicon reference:
 * https://code.visualstudio.com/api/references/icons-in-labels
 */
export async function activate(context: ExtensionContext) {
    try {
        // 1. Asynchronous dependency resolution
        await IntervalTreeService.start()

        // 2. Synchronous UI and document service bindings
        DocumentInfoService.start(context)
        ScopeBreadcrumbsService.start(context)
        TextDeletionService.start(context)
        CompletionService.start(context)
        TokenExplorerService.start(context)
        ScopeExplorerService.start(context)

        logger.appendLine('[Info] Extension activated successfully.')
    } catch (e) {
        logger.appendLine(`[Error] Activation failed: ${error}`)
        console.error('Activation Error:', error)

        // Notify the user via VS Code UI
        const choice = await vscode.window.showErrorMessage(
            'Failed to initialize Extension Name. Check Output logs for details.',
            'Show Logs',
        )

        if (choice === 'Show Logs') {
            logger.show()
        }
    }
}

/** Extension cleanup. */
export function deactivate() {
    logger.appendLine('[Info] Extension deactivated successfully.')
}
