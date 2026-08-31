/**
 * SHIM DE AUTO-IMPORT do Nuxt, só para os testes de composable.
 *
 * Em produção, o Nuxt (via `unimport`) reescreve identificadores soltos como
 * `ref`, `computed` ou `useState` em imports de verdade — é por isso que
 * `app/composables/*.ts` nunca importa essas funções explicitamente. Fora do
 * build do Nuxt (aqui, sob vitest puro) esse identificador solto seria só um
 * `ReferenceError`: este arquivo supre exatamente o que os composables sob
 * teste hoje precisam, nada além disso — não é uma reimplementação do
 * runtime do Nuxt, é o menor shim que faz o composable sob teste rodar sem
 * alterar uma linha dele.
 *
 * Se um teste futuro exercitar um composable que usa outro auto-import ainda
 * não coberto aqui (ex.: `useRuntimeConfig`, `useRequestHeaders`), o sintoma
 * é um `ReferenceError` claro no próprio teste — a correção é ACRESCENTAR o
 * global que faltou, não reescrever o composable para importar explicitamente
 * algo que o Nuxt já auto-importa.
 */
import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';

Object.assign(globalThis, {
  ref,
  shallowRef,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
  getCurrentInstance,
});

/**
 * `useState` real (Nuxt/`#app`) é atrelado ao payload de SSR da requisição.
 * Aqui um cache module-level por chave já cobre o contrato que os
 * composables usam (estado compartilhado, inicializado uma vez): ler o valor
 * existente ou criar com o inicializador na primeira chamada.
 */
const estadosNuxt = new Map<string, ReturnType<typeof ref>>();
(globalThis as Record<string, unknown>).useState = (chave: string, inicial: () => unknown) => {
  if (!estadosNuxt.has(chave)) estadosNuxt.set(chave, ref(inicial()));
  return estadosNuxt.get(chave);
};
