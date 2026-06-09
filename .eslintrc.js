'use strict';

module.exports = {
  env: {
    node:   true,
    es2021: true,
  },
  extends: 'eslint:recommended',
  parserOptions: {
    ecmaVersion: 'latest',
  },
  rules: {
    'no-console':     'warn',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-process-exit': 'off',
    'eqeqeq':         ['error', 'always'],
    'curly':          'error',
  },
};
