import rustCompletions from '@/lang/rust/completion_registry'
import rustLanguage from '@/lang/rust/language'
import rustScopes from '@/lang/rust/scope_registry'
import LanguageInfo from '@/language_info'
import  log  from '@/logger'
import { select } from '@/utils/collections'
import { escapeRegex } from '@/utils/strings'

class LanguageInfoService {
    private static isActive = false

    /** Must be populated in service initializer */
    private static _languages: Map<string, LanguageInfo<string>> = new Map()

    private constructor() {}

    /**
     * Supported languages must be declared here so that the explorer services
     * can perform an initial run.
     */
    static async start() {
        if (this.isActive) {
            return
        }
        this.isActive = true
        this.set(
            'rust',
            LanguageInfo.newInstance(
                rustCompletions,
                rustLanguage,
                rustScopes,
            ) as LanguageInfo<string>,
        )
    }

    /** Declares a supported language. */
    private static set(langId: string, info: LanguageInfo<string>) {
        if (this._languages.has(langId)) {
            log.warn(`Support for language '${langId}' declared again`)
        }
        this._languages.set(langId, info)
    }

    /**
     * Returns information about the given language.
     *
     * It is the responsibility of the caller to ensure the correct type for `ScopeKind`.
     *
     * Returns `undefined` if the language of the active document is unsupported.
     */
    static get<ScopeKind extends string>(langId: string): LanguageInfo<ScopeKind> | undefined {
        const langInfo = this._languages.get(langId)
        if (!langInfo) {
            return undefined
        }
        return langInfo as unknown as LanguageInfo<ScopeKind>
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
