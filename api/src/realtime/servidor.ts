/**
 * O TRANSPORTE DE TEMPO REAL.
 *
 * Socket.IO na MESMA porta da API, path `/realtime` (D-04). Nenhuma variável
 * de ambiente nova: `API_BASE` já descreve o endpoint.
 *
 * REGRA R2 — a room é resolvida no HANDSHAKE, a partir do cookie de sessão.
 * O servidor NUNCA aceita um `subscribe(familiaId)` vindo do cliente: seria um
 * bypass do isolamento que a REST garante. O socket é uma nova superfície de
 * tenant, e ela fecha aqui, uma vez, antes de qualquer evento trafegar.
 *
 * REGRA R3 — o servidor emite invalidação, nunca estado derivado. Ver
 * `./emissor.ts`.
 */
import type { Server as ServidorHttp } from 'node:http';

import cookie from 'cookie';
import { Server as ServidorSocket } from 'socket.io';

import { ambiente } from '../config/ambiente';
import { db } from '../db';
import type { ContextoDaSessao } from '../modulos/familia/sessao-servico';
import {
  COOKIE_SESSAO,
  resolverSessaoPorToken,
} from '../modulos/familia/sessao-servico';

export const CAMINHO_REALTIME = '/realtime';
export const EVENTO_INVALIDACAO = 'recurso.alterado';

/** O nome da room. Uma por família — não existe outra granularidade. */
export function salaDaFamilia(familiaId: string): string {
  return `familia:${familiaId}`;
}

declare module 'socket.io' {
  interface Socket {
    contexto?: ContextoDaSessao;
  }
}

let io: ServidorSocket | null = null;

export function criarServidorDeTempoReal(http: ServidorHttp): ServidorSocket {
  io = new ServidorSocket(http, {
    path: CAMINHO_REALTIME,
    cors: {
      origin: ambiente.ORIGEM_WEB,
      credentials: true,
    },
  });

  // ── HANDSHAKE ────────────────────────────────────────────────────────────
  // Tudo que decide tenant acontece aqui. Depois desta função, a família do
  // socket é imutável e o cliente não tem como influenciá-la.
  io.use(async (socket, proximo) => {
    try {
      const cabecalho = socket.handshake.headers.cookie ?? '';
      const cookies = cookie.parse(cabecalho);
      const contexto = await resolverSessaoPorToken(db, cookies[COOKIE_SESSAO]);

      if (!contexto) {
        proximo(new Error('sessao_ausente'));
        return;
      }

      socket.contexto = contexto;
      proximo();
    } catch (erro) {
      proximo(erro as Error);
    }
  });

  io.on('connection', (socket) => {
    const contexto = socket.contexto;
    if (!contexto) {
      // Não deveria acontecer: o middleware acima já barrou. Se acontecer,
      // desconecta em vez de deixar um socket sem família na rede.
      socket.disconnect(true);
      return;
    }

    // A única entrada em room do sistema inteiro.
    void socket.join(salaDaFamilia(contexto.familiaId));

    // O cliente pode PERGUNTAR quem ele é; não pode DIZER quem ele é.
    socket.on('sessao', (responder?: (dados: unknown) => void) => {
      if (typeof responder === 'function') {
        responder({
          membroId: contexto.membroId,
          familiaId: contexto.familiaId,
          sala: salaDaFamilia(contexto.familiaId),
        });
      }
    });
  });

  return io;
}

export function servidorDeTempoReal(): ServidorSocket {
  if (!io) throw new Error('servidor de tempo real não foi criado');
  return io;
}

export async function fecharTempoReal(): Promise<void> {
  if (!io) return;
  await io.close();
  io = null;
}
