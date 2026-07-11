import daStyle from 'eslint-config-dicodingacademy';
import pluginReact from 'eslint-plugin-react';

export default [
  // Global ignores MUST be their own config object in ESLint's flat config
  // format - nesting `ignores` inside an object that also has `files`/`rules`
  // only scopes that one config, it does not exclude the path from every
  // other config (which is why generated build output was being linted).
  {
    ignores: ['dist/**', 'node_modules/**', 'dev-dist/**'],
  },
  daStyle,
  {
    files: ['**/*.{js,jsx}'],
    plugins: {
      react: pluginReact,
    },
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        babelOptions: {
          presets: ['@babel/preset-react'],
        },
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...pluginReact.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'camelcase': 'off',
    },
  },
];
