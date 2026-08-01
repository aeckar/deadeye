//! Decouple from service file to resolve circular dependency through '@/api/completion_api'.
import { CompletionRegistry } from '@/api/completion_api'
import { Language } from '@/api/language_api'
import { ScopeRegistry } from '@/api/scope_api'
import { AsiResolver } from '@/document_info'

class LanguageInfo<ScopeKind extends string> {
    private _openBrackets: Language | undefined

    private constructor(
        readonly completions: CompletionRegistry<ScopeKind>,
        readonly language: Language,
        readonly scopes: ScopeRegistry<ScopeKind>,
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
    ): LanguageInfo<ScopeKind> {
        return new this<ScopeKind>(completions, language, scopes, asi)
    }
}

export default LanguageInfo
