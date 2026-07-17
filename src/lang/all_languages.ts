import { Language } from '../languages'
import rustVocab from './rust/language'

/**
 * Contains the vocabulary of every supported language.
 *
 * The key is the `langId`.
 */
const allLanguages: Record<string, Language> = {
    rust: rustVocab,
}

export default allLanguages
