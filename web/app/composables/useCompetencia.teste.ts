/**
 * Smoke test do wiring de teste de `web/` (tarefa #107, história #63).
 *
 * NÃO é o teste de regressão que #104-rework/#105-rework vão escrever — é só
 * a prova de que `pnpm --filter @orcamento/web run teste` roda um composable
 * de verdade sob vitest+jsdom+@vue/test-utils e que o resultado entra na
 * contagem do gate (`GATE_TEST_EXECUTADOS`, via `scripts/contar-testes.mjs`).
 *
 * Monta um componente real (via `mount`, não chama o composable solto) de
 * propósito: é o MESMO caminho (`@vue/test-utils` + `jsdom`) que os testes de
 * `useRealtime`/extrato vão precisar, então esta suíte prova a infraestrutura
 * inteira, não só o runner.
 *
 * `useCompetencia` foi escolhido por ser simples e estável: nenhuma rede,
 * nenhum socket, só `useState` (Nuxt) + `computed` (Vue) — os dois já
 * cobertos por `testes/preparar-globais.ts`.
 */
import { defineComponent, h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { competenciaAtual } from '../utils/competencia';
import { useCompetencia } from './useCompetencia';

describe('useCompetencia', () => {
  it('inicia no mês corrente e navega com ir/anterior/seguinte', async () => {
    const Componente = defineComponent({
      setup() {
        return useCompetencia();
      },
      render() {
        return h('span', this.rotulo);
      },
    });

    const wrapper = mount(Componente);
    const vm = wrapper.vm as unknown as ReturnType<typeof useCompetencia>;

    // Estado compartilhado (useState) — garante ponto de partida conhecido
    // mesmo que outro teste desta suíte já tenha navegado.
    vm.voltarParaCorrente();

    expect(vm.competencia).toBe(competenciaAtual());
    expect(vm.ehMesCorrente).toBe(true);

    vm.seguinte();
    expect(vm.ehMesCorrente).toBe(false);

    vm.anterior();
    expect(vm.ehMesCorrente).toBe(true);

    vm.ir('2026-01');
    expect(vm.competencia).toBe('2026-01');

    // O DOM só reflete a mudança depois do próximo tick — checagem em
    // `wrapper.text()` prova que o composable está de fato ligado ao
    // template renderizado, não só ao valor bruto do ref.
    await nextTick();
    expect(wrapper.text()).toBe('Janeiro 2026');
  });
});
