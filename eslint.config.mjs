import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';
import jsonPlugin from '@eslint/json';
import vue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import nuxt from '@nuxt/eslint-plugin';
import { includeIgnoreFile } from '@eslint/config-helpers';
import { stylisticRules, typescriptRules, javascriptRules, vueRules } from './eslint.shared.rules.mjs';

// Um único config para o monorepo inteiro (api + web + packages/contrato +
// scripts) — não há turbo aqui, então não há por que espalhar em N apps como
// no projeto de referência (leilaodeumminuto). As REGRAS vêm de lá
// (eslint.shared.rules.mjs); a estrutura é a deste projeto, do tamanho dele.

const stylisticCustomized = stylistic.configs.customize({
  quoteProps: 'as-needed',
  commaDangle: 'always-multiline',
});

const gitignorePath = fileURLToPath(new URL('.gitignore', import.meta.url));
const gitignoreConfig = includeIgnoreFile(gitignorePath);

export default tseslint.config(
  gitignoreConfig,
  {
    // `preator/` é o submódulo da fábrica — lido, nunca escrito (AGENTS.md).
    // Não é gitignored (é um gitlink versionado), então precisa de ignore
    // explícito aqui; sem isso o lint tentaria "consertar" outro repositório.
    //
    // Saída gerada — `packages/contrato/gerar.mjs` é o único arquivo hand-written
    // ali dentro; o resto é output do OpenAPI e não se edita (D-03).
    ignores: ['preator/**', 'packages/contrato/src/gerado/**', 'packages/contrato/src/index.ts'],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strict,
      ...tseslint.configs.stylistic,
      stylisticCustomized,
    ],
    plugins: {
      '@stylistic': stylistic,
    },
    rules: {
      ...stylisticRules,
      ...typescriptRules,
      ...javascriptRules,
    },
  },
  {
    // Scripts de linha de comando — imprimir status é o trabalho deles, não
    // um esquecimento de debug.
    files: ['scripts/**/*.{ts,mjs}'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Log operacional legítimo (start/stop do processo, migration, erro não
    // tratado, auditoria de campo descartado pelo tenant) — não é debug
    // esquecido. Lista explícita, não um glob amplo: `no-console` continua de
    // pé em todo o resto de `api/src`, pegando o console.log acidental de
    // verdade.
    files: [
      'api/src/index.ts',
      'api/src/db/migrar.ts',
      'api/src/http/middleware/erro.ts',
      'api/src/http/middleware/tenant.ts',
      'api/src/openapi/emitir.ts',
      'packages/contrato/gerar.mjs',
    ],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['**/package.json'],
    language: 'json/json',
    plugins: { json: jsonPlugin },
    rules: {
      ...jsonPlugin.configs.recommended.rules,
    },
  },
  {
    // tsconfig admite comentário (JSONC); JSON estrito quebraria em todo `//`.
    files: ['**/tsconfig*.json'],
    language: 'json/jsonc',
    plugins: { json: jsonPlugin },
    rules: {
      ...jsonPlugin.configs.recommended.rules,
    },
  },
  {
    // `vue.configs['flat/recommended']` só é seguro dentro de um `files` escopado
    // a .vue — regras sem `files` próprio se espalhariam para package.json/etc.
    files: ['web/**/*.vue'],
    extends: [...vue.configs['flat/recommended']],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
      },
    },
    rules: {
      ...vueRules,
    },
  },
  {
    files: ['web/**/*.{ts,vue}'],
    plugins: { nuxt },
    rules: {
      'nuxt/prefer-import-meta': 'error',
      'nuxt/no-page-meta-runtime-values': 'error',
    },
  },
  {
    files: ['web/nuxt.config.ts'],
    plugins: { nuxt },
    rules: {
      'nuxt/nuxt-config-keys-order': 'error',
      'nuxt/no-nuxt-config-test-key': 'error',
    },
  },
);
