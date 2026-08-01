import { select } from '@/utils/collections'
import { escapeRegex } from '@/utils/strings'
import LanguageInfo from '@/language_info'
import { logger } from '@/logger'
import rustCompletions from '@/lang/rust/completion_registry'
import rustLanguage from '@/lang/rust/language'
import rustScopes from '@/lang/rust/scope_registry'

class LanguageInfoService {
    private static isActive: boolean = false

    /** Must be populated in service initializer */
    private static _languages: Map<string, LanguageInfo> = new Map()

    private constructor() {}

    /**
     * Supported languages must be declared here so that the explorer services
     * can perform an initial run.
     */
    static async start() {
        if (this.isActive) {
            return
        }
        this.set('rust', LanguageInfo.newInstance(rustCompletions, rustLanguage, rustScopes))
        this.isActive = true
    }

    /** Declares a supported language. */
    private static set(langId: string, info: LanguageInfo) {
        if (this._languages.has(langId)) {
            logger.warn(`Support for language '${langId}' declared again`)
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
