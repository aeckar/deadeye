# deadeye

- ignore linting in testing
- use rimraf for `npm run clean`
- test: `npm run test`

remember to right click and press `debug tests` instead of `run tests`
types if ai chats:
research
debugging
advising
After writing up a brief description, we recommend including the following sections.

getter properties must be proven to not have side effects
(purely functions on readonly)

prefer gutter testing, if not go to `testing` tab in vsc

todo: ctrl-arrows to rearrange params, args
should run locally before linter (support for global refactor + debounce?)

pressing ENTER BEFORE CLOSING BRACKET ESCAPES TO NEXT LINE, combines cluster
if space before enter, go in as next param/arg

prefer readonly arrays for DSL properties
-is booleans only make sense when referring to this/self (unless ambiguity)
use `pool` naming for collections of items where any one may be matched (1 or 0 times)

cfg types must be strictly object/record types

`preset` design pattern
## Testing

See https://code.visualstudio.com/api/working-with-extensions/testing-extension#quick-setup-the-test-cli

Tests are run through the extension host, which is a specialized version of Visual Studio Code, and from that it runs mocha to then execute each unit test. It cannot run mocha directly because it won't run in the extension host, which supplies the VS Code module dynamically. If you're having trouble with source maps, ensure that you have source maps defined as inline in vite.config.js and true in tsconfig.json for the best experience. 

tostring of array type removes brackets!
debug string reps should try to be unambiguous when printed in sequence

We used V over Webpack for speed and reliability reasons. And we used PNPM over NPM for the same reason. This is in contrast to the defaults for VS Code extension scaffolding. 

try npm run clean if source map is misaligned (debugger step-over is inaccurate)

ensure `pnpm run watch-tests` is running when running tests to ensure code is continuously compiled
##

## Features

Describe specific features of your extension including screenshots of your extension in action. Image paths are relative to this README file.

> Tip: Many popular extensions utilize animations. This is an excellent way to show off your extension! We recommend short, focused animations that are easy to follow.

## Requirements

If you have any requirements or dependencies, add a section describing those and how to install and configure them.

## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

- `myExtension.enable`: Enable/disable this extension.
- `myExtension.thing`: Set to `blah` to do something.

## Known Issues

TBD

## Release Notes

TBD

This project follows the best practices defined in the Visual Studio Code [extension guidelines]

[extension guidelines]: https://code.visualstudio.com/api/references/extension-guidelines

## Go further

- Reduce the extension size and improve the startup time by [bundling your extension](https://code.visualstudio.com/api/working-with-extensions/bundling-extension).
- [Publish your extension](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) on the VS Code extension marketplace.
- Automate builds by setting up [Continuous Integration](https://code.visualstudio.com/api/working-with-extensions/continuous-integration).
