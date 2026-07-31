import { defineConfig } from '@vscode/test-cli'

export default defineConfig({
    files: 'out/test/**/*.test.js',
    version: 'stable',

    // Pipe logs back to terminal
    mocha: {
        ui: 'tdd',
        require: ['./scripts/register-paths.cjs'],
    },
    launchArgs: ['--attach-argv', '--enable-logging'],
})
