import { Language } from '../language_utils';
import rust from './rust/language';
import typescript from './ts/language';

/**
 * Contains the vocabulary of every supported language.
 *
 * The key is the `langId`.
 */
const languages: Record<string, Language> = {
    rust,
    typescript,
};

export default languages;
