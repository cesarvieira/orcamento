/**
 * RECUPERAR A SENHA ESQUECIDA — RN-52 a RN-56 (EF-01).
 *
 * O fluxo é o mesmo de sempre nesta EF: um código de 6 dígitos por email,
 * validado junto do email e com teto de tentativas (RN-50/RN-51). O que muda
 * são três coisas que a decisão do humano fechou, e cada uma tem consequência
 * neste arquivo:
 *
 *   RN-53  o PEDIDO nunca revela se a conta existe. Por isso `pedirRecuperacao`
 *          devolve `null` em vez de lançar quando não há ninguém — quem responde
 *          igual nos dois casos é a rota, e ela não tem como escorregar se aqui
 *          não houver erro para propagar.
 *   RN-55  quem só tinha Google ganha a identidade de SENHA aqui, com segredo
 *          nulo. Não é uma porta aberta: `conferirSenha(…, null)` é `false`,
 *          então essa linha não loga enquanto a recuperação não terminar.
 *   RN-56  concluir a recuperação PROVA o email — o código chegou nele. Se a
 *          identidade ainda estava por confirmar (RN-46), sai confirmada.
 */
import { and, eq } from 'drizzle-orm';

import { ambiente } from '../../config/ambiente';
import type { Db } from '../../db';
import { familias, identidades, membros } from '../../db/schema';
import { gerarHashDeSenha } from './senha';
import { TENTATIVAS_MAXIMAS, gerarCodigo } from './sessao-servico';

/** Erro de negócio da recuperação — não é exceção de infra. */
export class ErroDeRecuperacao extends Error {
  constructor(
    public readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ErroDeRecuperacao';
  }
}

/** O que a rota precisa para despachar o email. Nunca sai numa resposta HTTP. */
export interface RecuperacaoPedida {
  email: string;
  familiaNome: string;
  codigo: string;
}

/**
 * Sorteia o código e o guarda na identidade de senha daquele email.
 *
 * Devolve `null` quando não há membro com aquele email — e isso NÃO é um erro
 * (RN-13). A rota responde a mesma coisa nos dois casos; se aqui lançasse,
 * bastaria alguém deixar o erro vazar para virar um oráculo de quem tem conta.
 */
export async function pedirRecuperacao(db: Db, email: string): Promise<RecuperacaoPedida | null> {
  const alvo = email.trim().toLowerCase();

  const [membro] = await db
    .select({ id: membros.id, familiaNome: familias.nome })
    .from(membros)
    .innerJoin(familias, eq(familias.id, membros.familiaId))
    .where(eq(membros.email, alvo))
    .limit(1);

  if (!membro) return null;

  const [identidadeDeSenha] = await db
    .select({ id: identidades.id })
    .from(identidades)
    .where(and(eq(identidades.email, alvo), eq(identidades.provedor, 'senha')))
    .limit(1);

  const codigo = gerarCodigo();
  const expiraEm = new Date(Date.now() + ambiente.RECUPERACAO_TTL_HORAS * 3600_000);

  if (identidadeDeSenha) {
    await db
      .update(identidades)
      .set({
        tokenRecuperacao: codigo,
        recuperacaoExpiraEm: expiraEm,
        // Pedir de novo zera o contador de propósito: o código anterior deixou
        // de valer, e é ele que estava sendo chutado.
        tentativasRecuperacao: 0,
      })
      .where(eq(identidades.id, identidadeDeSenha.id));
  } else {
    // RN-15 — só havia Google. A identidade de senha nasce aqui, sem segredo.
    // O email já foi provado pelo provedor, então ela nasce verificada: exigir
    // a confirmação de cadastro de quem entrou por Google seria pedir prova do
    // que já está provado.
    await db.insert(identidades).values({
      membroId: membro.id,
      provedor: 'senha',
      email: alvo,
      emailVerificado: new Date(),
      segredo: null,
      tokenRecuperacao: codigo,
      recuperacaoExpiraEm: expiraEm,
    });
  }

  return { email: alvo, familiaNome: membro.familiaNome, codigo };
}

/**
 * Troca a senha. Devolve o `membroId` — quem abre a sessão (e quem encerra as
 * antigas, RN-14) é a rota.
 */
export async function concluirRecuperacao(
  db: Db,
  email: string,
  codigo: string,
  senha: string,
): Promise<string> {
  const alvo = email.trim().toLowerCase();

  const [identidade] = await db
    .select({
      id: identidades.id,
      membroId: identidades.membroId,
      codigo: identidades.tokenRecuperacao,
      expiraEm: identidades.recuperacaoExpiraEm,
      tentativas: identidades.tentativasRecuperacao,
      emailVerificado: identidades.emailVerificado,
    })
    .from(identidades)
    .where(and(eq(identidades.email, alvo), eq(identidades.provedor, 'senha')))
    .limit(1);

  if (!identidade || !identidade.codigo) {
    throw new ErroDeRecuperacao(
      'recuperacao_nao_encontrada',
      'Não há recuperação pendente para este email. Peça uma nova.',
    );
  }
  if (identidade.expiraEm && identidade.expiraEm.getTime() < Date.now()) {
    throw new ErroDeRecuperacao('recuperacao_expirada', 'Este código expirou. Peça uma nova recuperação.');
  }
  if (identidade.tentativas >= TENTATIVAS_MAXIMAS) {
    throw new ErroDeRecuperacao(
      'recuperacao_bloqueada',
      'Recuperação bloqueada por excesso de tentativas. Peça uma nova.',
    );
  }

  if (identidade.codigo !== codigo.trim()) {
    const tentativas = identidade.tentativas + 1;
    await db
      .update(identidades)
      .set({ tentativasRecuperacao: tentativas })
      .where(eq(identidades.id, identidade.id));
    if (tentativas >= TENTATIVAS_MAXIMAS) {
      throw new ErroDeRecuperacao(
        'recuperacao_bloqueada',
        'Código errado demais vezes — a recuperação foi bloqueada. Peça uma nova.',
      );
    }
    throw new ErroDeRecuperacao(
      'codigo_invalido',
      `Código incorreto. Restam ${TENTATIVAS_MAXIMAS - tentativas} tentativa(s).`,
    );
  }

  await db
    .update(identidades)
    .set({
      segredo: await gerarHashDeSenha(senha),
      tokenRecuperacao: null,
      recuperacaoExpiraEm: null,
      tentativasRecuperacao: 0,
      // RN-16 — o código chegou no email, então o email está provado. Isso
      // desbloqueia quem tinha criado a família e perdido o email de
      // confirmação (RN-06): recuperar a senha também confirma.
      emailVerificado: identidade.emailVerificado ?? new Date(),
      // A confirmação pendente, se havia, morre junto: já não há o que provar.
      tokenConfirmacao: null,
      confirmacaoExpiraEm: null,
    })
    .where(eq(identidades.id, identidade.id));

  return identidade.membroId;
}
