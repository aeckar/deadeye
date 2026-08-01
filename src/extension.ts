//! Extension entry point.
import { ExtensionContext, window } from 'vscode'

import  log  from '@/logger'
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
 *
 * Extension API reference:
 * https://code.visualstudio.com/api
 */
export async function activate(context: ExtensionContext) {
    try {
        // services must run sequentially for proper dependency resolution (no `Promise.all`)
        await IntervalTreeService.start()
        await LanguageInfoService.start()
        await TextInsertionService.start(context)
        await TextDeletionService.start(context)
        await ScopeBreadcrumbsService.start(context)
        await TokenExplorerService.start(context)
        await ScopeExplorerService.start(context)
        log.info('Extension activated successfully.')
    } catch (e) {
        console.error('Activation Error:', e)
        log.error(`Activation failed: ${e}`)
        const choice = await window.showErrorMessage(
            `Failed to initialize ${EXTENSION_NAME}. Check output logs for details.`,
            'Show Logs',
        )
        if (choice === 'Show Logs') {
            log.show()
        }
    }
}

/** Extension cleanup. */
export function deactivate() {
    log.info('Extension deactivated successfully.')
}
