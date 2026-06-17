import { CompletionFamilyRegistry, substitute } from '../../completion_api';
import { toMarkdown as md } from '../../text_manip';

// do not highlight hot shorthand - 1
//dont use tm, rarely ever used by devs and writers

//<mark>

/**
# Markdown Completions

Completions for Markdown differ slightly from those of other languages because of how the language is highly contextual and difficult to parse. To address this, completions are divided into two categories:

- **Suffix completions:** last word in a line, triggered by `ENTER` 
- **Inline completions:** anywhere, prefixed by `;` and triggered by space (` `)

Because every common Markdown construct is supported as a completion, it is advised to disable all completions for Markdown files by adding the following entry to `settings.json`.

```json
"[markdown]": {
    "editor.suggestOnTriggerCharacters": false,
    "editor.quickSuggestions": {
        "other": "off",
        "comments": "off",
        "strings": "off"
    },
    "editor.snippetSuggestions": "none",
    "editor.wordBasedSuggestions": "off"
}
```
*/

// try double space/semi

const markdown = CompletionFamilyRegistry.newInstance(
    substitute('(c)', '©', 'Inserts a copyright symbol.'),
    substitute('--', '——', 'Inserts an em dash.'),
    {
        // ` = U+1FEF
        docs: md`
            Formats the following text.

            \`bic important code\` → \`***`important code`*** \`

            | Flag | Mnemonic             | Expansion          |
            | :--- | :------------------- | :----------------- |
            | b    | <u>b</u>old          | \`**\` \`**\`          |
            | i    | <u>i</u>talics       | \`*\` \`*\`            |
            | u    | <u>u</u>nderline     | \`<u>\` \`</u>\`       |
            | s    | <u>s</u>trikethrough | \`~~\` \`~~\`          |
            | h    | <u>h</u>ighlight     | \`<mark>\` \`</mark>\` |
            | c    | <u>c</u>ode          | \``\` \``\`            |
            | m    | <u>m</u>ath          | \`$\` \`$\`            |

            todo add 2nd trigger

            **Syntax:** <flags> <word1> <word2> ... <wordN>

            **Terminator: ** \` \` (if using space trigger)
        `,
        minLookbehind: 1,
        resolver(ctx) {},
    },
);

export default markdown;
