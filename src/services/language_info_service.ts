import { CompletionRegistry } from '@/api/completion_api'
import { Language } from '@/api/language_api'
import { ScopeRegistry } from '@/api/scope_api'
import rustCompletions from '@/lang/rust/completion_registry'
import rustLanguage from '@/lang/rust/language'
import rustScopes from '@/lang/rust/scope_registry'

export class LanguageInfo {
    private constructor(
        readonly completions: CompletionRegistry<string>,
        readonly language: Language,
        readonly scopes: ScopeRegistry<string>,
    ) {}

    static newInstance<ScopeKind extends string>(
        completions: CompletionRegistry<ScopeKind>,
        language: Language,
        scopes: ScopeRegistry<ScopeKind>,
    ): LanguageInfo {
        return new this(completions as CompletionRegistry<string>, language, scopes)
    }
}

class LanguageInfoService {
    /** Must be populated in service initializer */
    private static _languages: Map<string, LanguageInfo> = new Map()

    private constructor() {}

    static async start() {
        this._languages.set(
            'rust',
            LanguageInfo.newInstance(rustCompletions, rustLanguage, rustScopes),
        )
    }

    /** Returns information pertaining to all supported languages. */
    static get(langId: string): LanguageInfo {
        const langInfo = this._languages.get(langId)
        if (!langInfo) {
            throw new Error(`'${langId}' is not a supported language`)
        }
        return langInfo
    }
}

export default LanguageInfoService
