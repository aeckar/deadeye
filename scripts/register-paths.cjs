//! Registers tsconfig path aliases (@/*) for tests compiled to out/.
//!
//! Loaded as a Mocha require hook via .vscode-test.mjs.
// eslint-disable-next-line no-undef, @typescript-eslint/no-require-imports
const { register } = require('tsconfig-paths')
// eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef
const path = require('path')

register({
    // eslint-disable-next-line no-undef
    baseUrl: path.resolve(__dirname, '..', 'out'),
    paths: { '@/*': ['*'] },
})
