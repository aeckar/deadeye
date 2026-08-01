//! Extension entry point.
import { ExtensionContext, window } from 'vscode'

import { logger } from '@/logger'
import IntervalTreeService from '@/services/interval_tree_service'
import LanguageInfoService from '@/services/language_info_service'
import ScopeBreadcrumbsService from '@/services/scope_breadcrumbs_service'
import ScopeExplorerService from '@/services/scope_explorer_service'
import TextDeletionService from '@/services/text_deletion_service'
import TextInsertionService from '@/services/text_insertion_service'
import TokenExplorerService from '@/services/token_explorer_service'
import { EXTENSION_NAME } from '@/utils/constants'

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
            LanguageInfoService.start(),
            TextInsertionService.start(context),
            TextDeletionService.start(context),
            ScopeBreadcrumbsService.start(context),
            TokenExplorerService.start(context),
            ScopeExplorerService.start(context),
        ])
        logger.info('Extension activated successfully.')
    } catch (e) {
        console.error('Activation Error:', e)
        logger.error(`Activation failed: ${e}`)
        const choice = await window.showErrorMessage(
            `Failed to initialize ${EXTENSION_NAME}. Check Output logs for details.`,
            'Show Logs',
        )
        if (choice === 'Show Logs') {
            logger.show()
        }
    }
}

/** Extension cleanup. */
export function deactivate() {
    logger.info('Extension deactivated successfully.')
}
