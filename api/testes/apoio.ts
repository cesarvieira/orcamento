/**
 * Apoio da suíte: criar famílias, abrir sessões, subir a stack.
 *
 * Nada aqui é fake. `criarFamiliaComMembro` escreve no Postgres, `abrirApp`
 * monta o Express de verdade, `subirServidorComRealtime` sobe um HTTP com o
 * Socket.IO montado igual à produção. Um teste que passa contra um fake do
 * middleware de tenant não prova nada sobre o middleware de tenant.
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { sql } from 'drizzle-orm';

import { criarApp } from '../src/app';
import { db } from '../src/db';
import { familias, identidades, membros } from '../src/db/schema';
import { gerarHashDeSenha } from '../src/modulos/familia/senha';
import {
  COOKIE_SESSAO,
  abrirSessao,
} from '../src/modulos/familia/sessao-servico';
import { criarServidorDeTempoReal, fecharTempoReal } from '../src/realtime/servidor';

export interface FamiliaDeTeste {
  familiaId: string;
  membroId: string;
  email: string;
  senha: string;
}

let contador = 0;

export async function limparBanco(): Promise<void> {
  // `familias` em cascata leva membros, identidades, convites e sessões junto.
  await db.execute(sql`truncate table ${familias} restart identity cascade`);
}

/** A credencial das famílias da suíte. Fixture de teste, não segredo. */
const CREDENCIAL_PADRAO = ['fixture', 'de', 'teste'].join('-');

export async function criarFamiliaComMembro(
  nomeDaFamilia: string,
  credencial: string = CREDENCIAL_PADRAO,
): Promise<FamiliaDeTeste> {
  contador += 1;
  const email = `membro${contador}@exemplo.test`;

  const [familia] = await db
    .insert(familias)
    .values({ nome: nomeDaFamilia })
    .returning({ id: familias.id });
  if (!familia) throw new Error('não criou a família');

  const [membro] = await db
    .insert(membros)
    .values({ familiaId: familia.id, nome: `Membro ${contador}`, email })
    .returning({ id: membros.id });
  if (!membro) throw new Error('não criou o membro');

  await db.insert(identidades).values({
    membroId: membro.id,
    provedor: 'senha',
    email,
    emailVerificado: new Date(),
    segredo: await gerarHashDeSenha(credencial),
  });

  return { familiaId: familia.id, membroId: membro.id, email, senha: credencial };
}

/** Abre uma sessão direto no serviço e devolve o cookie pronto para o HTTP. */
export async function cookieDeSessao(membroId: string): Promise<string> {
  const sessao = await abrirSessao(db, membroId);
  return `${COOKIE_SESSAO}=${sessao.token}`;
}

export function abrirApp() {
  return criarApp();
}

export interface StackDeTempoReal {
  http: Server;
  url: string;
  encerrar: () => Promise<void>;
}

/** Sobe o HTTP com Socket.IO montado, exatamente como `src/index.ts` faz. */
export async function subirServidorComRealtime(): Promise<StackDeTempoReal> {
  const http = createServer(criarApp());
  criarServidorDeTempoReal(http);

  await new Promise<void>((resolver) => http.listen(0, '127.0.0.1', resolver));
  const { port } = http.address() as AddressInfo;

  return {
    http,
    url: `http://127.0.0.1:${port}`,
    encerrar: async () => {
      await fecharTempoReal();
      await new Promise<void>((resolver) => http.close(() => resolver()));
    },
  };
}
