import { CompletionFamily } from '../registry_api';
import rust from './rust/registry';
import typescript from './ts/registry';

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
