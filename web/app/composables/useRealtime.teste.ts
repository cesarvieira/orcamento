/**
 * Prova da issue #104 (história #63) — REESCRITA após a rodada anterior ter
 * sido reprovada em revisão. O teste anterior mockava `socket.io-client`
 * inteiro e fabricava, dentro do mock, os dois `connect` disparando no MESMO
 * turno síncrono — uma simultaneidade que a biblioteca REAL não garante:
 * medido com ela de verdade, duas chamadas de `useRealtime()` NÃO
 * compartilham `Manager` por padrão (`s1.io === s2.io` é `false`), e mesmo
 * que compartilhassem, duas conexões físicas independentes reconectam cada
 * uma com seu próprio jitter aleatório.
 *
 * A correção mudou de arquitetura por causa disso: agora existe UM socket
 * FÍSICO por aba (`obterOuCriarSocket`, `useRealtime.ts`), reaproveitado por
 * toda chamada de `useRealtime` — a coalescência por componente entra DEPOIS,
 * para o caso de o mesmo componente registrar mais de um listener no mesmo
 * socket físico.
 *
 * Por isso este teste sobe um servidor Socket.IO REAL em loopback (`socket.io`,
 * já usado por `api/`) e deixa o `socket.io-client` REAL de ponta a ponta
 * decidir quando conecta/desconecta/reconecta — nada aqui mocka Manager ou
 * multiplexação. A única substituição é o auto-import do Nuxt
 * `useApiBasePublica` (rede — não é a lógica sob teste), apontado para o
 * servidor de teste.
 */
import { createServer, type Server as ServidorHttp } from 'node:http';
import type { AddressInfo } from 'node:net';
import { defineComponent, h } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import { Server as ServidorSocketIO, type Socket as SocketDoServidor } from 'socket.io';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRealtime } from './useRealtime';

const CAMINHO_REALTIME = '/realtime';

let servidorHttp: ServidorHttp;
let servidorIo: ServidorSocketIO;
let baseUrl: string;
let conexoesAceitas: SocketDoServidor[];

beforeEach(async () => {
  conexoesAceitas = [];
  servidorHttp = createServer();
  servidorIo = new ServidorSocketIO(servidorHttp, { path: CAMINHO_REALTIME });
  servidorIo.on('connection', (socket) => {
    conexoesAceitas.push(socket);
  });

  await new Promise<void>(resolve => servidorHttp.listen(0, '127.0.0.1', resolve));
  const endereco = servidorHttp.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${endereco.port}`;

  // Único substituto: a URL de conexão. `obterOuCriarSocket` chama isto para
  // decidir o `base` — aqui aponta para o servidor real desta suíte.
  vi.stubGlobal('useApiBasePublica', () => baseUrl);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  servidorIo.close();
  await new Promise<void>(resolve => servidorHttp.close(() => resolve()));
});

/** Espera o servidor de teste aceitar `quantidade` conexões (poll simples — sem depender de timers falsos). */
function aguardarConexoes(quantidade: number, timeoutMs = 4000): Promise<void> {
  return new Promise((resolve, reject) => {
    const inicio = Date.now();
    const intervalo = setInterval(() => {
      if (conexoesAceitas.length >= quantidade) {
        clearInterval(intervalo);
        resolve();
      } else if (Date.now() - inicio > timeoutMs) {
        clearInterval(intervalo);
        reject(new Error(`esperava ${quantidade} conexão(ões), servidor viu ${conexoesAceitas.length}`));
      }
    }, 10);
  });
}

/**
 * Derruba a conexão mais recente pelo lado do SERVIDOR e espera o
 * `socket.io-client` real reconectar por conta própria.
 *
 * ⚠️ `Socket#disconnect()` (nível socket.io) manda um pacote de desconexão
 * cuja `reason` do lado do cliente vira `"io server disconnect"` — e essa é
 * justamente a ÚNICA razão que o `socket.io-client` trata como "não
 * reconecte sozinho" (é a API para o servidor EXPULSAR alguém). Fechar o
 * transporte (`conn.close()`, nível engine.io) simula a queda de rede que a
 * issue #104 é sobre: o cliente vê `"transport close"` e reconecta sozinho.
 */
async function derrubarEEsperarReconexao(): Promise<void> {
  const antes = conexoesAceitas.length;
  const atual = conexoesAceitas[antes - 1];
  if (!atual) throw new Error('nenhuma conexão do servidor para derrubar');
  atual.conn.close();
  await aguardarConexoes(antes + 1, 6000);
  // Um instante para os listeners `on('connect', ...)` do lado do CLIENTE
  // rodarem depois que o servidor já viu a nova conexão.
  await new Promise(resolve => setTimeout(resolve, 50));
}

/** Monta um componente que assina `useRealtime` `n` vezes, cada uma com seu próprio `aoInvalidar`. */
function montarComponenteComAssinaturas(aoInvalidarPorAssinatura: (() => void)[]): VueWrapper {
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

describe('useRealtime — socket físico singleton por aba + coalescência de reconexão por componente (issue #104)', () => {
  it(
    'duas assinaturas (mesma base) abrem UM socket físico só — não dois',
    async () => {
      montarComponenteComAssinaturas([vi.fn(), vi.fn()]);

      await aguardarConexoes(1);
      // Espera um pouco mais: se a correção falhasse, uma SEGUNDA conexão
      // apareceria aqui (a assinatura B abrindo seu próprio socket).
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(conexoesAceitas).toHaveLength(1);
    },
    8000,
  );

  it(
    'uma reconexão do socket físico único produz 1 resync por COMPONENTE, não 1 por assinatura',
    async () => {
      const aoInvalidarA = vi.fn();
      const aoInvalidarB = vi.fn();
      montarComponenteComAssinaturas([aoInvalidarA, aoInvalidarB]);

      // A CONEXÃO INICIAL do mount já é, por si só, uma rodada de "conectou"
      // (R4 — "inclusive a primeira", ver cabeçalho de `useRealtime.ts`) e já
      // dispara seu próprio resync coalescido. Descarta essa primeira rodada
      // dos contadores: o que este teste mede é a reconexão FORÇADA abaixo.
      await aguardarConexoes(1);
      aoInvalidarA.mockClear();
      aoInvalidarB.mockClear();

      await derrubarEEsperarReconexao();

      const totalDeResyncs = aoInvalidarA.mock.calls.length + aoInvalidarB.mock.calls.length;
      expect(totalDeResyncs).toBe(1);
    },
    10000,
  );

  it(
    'NÃO é dedupe global: componentes DIFERENTES continuam cada um com seu próprio resync, mesmo compartilhando o socket físico',
    async () => {
      const aoInvalidarX = vi.fn();
      const aoInvalidarY = vi.fn();
      montarComponenteComAssinaturas([aoInvalidarX]);
      montarComponenteComAssinaturas([aoInvalidarY]);

      // Mesma base ⇒ mesmo socket físico — mas são componentes diferentes.
      // Descarta a rodada da conexão INICIAL (ver comentário no teste acima)
      // e mede só a reconexão forçada.
      await aguardarConexoes(1);
      aoInvalidarX.mockClear();
      aoInvalidarY.mockClear();

      await derrubarEEsperarReconexao();

      expect(aoInvalidarX).toHaveBeenCalledTimes(1);
      expect(aoInvalidarY).toHaveBeenCalledTimes(1);
    },
    10000,
  );

  it(
    'desmontar UM assinante não fecha o socket que outro assinante ainda usa',
    async () => {
      const wrapperDoPrimeiro = montarComponenteComAssinaturas([vi.fn()]);
      montarComponenteComAssinaturas([vi.fn()]);

      await aguardarConexoes(1);
      const conexaoCompartilhada = conexoesAceitas[0];

      wrapperDoPrimeiro.unmount();
      // Se o unmount fechasse o socket compartilhado incondicionalmente
      // (defeito que a issue #104 pede para evitar), o servidor veria esta
      // conexão cair aqui.
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(conexaoCompartilhada?.connected).toBe(true);
    },
    8000,
  );
});
