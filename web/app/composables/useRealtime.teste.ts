/**
 * Prova da issue #104 (história #63): quando o MESMO componente Vue chama
 * `useRealtime` mais de uma vez — o caso real é `pages/index.vue`, que ouve
 * `lancamentos` via `useLancamentos({ aoInvalidar })` (que por dentro só
 * delega para `useRealtime`, ver o cabeçalho de `useLancamentos.ts`) e
 * `orcamento`/`contas` via `useRealtime` direto —, uma reconexão do socket
 * deve disparar **UM** resync por componente, não um por assinatura.
 *
 * Este teste chama `useRealtime` DUAS VEZES direto (em vez de uma vez direto
 * e uma via `useLancamentos`): `useLancamentos` só embrulha `useRealtime`
 * (nenhuma lógica de coalescência vive lá), e chamar direto evita simular
 * `useApi`/`$fetch`/`useRuntimeConfig` — infraestrutura de rede que esta
 * suíte não precisa para provar o comportamento de reconexão. O caminho
 * testado (duas chamadas de `useRealtime` na mesma `setup()`) é
 * byte-a-byte o que `useLancamentos` produziria de qualquer forma.
 *
 * O mock de `socket.io-client` simula o que acontece de verdade em produção:
 * as duas chamadas usam a MESMA url/path/opções (sem `forceNew`), então o
 * `socket.io-client` real as multiplexa no mesmo `Manager` — os dois
 * `connect` disparam no MESMO turno síncrono quando a conexão cai e volta.
 * É por isso que os testes abaixo disparam os dois `connect` em sequência
 * síncrona, sem `await` entre eles.
 */
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRealtime } from './useRealtime';

interface SocketFalso {
  on: (evento: string, cb: (...args: unknown[]) => void) => SocketFalso;
  close: () => void;
  emitir: (evento: string, ...args: unknown[]) => void;
}

const { socketsCriados, criarSocketFalso } = vi.hoisted(() => {
  const socketsCriados: SocketFalso[] = [];

  function criarSocketFalso(): SocketFalso {
    const ouvintes = new Map<string, Set<(...args: unknown[]) => void>>();
    const socket: SocketFalso = {
      on(evento, cb) {
        const grupo = ouvintes.get(evento) ?? new Set();
        grupo.add(cb);
        ouvintes.set(evento, grupo);
        return socket;
      },
      // Fake sem estado de conexão real: nada a fazer ao "fechar".
      close: () => undefined,
      emitir(evento, ...args) {
        for (const cb of ouvintes.get(evento) ?? []) cb(...args);
      },
    };
    return socket;
  }

  return { socketsCriados, criarSocketFalso };
});

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => {
    const s = criarSocketFalso();
    socketsCriados.push(s);
    return s;
  }),
}));

/** Monta um componente que assina `useRealtime` `n` vezes, cada uma com seu próprio `aoInvalidar`. */
function montarComponenteComAssinaturas(aoInvalidarPorAssinatura: (() => void)[]) {
  const Componente = defineComponent({
    setup() {
      for (const aoInvalidar of aoInvalidarPorAssinatura) {
        useRealtime({ aoInvalidar });
      }
      return () => h('div');
    },
  });
  return mount(Componente);
}

/** O socket falso criado pela n-ésima chamada de `useRealtime` desta suíte — sem non-null assertion no teste. */
function socketCriado(indice: number): SocketFalso {
  const socket = socketsCriados[indice];
  if (!socket) throw new Error(`esperava um socket falso no índice ${indice}, mock criou só ${socketsCriados.length}`);
  return socket;
}

beforeEach(() => {
  socketsCriados.length = 0;
});

describe('useRealtime — coalescência de reconexão por instância de componente (issue #104)', () => {
  it('duas assinaturas do MESMO componente produzem 1 resync por reconexão, não 2', () => {
    const aoInvalidarA = vi.fn();
    const aoInvalidarB = vi.fn();

    montarComponenteComAssinaturas([aoInvalidarA, aoInvalidarB]);

    expect(socketsCriados).toHaveLength(2);

    // A RECONEXÃO: os dois `connect` do mesmo componente, no mesmo turno
    // síncrono (ver cabeçalho do arquivo).
    socketCriado(0).emitir('connect');
    socketCriado(1).emitir('connect');

    const totalDeResyncs = aoInvalidarA.mock.calls.length + aoInvalidarB.mock.calls.length;
    expect(totalDeResyncs).toBe(1);
  });

  it('cada reconexão SEGUINTE ainda gera seu próprio resync — a coalescência não trava para sempre', async () => {
    const aoInvalidarA = vi.fn();
    const aoInvalidarB = vi.fn();

    montarComponenteComAssinaturas([aoInvalidarA, aoInvalidarB]);

    socketCriado(0).emitir('connect');
    socketCriado(1).emitir('connect');
    expect(aoInvalidarA.mock.calls.length + aoInvalidarB.mock.calls.length).toBe(1);

    // A janela de coalescência fecha numa microtarefa — depois dela, uma
    // NOVA queda e volta do socket é uma rodada nova, com seu próprio resync.
    await Promise.resolve();

    socketCriado(0).emitir('connect');
    socketCriado(1).emitir('connect');
    expect(aoInvalidarA.mock.calls.length + aoInvalidarB.mock.calls.length).toBe(2);
  });

  it('NÃO é uma dedupe global: componentes DIFERENTES continuam cada um com seu resync', () => {
    const aoInvalidarComponenteX = vi.fn();
    const aoInvalidarComponenteY = vi.fn();

    montarComponenteComAssinaturas([aoInvalidarComponenteX]);
    montarComponenteComAssinaturas([aoInvalidarComponenteY]);

    expect(socketsCriados).toHaveLength(2);

    // As reconexões dos DOIS componentes no mesmo turno síncrono — cada
    // componente é seu próprio grupo, então nenhum suprime o outro.
    socketCriado(0).emitir('connect');
    socketCriado(1).emitir('connect');

    expect(aoInvalidarComponenteX).toHaveBeenCalledTimes(1);
    expect(aoInvalidarComponenteY).toHaveBeenCalledTimes(1);
  });
});
