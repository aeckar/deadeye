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
            "@typescript-eslint/no-unused-vars": [
                "error",
                { 
                    "argsIgnorePattern": "^(?:_+|_[a-zA-Z0-9]+)$",
                    "varsIgnorePattern": "^(?:_+|_[a-zA-Z0-9]+)$" 
                }
            ],
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

            // Removed to not conflict with Prettier
            // 'semi': 'warn'
        },
    },

    // Prettier override
    // Must be at end to silence formatting rules
    eslintConfigPrettier,
]
