/**
 * CRIAR A PRÓPRIA FAMÍLIA — RN-06 a RN-09 (EF-01).
 *
 * D-05 sempre previu que "o primeiro usuário cria a família e convida os
 * demais". O que este arquivo acrescenta é o caminho para esse primeiro
 * usuário existir sem convite — e as duas recusas que impedem esse caminho de
 * virar um atalho para dentro de família alheia:
 *
 *   RN-07  email que já é de um `Membro` não cadastra. O email identifica a
 *          PESSOA (RN-04), não a conta; deixar cadastrar de novo criaria a
 *          segunda pessoa que RN-04 existe para impedir.
 *   RN-08  email com convite PENDENTE não cadastra. O convite é o único
 *          caminho para entrar numa família existente, e o schema não admite
 *          um membro em duas famílias. A saída é do convidado: ele aceita, ou
 *          RECUSA — e recusar libera o email para criar a própria família.
 *
 * A identidade nasce NÃO confirmada (RN-06): o login a recusa até o email ser
 * provado. É por isso que a família criada aqui não é um buraco de segurança
 * mesmo antes da confirmação — ninguém entra nela.
 */
import { and, eq, isNull, gt } from 'drizzle-orm';

import { ambiente } from '../../config/ambiente';
import type { Db } from '../../db';
import { convites, familias, identidades, membros } from '../../db/schema';
import { gerarHashDeSenha } from './senha';
import { TENTATIVAS_MAXIMAS, gerarCodigo } from './sessao-servico';

/** Erro de negócio do cadastro — não é exceção de infra. */
export class ErroDeCadastro extends Error {
  constructor(
    public readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ErroDeCadastro';
  }
}

export interface DadosDoCadastro {
  familiaNome: string;
  nome: string;
  email: string;
  senha: string;
}

export interface CadastroCriado {
  membroId: string;
  familiaId: string;
  email: string;
  /** Só para o chamador montar o link — nunca sai numa resposta HTTP. */
  token: string;
}

/** RN-08: pendente é o que não foi usado, não foi recusado e não expirou. */
export async function convitePendenteParaEmail(db: Db, email: string) {
  const [linha] = await db
    .select({ id: convites.id })
    .from(convites)
    .where(
      and(
        eq(convites.email, email),
        isNull(convites.usadoEm),
        isNull(convites.recusadoEm),
        gt(convites.expiraEm, new Date()),
      ),
    )
    .limit(1);
  return linha ?? null;
}

export async function criarFamiliaComDono(
  db: Db,
  dados: DadosDoCadastro,
): Promise<CadastroCriado> {
  const email = dados.email.trim().toLowerCase();

  // RN-07 — o email já é de alguém.
  const [jaMembro] = await db
    .select({ id: membros.id })
    .from(membros)
    .where(eq(membros.email, email))
    .limit(1);
  if (jaMembro) {
    throw new ErroDeCadastro(
      'email_ja_cadastrado',
      'Este email já tem conta. Entre com ele, ou recupere o acesso.',
    );
  }

  // RN-08 — há convite esperando; o caminho é aceitar ou recusar.
  if (await convitePendenteParaEmail(db, email)) {
    throw new ErroDeCadastro(
      'convite_pendente',
      'Este email tem um convite de família esperando. Abra o email do convite ' +
      'para aceitar — ou recuse por lá, se preferir criar a sua própria família.',
    );
  }

  const token = gerarCodigo();
  const expiraEm = new Date(Date.now() + ambiente.CADASTRO_TTL_HORAS * 3600_000);
  const segredo = await gerarHashDeSenha(dados.senha);

  return db.transaction(async (tx) => {
    const [familia] = await tx
      .insert(familias)
      .values({ nome: dados.familiaNome.trim() })
      .returning();
    if (!familia) throw new Error('falha ao criar família');

    const [membro] = await tx
      .insert(membros)
      .values({ familiaId: familia.id, nome: dados.nome.trim(), email })
      .returning();
    if (!membro) throw new Error('falha ao criar membro');

    await tx.insert(identidades).values({
      membroId: membro.id,
      provedor: 'senha',
      email,
      // RN-06: nasce NÃO confirmada. É o que o login checa.
      emailVerificado: null,
      segredo,
      tokenConfirmacao: token,
      confirmacaoExpiraEm: expiraEm,
    });

    return { membroId: membro.id, familiaId: familia.id, email, token };
  });
}

/**
 * RN-09/RN-10/RN-11 — acha a identidade pelo EMAIL e só então confere o código.
 *
 * Mesma razão do convite: 6 dígitos colidem, então buscar pelo código seria
 * ambíguo; e é achando a linha primeiro que se consegue contar o erro. O
 * contador é o único obstáculo à força bruta.
 */
export async function confirmarCadastro(
  db: Db,
  email: string,
  codigo: string,
): Promise<string> {
  const alvo = email.trim().toLowerCase();
  const [identidade] = await db
    .select({
      id: identidades.id,
      membroId: identidades.membroId,
      codigo: identidades.tokenConfirmacao,
      expiraEm: identidades.confirmacaoExpiraEm,
      tentativas: identidades.tentativasConfirmacao,
    })
    .from(identidades)
    .where(and(eq(identidades.email, alvo), eq(identidades.provedor, 'senha')))
    .limit(1);

  if (!identidade || !identidade.codigo) {
    throw new ErroDeCadastro(
      'confirmacao_nao_encontrada',
      'Não há confirmação pendente para este email. Se já confirmou, é só entrar.',
    );
  }
  if (identidade.expiraEm && identidade.expiraEm.getTime() < Date.now()) {
    throw new ErroDeCadastro('confirmacao_expirada', 'Este código expirou. Crie a conta de novo.');
  }
  if (identidade.tentativas >= TENTATIVAS_MAXIMAS) {
    throw new ErroDeCadastro(
      'confirmacao_bloqueada',
      'Confirmação bloqueada por excesso de tentativas.',
    );
  }

  if (identidade.codigo !== codigo.trim()) {
    const tentativas = identidade.tentativas + 1;
    await db
      .update(identidades)
      .set({ tentativasConfirmacao: tentativas })
      .where(eq(identidades.id, identidade.id));
    if (tentativas >= TENTATIVAS_MAXIMAS) {
      throw new ErroDeCadastro(
        'confirmacao_bloqueada',
        'Código errado demais vezes — a confirmação foi bloqueada.',
      );
    }
    throw new ErroDeCadastro(
      'codigo_invalido',
      `Código incorreto. Restam ${TENTATIVAS_MAXIMAS - tentativas} tentativa(s).`,
    );
  }

  await db
    .update(identidades)
    .set({ emailVerificado: new Date(), tokenConfirmacao: null, confirmacaoExpiraEm: null })
    .where(eq(identidades.id, identidade.id));

  return identidade.membroId;
}
