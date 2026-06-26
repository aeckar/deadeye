import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'

export default [
    eslint.configs.recommended,
    ...tseslint.configs.recommended,

    {
        files: ['**/*.ts'],
        plugins: {
            '@typescript-eslint': tseslint.plugin,
        },
        languageOptions: {
            parser: tseslint.parser,
            ecmaVersion: 2022,
            sourceType: 'module',
        },
        rules: {
            '@typescript-eslint/naming-convention': [
                'warn',
                {
                    selector: 'import',
                    format: ['camelCase', 'PascalCase'],
                },
            ],
            curly: 'warn',
            eqeqeq: 'warn',
            'no-throw-literal': 'warn',

            // REMOVED: 'semi': 'warn' has been deleted so it doesn't fight Prettier.
        },
    },

    // 3. Prettier Override (MUST be at the absolute end to silence formatting rules)
    eslintConfigPrettier,
]
