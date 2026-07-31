//! Isolate logger to prevent circular module dependencies.
import { window } from 'vscode'

export const logger = window.createOutputChannel('Deadeye')
