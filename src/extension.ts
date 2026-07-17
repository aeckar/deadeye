//! Extension entry point.
import { ExtensionContext } from 'vscode'

import DocumentInfoService from './services/document_info_service'
import IntervalTreeService from './services/interval_tree_service'
import CompletionService from './services/completion_service'
import SmartDeleteService from './services/smart_delete_service'
import ScopeBreadcrumbsService from './services/scope_breadcrumbs_service'

/** Extension initializer. */
export async function activate(context: ExtensionContext) {
    // 1. Asynchronous dependency resolution
    await IntervalTreeService.start()

    // 2. Synchronous UI and document service bindings
    DocumentInfoService.start(context)
    ScopeBreadcrumbsService.start(context)
    SmartDeleteService.start(context)
    CompletionService.start(context)
}
