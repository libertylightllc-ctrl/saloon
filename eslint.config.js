// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

// CLAUDE.md rule 7 + 02-DESIGN-SYSTEM §5: layout must mirror in RTL, so styles use start/end.
const rtlGuards = [
  {
    selector:
      'ObjectExpression > Property[key.name=/^(marginLeft|marginRight|paddingLeft|paddingRight|left|right|borderLeftWidth|borderRightWidth|borderLeftColor|borderRightColor|borderTopLeftRadius|borderTopRightRadius|borderBottomLeftRadius|borderBottomRightRadius)$/]',
    message:
      'Use start/end (marginStart, paddingEnd, start, borderTopStartRadius…) so RTL mirrors.',
  },
];

// CLAUDE.md rule 6: colours come from theme tokens only.
const colourGuards = [
  {
    selector: 'Literal[value=/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]',
    message: 'No hardcoded colours. Read them from useTheme().',
  },
  {
    selector: 'Literal[value=/^(rgb|rgba|hsl|hsla)\\(/]',
    message: 'No hardcoded colours. Read them from useTheme().',
  },
  {
    selector: "ObjectExpression > Property[key.name=/(^c|C)olor$/] > Literal[value!='transparent']",
    message: 'No hardcoded colours. Read them from useTheme().',
  },
];

// CLAUDE.md rule 7: user-facing text goes through i18n keys.
const textGuards = [
  {
    selector:
      'JSXAttribute[name.name=/^(title|subtitle|label|placeholder|message|actionLabel|body|itemLabel|accessibilityLabel|accessibilityHint)$/] > Literal[value=/[A-Za-z\\u0600-\\u06FF\\u0900-\\u097F]/]',
    message: 'User-facing text must use t("key") from react-i18next.',
  },
  {
    selector: 'JSXText[value=/[A-Za-z\\u0600-\\u06FF\\u0900-\\u097F]/]',
    message: 'User-facing text must use t("key") from react-i18next.',
  },
];

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', '.expo/*', 'coverage/*', 'supabase/functions/*', 'docs/*'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', ...rtlGuards, ...colourGuards, ...textGuards],
    },
  },
  {
    // The theme is where colours are defined.
    files: ['src/theme/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', ...rtlGuards, ...textGuards],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'jest.setup.ts'],
    rules: {
      'no-restricted-syntax': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]);
