import { Language } from '../language_utils';
import rust from './rust/language';
import typescript from './ts/language';

/**
 * Contains the vocabulary of every supported language.
 *
 * The key is the `langId`.
 * 
 * # Implementation
 * 
 * languagesbyid to not conflict with csv languages namepsace
 */
const languagesById: Record<string, Language> = {
    rust,
    typescript,
};

export default languagesById;
