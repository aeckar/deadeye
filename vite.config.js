import path from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
    resolve: {
        alias: {
            // eslint-disable-next-line no-undef
            '@': path.resolve(__dirname, 'src'),
        },
    },
    build: {
        target: 'node18', // match VS Code's runtime environment
        lib: {
            // eslint-disable-next-line no-undef
            entry: path.resolve(__dirname, 'src/extension.ts'),
            formats: ['cjs'],
            fileName: () => 'extension.js',
        },
        outDir: 'dist', // location of final production bundle
        minify: false, // turned off for dev/debugging, overridden in scripts via command-line flags
        sourcemap: 'inline', // enable breakpoints
        rollupOptions: {
            external: ['vscode'], // ensure the vscode API injected at runtime isn't bundled
            output: {
                exports: 'named',
            },
        },
    },
})
