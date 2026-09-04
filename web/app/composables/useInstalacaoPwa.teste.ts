/**
 * Prova da tarefa #129 (história #127) — o composable do botão Instalar.
 *
 * O estado é em ESCOPO DE MÓDULO, não `useState` (ver o cabeçalho de
 * `useInstalacaoPwa.ts`), então os testes desta suíte compartilham o mesmo
 * `eventoDeInstalacao` de ponta a ponta — de propósito: é exatamente o
 * comportamento real (uma aba, um evento). Cada teste deixa o estado como
 * encontrou (via `appinstalled` ao fim de quem dispara o evento), para não
 * vazar para o próximo.
 *
 * `iniciarEscutaDeInstalacao()` só registra os listeners na PRIMEIRA chamada
 * (guarda interna) — chamá-la em todo teste é seguro e não duplica nada.
 */
import { defineComponent, h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { iniciarEscutaDeInstalacao, useInstalacaoPwa } from './useInstalacaoPwa';

/** Um `beforeinstallprompt` fake — a lib DOM do TypeScript não declara o tipo real. */
function criarEventoDeInstalacao() {
  const evento = new Event('beforeinstallprompt', { cancelable: true });
  return Object.assign(evento, {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' }),
  });
}

function montar() {
  const Componente = defineComponent({
    setup() {
      return useInstalacaoPwa();
    },
    render() {
      return h('span');
    },
  });
  const wrapper = mount(Componente);
  return wrapper.vm as unknown as ReturnType<typeof useInstalacaoPwa>;
}

describe('useInstalacaoPwa', () => {
  it('sem `beforeinstallprompt`, o botão não aparece', () => {
    iniciarEscutaDeInstalacao();
    const vm = montar();

    expect(vm.podeInstalar).toBe(false);
  });

  it('o `beforeinstallprompt` do navegador libera o botão', async () => {
    iniciarEscutaDeInstalacao();
    const vm = montar();

    window.dispatchEvent(criarEventoDeInstalacao());
    await nextTick();

    expect(vm.podeInstalar).toBe(true);

    // Devolve o estado como encontrou, para não vazar para o próximo teste.
    window.dispatchEvent(new Event('appinstalled'));
    await nextTick();
  });

  it('o `appinstalled` some com o botão, mesmo sem passar por `instalar()`', async () => {
    iniciarEscutaDeInstalacao();
    const vm = montar();

    window.dispatchEvent(criarEventoDeInstalacao());
    await nextTick();
    expect(vm.podeInstalar).toBe(true);

    window.dispatchEvent(new Event('appinstalled'));
    await nextTick();

    expect(vm.podeInstalar).toBe(false);
  });

  it('`instalar()` sem evento guardado não estoura', async () => {
    iniciarEscutaDeInstalacao();
    const vm = montar();

    expect(vm.podeInstalar).toBe(false);
    await expect(vm.instalar()).resolves.toBeUndefined();
  });

  it('`instalar()` chama `prompt()`, aguarda `userChoice`, e descarta o evento', async () => {
    iniciarEscutaDeInstalacao();
    const vm = montar();

    const evento = criarEventoDeInstalacao();
    window.dispatchEvent(evento);
    await nextTick();
    expect(vm.podeInstalar).toBe(true);

    await vm.instalar();

    expect(evento.prompt).toHaveBeenCalledTimes(1);
    expect(vm.podeInstalar).toBe(false);
  });
});
