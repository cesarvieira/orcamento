// Regras extraídas em constantes reaproveitáveis pelas variantes (base, Vue).
// Referência: leilaodeumminuto (eslint.shared.rules.mjs), adaptado ao tamanho
// deste monorepo — mesmas regras, um único eslint.config.mjs na raiz em vez
// de um por app (não há turbo aqui, ver pnpm-workspace.yaml).

export const stylisticRules = {
  '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
  '@stylistic/eol-last': ['error', 'always'],
  '@stylistic/linebreak-style': ['error', 'unix'],
  '@stylistic/no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],
  '@stylistic/member-delimiter-style': [
    'error',
    {
      multiline: {
        delimiter: 'semi',
        requireLast: true,
      },
      singleline: {
        delimiter: 'semi',
        requireLast: false,
      },
      multilineDetection: 'brackets',
    },
  ],
  '@stylistic/operator-linebreak': [
    'error',
    'after',
    {
      overrides: {
        '?': 'before',
        ':': 'before',
      },
    },
  ],
  '@stylistic/semi': ['error', 'always'],
  '@stylistic/quotes': ['error', 'single'],
  '@stylistic/max-len': [
    'error',
    {
      code: 120,
      ignoreUrls: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true,
      ignoreRegExpLiterals: true,
    },
  ],
};

export const typescriptRules = {
  '@typescript-eslint/consistent-type-imports': 'error',
  '@typescript-eslint/no-unused-vars': [
    'error',
    {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrors: 'none',
    },
  ],
  '@typescript-eslint/naming-convention': [
    'error',
    {
      selector: 'default',
      format: ['camelCase'],
    },
    {
      selector: 'typeLike',
      format: ['PascalCase'],
    },
    {
      selector: 'enum',
      format: ['PascalCase'],
    },
    {
      selector: 'enumMember',
      format: ['PascalCase'],
    },
    {
      selector: 'variable',
      format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
      leadingUnderscore: 'allow',
    },
    {
      selector: 'parameter',
      format: ['camelCase'],
      leadingUnderscore: 'allow',
    },
    {
      selector: 'property',
      format: null,
    },
    {
      selector: 'import',
      format: null,
    },
  ],
};

export const javascriptRules = {
  'no-restricted-syntax': [
    'error',
    {
      selector: 'CallExpression[callee.property.name=\'then\']',
      message: 'Use async/await em vez de .then() — convenção do time.',
    },
    {
      selector: 'CallExpression[callee.property.name=\'catch\']',
      message: 'Use async/await com try/catch em vez de .catch() — convenção do time.',
    },
    {
      selector: 'CallExpression[callee.property.name=\'finally\']',
      message: 'Use async/await com try/finally em vez de .finally() — convenção do time.',
    },
  ],
  'max-params': ['error', 4],
  'no-console': 'warn',
};

export const vueRules = {
  'vue/multi-word-component-names': 'off',
  'vue/html-self-closing': [
    'error',
    {
      html: {
        void: 'never',
        normal: 'never',
        component: 'always',
      },
      svg: 'always',
      math: 'always',
    },
  ],
  'vue/component-name-in-template-casing': [
    'error',
    'PascalCase',
    {
      registeredComponentsOnly: false,
    },
  ],
  'vue/html-indent': [
    'error',
    2,
    {
      attribute: 1,
      baseIndent: 1,
      closeBracket: 0,
      alignAttributesVertically: true,
    },
  ],
  'vue/max-attributes-per-line': [
    'error',
    {
      singleline: 4,
      multiline: 1,
    },
  ],
  'vue/object-property-newline': [
    'error',
    {
      allowAllPropertiesOnSameLine: true,
    },
  ],
  'vue/operator-linebreak': ['off'],
  'vue/quote-props': ['error', 'as-needed'],
  'vue/singleline-html-element-content-newline': ['off'],
  'vue/valid-v-slot': ['error', { allowModifiers: true }],
  'vue/max-len': [
    'error',
    {
      code: 120,
      ignoreUrls: true,
      ignoreHTMLAttributeValues: true,
    },
  ],
};
