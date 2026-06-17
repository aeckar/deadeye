import { Family } from '../family_api';
import rust from './rust/families';
import typescript from './ts/families';

/**
 * Contains completion families of every supported language.
 *
 * The key is the `langId`.
 */
const completionFamilies: Record<string, Family<any>[]> = {
    rust,
    typescript,
};

export default completionFamilies;
