import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Config MÍNIMA do runner oficial de `web/` — vitest (tarefa #107, história
 * #63). `environment: 'jsdom'` porque composables sob teste podem depender de
 * lifecycle do Vue (`onMounted`/`onBeforeUnmount`) e precisam montar um
 * componente de verdade via `@vue/test-utils` — `jsdom` em vez de
 * `happy-dom` porque é o que a tarefa concorrente já validou funcionando
 * nesta mesma base (ver `testes/preparar-globais.ts`), e duas implementações
 * de DOM fake no mesmo workspace só criaria divergência sem ganho.
 *
 * Convenção de nome de arquivo (`*.teste.ts`, português) igual à de
 * `api/vitest.config.ts` — mesmo padrão do monorepo, suíte própria porque
 * cada workspace roda via `pnpm --filter @orcamento/web run teste`.
 */
export default defineConfig({
  // Fora do build do Nuxt, o vitest não conhece o alias `~` (→ `app/`, ver
  // `web/.nuxt/tsconfig.json` gerado por `nuxt prepare`). Sem isto, todo
  // composable que importa de `~/utils/...` ou `~/...` falha na resolução —
  // não é código quebrado, é só o vitest sem o mapa que o Nuxt injeta.
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./app', import.meta.url)),
      '@': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
  test: {
    include: ['app/**/*.teste.ts'],
    environment: 'jsdom',
    setupFiles: ['./testes/preparar-globais.ts'],
  },
});
