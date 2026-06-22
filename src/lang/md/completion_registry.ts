import {
    CompletionRegistry,
    substitute,
} from '../../completion_registry_utils';
import { isLowerLetter, toMarkdown as md } from '../../text_utils';

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

const markdown = CompletionRegistry.newInstance(
    substitute('(c)', '©'),
    substitute('--', '——'),
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
        resolver(ctx) {
            const fwd = ctx.leftOfCursor();
            const rev = fwd.reversed();
            const key = 'biushcm';

            while (true) {
                fwd.consume(ch => !isLowerLetter(ch));
                fwd.consume(ch => key.includes(ch));
                if (fwd.clone().dec().isRightClear()) {
                }
            }

            return {};
        },
    },
);

export default markdown;
