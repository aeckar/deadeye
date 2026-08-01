//! Isolate logger to prevent circular module dependencies.
import { EXTENSION_NAME } from '@/utils/constants'
import { window } from 'vscode'

const log = window.createOutputChannel(EXTENSION_NAME, { log: true })

export default log