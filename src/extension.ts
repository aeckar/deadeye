//! Extension entry point.
import { ExtensionContext, window } from 'vscode'

import CompletionService from './services/completion_service'
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
        await Promise.all([
            IntervalTreeService.start(),
            CompletionService.start(context),
            TextDeletionService.start(context),
            ScopeBreadcrumbsService.start(context),
            TokenExplorerService.start(context),
            ScopeExplorerService.start(context),
        ])
        logger.appendLine('[Info] Extension activated successfully.')
    } catch (e) {
        console.error('Activation Error:', e)
        logger.appendLine(`[Error] Activation failed: ${e}`)
        const choice = await window.showErrorMessage(
            'Failed to initialize Deadeye. Check Output logs for details.',
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
