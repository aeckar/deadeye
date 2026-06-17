import { CompletionFamily } from '../completion_utils';
import rust from './rust/completions';
import typescript from './ts/completions';

/**
 * Contains completion families of every supported language.
 *
 * The key is the `langId`.
 */
const completionFamilies: Record<string, CompletionFamily<any>[]> = {
    rust,
    typescript,
};

export default completionFamilies;
