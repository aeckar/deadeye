import { CompletionRegistry } from '@/api/completion_api'
import { Language, Token } from '@/api/language_api'
import { ScopeRegistry } from '@/api/scope_api'
import rustCompletions from '@/lang/rust/completion_registry'
import rustLanguage from '@/lang/rust/language'
import rustScopes from '@/lang/rust/scope_registry'
import { select } from '@/utils/collections'
import { escapeRegex } from '@/utils/strings'

export type AsiResolver = (text: string, tokens: Token[]) => void

export class LanguageInfo {
    private _openBrackets: Language | undefined

    private constructor(
        readonly completions: CompletionRegistry<string>,
        readonly language: Language,
        readonly scopes: ScopeRegistry<string>,
        readonly asi: AsiResolver | undefined
    ) {}

    get openBrackets(): Language {
        if (!this._openBrackets) {
            this._openBrackets = this.language.select(/OPEN_.*/g)
        }
        return this._openBrackets
    }

    static newInstance<ScopeKind extends string>(
        completions: CompletionRegistry<ScopeKind>,
        language: Language,
        scopes: ScopeRegistry<ScopeKind>,
        asi?: AsiResolver
    ): LanguageInfo {
        return new this(completions as CompletionRegistry<string>, language, scopes, asi)
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
