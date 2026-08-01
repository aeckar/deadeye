//! Isolate logger to prevent circular module dependencies.
import { window } from 'vscode'
import { EXTENSION_NAME } from '@/utils/constants'

export const logger = window.createOutputChannel(EXTENSION_NAME, { log: true })
