import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    build: {
        target: 'node18', // Match VS Code's runtime environment
        lib: {
            entry: path.resolve(__dirname, 'src/extension.ts'),
            formats: ['cjs'],
            fileName: () => 'extension.js',
        },
        outDir: 'dist',
        minify: false, // Turned off for dev/debugging, overridden in scripts via command-line flags
        sourcemap: 'hidden',
        rollupOptions: {
            external: ['vscode'], // Ensure the vscode API injected at runtime isn't bundled
            output: {
                exports: 'named',
            },
        },
    },
});
