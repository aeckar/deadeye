import { Language } from '../languages'
import rustLanguage from './rust/language'

/**
 * Contains the vocabulary of every supported language.
 *
 * The key is the `langId`.
 */
const allLanguages: Record<string, Language> = {
    rustLanguage,
}

export default allLanguages
