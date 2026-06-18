import js from '@eslint/js';
import globals from 'globals';
import nounsanitized from 'eslint-plugin-no-unsanitized';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'sample/**', 'new_theme/**']
  },

  js.configs.recommended,

  // Extension source: runs in the browser / content scripts with the chrome.* API.
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.webextensions }
    },
    plugins: { 'no-unsanitized': nounsanitized },
    rules: {
      'no-unsanitized/property': 'error',
      'no-unsanitized/method': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  },

  // Build/tooling scripts run under Node.
  {
    files: ['scripts/**/*.mjs', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node }
    }
  },

  // Tests run under Vitest (jsdom): browser globals plus the chrome mock and Node.
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.webextensions, ...globals.node }
    }
  }
];
