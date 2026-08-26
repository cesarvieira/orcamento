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
import { TENTATIVAS_MAXIMAS, gerarCodigo } from './sessao-servico';

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
  const token = gerarCodigo();
  const expiraEm = new Date(Date.now() + ambiente.CONVITE_TTL_HORAS * 3600_000);

  const [linha] = await db
    .insert(convites)
    .values({ familiaId, email, token, expiraEm })
    .returning();
  if (!linha) throw new Error('falha ao criar convite');

  return { id: linha.id, email: linha.email, expiraEm: linha.expiraEm, token };
}

/**
 * RN-03/RN-10/RN-11 — acha o convite pelo EMAIL e só então confere o código.
 *
 * A ordem importa e não é estilo: um código de 6 dígitos colide entre linhas,
 * então buscar por ele seria ambíguo. Achar pelo email primeiro resolve isso
 * E é o que permite contar o erro na linha certa — sem contador, os ~1 milhão
 * de combinações caem em segundos.
 */
export async function convitePendente(
  db: Db,
  email: string,
  codigo: string,
): Promise<Convite> {
  const alvo = email.trim().toLowerCase();
  // O convite MAIS RECENTE daquele email, usado ou não. Filtrar `usadoEm` e
  // `recusadoEm` aqui seria mais curto, mas apagaria a diferença entre "já
  // encerrado" e "nunca existiu" — e é justamente essa diferença que dá a
  // mensagem certa a quem tenta (RN-03/RN-08). Um convite novo para o mesmo
  // email é sempre mais recente, então re-convidar continua funcionando.
  const [linha] = await db
    .select()
    .from(convites)
    .where(eq(convites.email, alvo))
    .orderBy(desc(convites.criadoEm))
    .limit(1);

  if (!linha) throw new ErroDeConvite('convite_nao_encontrado', 'Não há convite pendente para este email.');
  if (linha.usadoEm) {
    throw new ErroDeConvite('convite_usado', 'Este convite já foi aceito.');
  }
  if (linha.recusadoEm) {
    throw new ErroDeConvite(
      'convite_recusado',
      'Este convite foi recusado. Peça outro a quem te convidou, ou crie a sua própria família.',
    );
  }
  if (linha.expiraEm.getTime() < Date.now()) {
    throw new ErroDeConvite('convite_expirado', 'Este convite expirou.');
  }
  if (linha.tentativas >= TENTATIVAS_MAXIMAS) {
    throw new ErroDeConvite(
      'convite_bloqueado',
      'Este convite foi bloqueado por excesso de tentativas. Peça um novo a quem te convidou.',
    );
  }

  if (linha.token !== codigo.trim()) {
    const tentativas = linha.tentativas + 1;
    await db.update(convites).set({ tentativas }).where(eq(convites.id, linha.id));
    if (tentativas >= TENTATIVAS_MAXIMAS) {
      throw new ErroDeConvite(
        'convite_bloqueado',
        'Código errado demais vezes — este convite foi bloqueado. Peça um novo.',
      );
    }
    throw new ErroDeConvite(
      'codigo_invalido',
      `Código incorreto. Restam ${TENTATIVAS_MAXIMAS - tentativas} tentativa(s).`,
    );
  }

  return linha;
}

export async function marcarConviteUsado(db: Db, conviteId: string): Promise<void> {
  await db.update(convites).set({ usadoEm: new Date() }).where(eq(convites.id, conviteId));
}

/**
 * RN-08 — o convidado não quis. Encerra o convite SEM criar membro, e é isso
 * que libera o email para criar a própria família.
 */
export async function marcarConviteRecusado(db: Db, conviteId: string): Promise<void> {
  await db.update(convites).set({ recusadoEm: new Date() }).where(eq(convites.id, conviteId));
}

/**
 * EF01-MC-001: os convites PENDENTES da família — não usados, não recusados
 * (RN-08) e não expirados (RN-03), do mais recente para o mais antigo. `familiaId` chega
 * já resolvido do TOKEN da sessão (RN-01), igual às demais funções deste
 * arquivo.
 */
export async function listarConvitesPendentes(db: Db, familiaId: string): Promise<Convite[]> {
  const agora = new Date();
  return db
    .select()
    .from(convites)
    .where(
      and(
        eq(convites.familiaId, familiaId),
        isNull(convites.usadoEm),
        isNull(convites.recusadoEm),
        gt(convites.expiraEm, agora),
      ),
    )
    .orderBy(desc(convites.criadoEm));
}
