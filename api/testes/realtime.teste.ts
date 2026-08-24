/**
 * R2 e R3 — o socket é uma superfície de tenant, e ela fecha no handshake.
 *
 * Nenhum gate da fábrica cobre WebSocket: o de navegação prova que a tela abre,
 * e um socket que entrega evento para a família errada deixa a página perfeita
 * e o console limpo. Por isso o tempo real tem prova própria, com DOIS clientes.
 */
import { io as conectarCliente, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { fecharBanco } from '../src/db';
import { emitirInvalidacao } from '../src/realtime/emissor';
import { CAMINHO_REALTIME } from '../src/realtime/servidor';
import {
  cookieDeSessao,
  criarFamiliaComMembro,
  limparBanco,
  subirServidorComRealtime,
  type FamiliaDeTeste,
  type StackDeTempoReal,
} from './apoio';

let stack: StackDeTempoReal;
let familiaA: FamiliaDeTeste;
let familiaB: FamiliaDeTeste;
let cookieA: string;
let cookieB: string;

const abertos: Socket[] = [];

function conectar(cookie: string | null): Socket {
  const socket = conectarCliente(stack.url, {
    path: CAMINHO_REALTIME,
    transports: ['websocket'],
    extraHeaders: cookie ? { Cookie: cookie } : {},
    reconnection: false,
  });
  abertos.push(socket);
  return socket;
}

function esperarConexao(socket: Socket): Promise<void> {
  return new Promise((resolver, rejeitar) => {
    socket.once('connect', () => resolver());
    socket.once('connect_error', (erro) => rejeitar(erro));
    setTimeout(() => rejeitar(new Error('timeout de conexão')), 8000);
  });
}

beforeAll(async () => {
  await limparBanco();
  familiaA = await criarFamiliaComMembro('Família A do socket');
  familiaB = await criarFamiliaComMembro('Família B do socket');
  cookieA = await cookieDeSessao(familiaA.membroId);
  cookieB = await cookieDeSessao(familiaB.membroId);
  stack = await subirServidorComRealtime();
});

afterAll(async () => {
  for (const s of abertos) s.close();
  await stack.encerrar();
  await fecharBanco();
});

describe('tempo real', () => {
  it('recusa o handshake sem cookie de sessão (R2)', async () => {
    const socket = conectar(null);
    await expect(esperarConexao(socket)).rejects.toThrow(/sessao_ausente/);
  });

  it('recusa o handshake com token inválido', async () => {
    const socket = conectar('orcamento_sessao=token-inventado');
    await expect(esperarConexao(socket)).rejects.toThrow(/sessao_ausente/);
  });

  it('a sala é resolvida no handshake, do cookie — não do cliente (R2)', async () => {
    const socket = conectar(cookieA);
    await esperarConexao(socket);

    const resposta = await new Promise<{ familiaId: string; sala: string }>((r) => {
      socket.emit('sessao', r);
    });

    expect(resposta.familiaId).toBe(familiaA.familiaId);
    expect(resposta.sala).toBe(`familia:${familiaA.familiaId}`);
  });

  it('a família B NÃO recebe o evento da família A', async () => {
    const socketA = conectar(cookieA);
    const socketB = conectar(cookieB);
    await Promise.all([esperarConexao(socketA), esperarConexao(socketB)]);

    const recebidoPorA: unknown[] = [];
    const recebidoPorB: unknown[] = [];
    socketA.on('recurso.alterado', (e) => recebidoPorA.push(e));
    socketB.on('recurso.alterado', (e) => recebidoPorB.push(e));

    emitirInvalidacao({
      familiaId: familiaA.familiaId,
      recurso: 'lancamentos',
      competencia: '2026-08',
      origemClienteId: 'cliente-da-ana',
    });

    await new Promise((r) => setTimeout(r, 400));

    expect(recebidoPorA).toHaveLength(1);
    expect(recebidoPorB).toHaveLength(0);
  });

  it('o evento carrega INVALIDAÇÃO, não estado derivado (R3)', async () => {
    const socket = conectar(cookieA);
    await esperarConexao(socket);

    const evento = await new Promise<Record<string, unknown>>((resolver) => {
      socket.once('recurso.alterado', resolver);
      setTimeout(() => {
        emitirInvalidacao({
          familiaId: familiaA.familiaId,
          recurso: 'contas',
          competencia: '2026-08',
          origemClienteId: 'cliente-do-bruno',
        });
      }, 50);
    });

    // O que o evento TEM.
    expect(Object.keys(evento).sort()).toEqual([
      'competencia',
      'origemClienteId',
      'recurso',
    ]);

    // O que ele NÃO tem, e não pode passar a ter: qualquer número derivado.
    // Mandar saldo, disponível ou lastro aqui obrigaria o front a conhecer a
    // fórmula do lastro — duas fontes da verdade para a regra que define o
    // produto.
    for (const proibido of ['saldo', 'disponivel', 'lastro', 'bloqueado', 'total']) {
      expect(evento).not.toHaveProperty(proibido);
    }
  });

  it('o `origemClienteId` viaja para o cliente descartar o próprio eco (R5)', async () => {
    const socket = conectar(cookieA);
    await esperarConexao(socket);

    const evento = await new Promise<{ origemClienteId: string | null }>((resolver) => {
      socket.once('recurso.alterado', resolver);
      setTimeout(() => {
        emitirInvalidacao({
          familiaId: familiaA.familiaId,
          recurso: 'lancamentos',
          origemClienteId: 'aba-42',
        });
      }, 50);
    });

    expect(evento.origemClienteId).toBe('aba-42');
  });
});
