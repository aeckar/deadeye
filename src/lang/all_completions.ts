import { CompletionRegistry } from '../completion_utils';
import markdown from './md/completions';
import rust from './rust/completions';
import typescript from './ts/completions';

/**
 * Contains completion families of every supported language.
 *
 * The key is the `langId`.
 */
const completionRegistries: Record<string, CompletionRegistry<any>> = {
    rust,
    typescript,
    markdown,
};

export default completionRegistries;
