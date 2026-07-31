//! Decouple from service file to resolve circular dependency through '@/api/completion_api'.
import { CompletionRegistry } from '@/api/completion_api'
import { Language } from '@/api/language_api'
import { ScopeRegistry } from '@/api/scope_api'
import { AsiResolver } from './document_info'

class LanguageInfo {
    private _openBrackets: Language | undefined

    private constructor(
        readonly completions: CompletionRegistry<string>,
        readonly language: Language,
        readonly scopes: ScopeRegistry<string>,
        readonly asi: AsiResolver | undefined,
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
        asi?: AsiResolver,
    ): LanguageInfo {
        return new this(completions as CompletionRegistry<string>, language, scopes, asi)
    }
}

export default LanguageInfo
