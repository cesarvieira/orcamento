/**
 * O SERVIÇO DE CONVITE — RN-01 e RN-03 (EF-01).
 *
 * `familiaId` chega aqui já resolvido pelo chamador a partir do TOKEN da
 * sessão (RN-01) — este arquivo não lê request nenhum, então não há como ele
 * aceitar `familiaId` de outro lugar por engano.
 *
 * RN-03: convite expira (`CONVITE_TTL_HORAS`, parâmetro de ambiente — D-07)
 * e é de uso único (`usadoEm`).
 */
import { and, desc, eq, gt, isNull } from 'drizzle-orm';

import { ambiente } from '../../config/ambiente';
import type { Db } from '../../db';
import { convites } from '../../db/schema';
import type { Convite } from '../../db/schema';
import { gerarToken } from './sessao-servico';

/** Erro de negócio do convite — não é exceção de infra. */
export class ErroDeConvite extends Error {
  constructor(
    public readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ErroDeConvite';
  }
}

export interface ConviteCriado {
  id: string;
  email: string;
  expiraEm: Date;
  /** Só para o chamador despachar o email — nunca sai numa resposta HTTP. */
  token: string;
}

export async function criarConvite(
  db: Db,
  familiaId: string,
  emailBruto: string,
): Promise<ConviteCriado> {
  const email = emailBruto.trim().toLowerCase();
  const token = gerarToken();
  const expiraEm = new Date(Date.now() + ambiente.CONVITE_TTL_HORAS * 3600_000);

  const [linha] = await db
    .insert(convites)
    .values({ familiaId, email, token, expiraEm })
    .returning();
  if (!linha) throw new Error('falha ao criar convite');

  return { id: linha.id, email: linha.email, expiraEm: linha.expiraEm, token };
}

/** RN-03: existe, não foi usado, não expirou. Lança `ErroDeConvite` no que faltar. */
export async function convitePendente(db: Db, token: string): Promise<Convite> {
  const [linha] = await db.select().from(convites).where(eq(convites.token, token)).limit(1);

  if (!linha) throw new ErroDeConvite('convite_nao_encontrado', 'Este convite não existe.');
  if (linha.usadoEm) throw new ErroDeConvite('convite_usado', 'Este convite já foi usado.');
  if (linha.expiraEm.getTime() < Date.now()) {
    throw new ErroDeConvite('convite_expirado', 'Este convite expirou.');
  }

  return linha;
}

export async function marcarConviteUsado(db: Db, conviteId: string): Promise<void> {
  await db.update(convites).set({ usadoEm: new Date() }).where(eq(convites.id, conviteId));
}

/**
 * EF01-MC-001: os convites PENDENTES da família — não usados e não
 * expirados (RN-03), do mais recente para o mais antigo. `familiaId` chega
 * já resolvido do TOKEN da sessão (RN-01), igual às demais funções deste
 * arquivo.
 */
export async function listarConvitesPendentes(db: Db, familiaId: string): Promise<Convite[]> {
  const agora = new Date();
  return db
    .select()
    .from(convites)
    .where(
      and(eq(convites.familiaId, familiaId), isNull(convites.usadoEm), gt(convites.expiraEm, agora)),
    )
    .orderBy(desc(convites.criadoEm));
}
