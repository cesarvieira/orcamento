import { defineConfig } from 'vitest/config';

/**
 * Config MÍNIMA para testar composables que dependem de lifecycle do Vue
 * (`onMounted`/`onBeforeUnmount`) — precisa de DOM para montar um componente
 * de verdade (`@vue/test-utils`), daí `environment: 'jsdom'`.
 *
 * Convenção de nome de arquivo (`*.teste.ts`, português) igual à de
 * `api/vitest.config.ts` — mesmo padrão do monorepo, arquivo diferente
 * porque cada workspace roda sua própria suíte (`pnpm --filter @orcamento/web
 * run teste`).
 *
 * ⚠️ Este arquivo NÃO substitui a fiação real de Nuxt (`useRuntimeConfig`,
 * `useState`, auto-import de `vue`) — quem supre isso é
 * `testes/preparar-globais.ts`, carregado via `setupFiles` abaixo. É um
 * shim deliberadamente pequeno: o suficiente para exercitar o composable sob
 * teste, não uma reimplementação do runtime do Nuxt.
 */
export default defineConfig({
  test: {
    include: ['app/**/*.teste.ts'],
    environment: 'jsdom',
    setupFiles: ['./testes/preparar-globais.ts'],
  },
});
