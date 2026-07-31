//! Extension entry point.
import { ExtensionContext, window } from 'vscode'

import rustCompletions from '@/lang/rust/completion_registry'
import rustLanguage from '@/lang/rust/language'
import rustScopes from '@/lang/rust/scope_registry'
import LanguageInfo from '@/language_info'
import { logger } from '@/logger'
import IntervalTreeService from '@/services/interval_tree_service'
import LanguageInfoService from '@/services/language_info_service'
import ScopeBreadcrumbsService from '@/services/scope_breadcrumbs_service'
import ScopeExplorerService from '@/services/scope_explorer_service'
import TextDeletionService from '@/services/text_deletion_service'
import TextInsertionService from '@/services/text_insertion_service'
import TokenExplorerService from '@/services/token_explorer_service'

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
        LanguageInfoService.set(
            'rust',
            LanguageInfo.newInstance(rustCompletions, rustLanguage, rustScopes),
        )
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
