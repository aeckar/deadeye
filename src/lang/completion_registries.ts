import { CompletionRegistry } from '../completion_registry_utils';
import markdown from './md/completion_registry';
import rust from './rust/completion_registry';
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
