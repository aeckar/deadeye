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
            'no-implicit-coercion': 'off',
            'no-extra-boolean-cast': 'off',
            'no-plusplus': ['warn', { allowForLoopAfterthoughts: true }],
            'no-throw-literal': 'warn',
            curly: 'warn',
            eqeqeq: 'warn',

            '@typescript-eslint/strict-boolean-expressions': 'off',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^(?:_+|_[a-zA-Z0-9]+)$',
                    varsIgnorePattern: '^(?:_+|_[a-zA-Z0-9]+)$',
                },
            ],
            '@typescript-eslint/naming-convention': [
                'warn',
                {
                    selector: 'import',
                    format: ['camelCase', 'PascalCase'],
                },
            ],

            // Does not support exception for `void`
            // '@typescript-eslint/explicit-function-return-type': 'warn',

            // Removed to not conflict with Prettier
            // 'semi': 'warn'
        },
    },

    // Prettier override
    // Must be at end to silence formatting rules
    eslintConfigPrettier,
]
