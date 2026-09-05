import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['out/**', 'dist/**', 'node_modules/**', 'docs/**', 'build/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
    },
  },
  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts', 'tests/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/renderer/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
  {
    // Build scripts are plain Node modules, and printing is their whole job.
    files: ['scripts/**/*.mjs', '*.config.mjs', '*.config.ts'],
    languageOptions: { globals: globals.node, sourceType: 'module' },
    rules: { 'no-console': 'off' },
  },
  {
    // The screenshot harness is CommonJS because Electron only exposes its
    // named exports to `require`.
    files: ['scripts/**/*.cjs'],
    languageOptions: { globals: globals.node, sourceType: 'commonjs' },
    rules: { 'no-console': 'off', '@typescript-eslint/no-require-imports': 'off' },
  },
);
