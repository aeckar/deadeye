import { CompletionRegistry } from '../completions'
// import markdownCompletions from './md/completion_registry'
import rustCompletions from './rust/completion_registry'

/**
 * Contains completion families of every supported language.
 *
 * The key is the `langId`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const allCompletionRegistries: Record<string, CompletionRegistry<any>> = {
    rust: rustCompletions,
    // markdown: markdownCompletions,
}

export default allCompletionRegistries
