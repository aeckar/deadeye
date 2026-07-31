import { select } from '@/utils/collections'
import { escapeRegex } from '@/utils/strings'
import LanguageInfo from '@/language_info'
import { logger } from '@/logger'

class LanguageInfoService {
    /** Must be populated in service initializer */
    private static _languages: Map<string, LanguageInfo> = new Map()

    private constructor() {}

    static async start() {}

    /** Declares a supported language. */
    static set(langId: string, info: LanguageInfo) {
        if (this._languages.has(langId)) {
            logger.appendLine(`[Warn] Support for language '${langId}' declared again`)
        }
        this._languages.set(langId, info)
    }

    /** Returns information pertaining to all supported languages. */
    static get(langId: string): LanguageInfo {
        const langInfo = this._languages.get(langId)
        if (!langInfo) {
            throw new Error(`'${langId}' is not a supported language`)
        }
        return langInfo
    }

    static *select(pattern: string | RegExp) {
        if (typeof pattern === 'string') {
            pattern = new RegExp(escapeRegex(pattern))
        }
        for (const [langId, langInfo] of select(this._languages, langId => pattern.test(langId))) {
            yield [langId, langInfo] as const
        }
    }
}

export default LanguageInfoService
