/**
 * O SEED — a família de teste.
 *
 * Sem ele o gate de navegação cobre a tela de login e nada mais: neste produto
 * TUDO é área logada. As credenciais vêm de `PREATOR_TEST_USER` e
 * `PREATOR_TEST_PASS`, do AMBIENTE — nunca de arquivo versionado (D-07).
 *
 * É IDEMPOTENTE: rodar duas vezes não duplica nada. O serviço `migrate` do
 * compose o chama a cada subida.
 *
 * O ambiente semeado cobre 2 meses passados, o mês atual e lançamentos
 * futuros (parcelas + avulsos), com todos os tipos de dado que o produto
 * conhece — contas, orçamento, lançamentos, faturas, metas e fechamento.
 */
import { and, eq, isNull } from 'drizzle-orm';

import type { Db } from './index';
import { convites, familias, identidades, membros } from './schema';
import { gerarHashDeSenha } from '../modulos/familia/senha';
import { criarConvite } from '../modulos/familia/convites';
import { semeadorDeContas } from '../modulos/contas/semear';
import { semeadorDeOrcamento } from '../modulos/orcamento/semear';
import { semeadorDeMetas } from '../modulos/metas/semear';
import { semeadorDeLancamentos } from '../modulos/lancamentos/semear';
import { semeadorDeFaturas } from '../modulos/faturas/semear';
import { semeadorDeFechamento } from '../modulos/fechamento/semear';

/**
 * O contrato que cada módulo cumpre para semear os seus registros.
 * Implementado pela primeira vez em `modulos/contas/semear.ts` (EF-02).
 */
export interface SemeadorDeModulo {
  /** O módulo, para o log. Ex.: `contas`, `orcamento`. */
  modulo: string;
  semear: (db: Db, contexto: ContextoDoSeed) => Promise<number>;
}

/**
 * O que a plataforma entrega pronto a quem semeia depois dela.
 */
export interface ContextoDoSeed {
  familiaId: string;
  membroId: string;
  /** Segundo membro (Bruno) — autor alternativo de lançamentos (RN-16). */
  segundoMembroId: string;
  /** A competência de referência do seed, `AAAA-MM` (mês corrente). */
  competencia: string;
}

/**
 * Ordem importa: contas → orçamento → metas → lançamentos → faturas →
 * fechamento. Fechamento sela o mês −2 e tem de rodar por último.
 */
const SEMEADORES_DE_MODULO: SemeadorDeModulo[] = [
  semeadorDeContas,
  semeadorDeOrcamento,
  semeadorDeMetas,
  semeadorDeLancamentos,
  semeadorDeFaturas,
  semeadorDeFechamento,
];

const FAMILIA_DE_TESTE = 'Família de teste';
const EMAIL_BRUNO = 'bruno.seed@orcamento.local';
const EMAIL_CONVITE_PENDENTE = 'carla.convidada@exemplo.test';

function competenciaDeHoje(): string {
  const agora = new Date();
  const mes = String(agora.getUTCMonth() + 1).padStart(2, '0');
  return `${agora.getUTCFullYear()}-${mes}`;
}

async function garantirSegundoMembro(db: Db, familiaId: string): Promise<string> {
  const [existente] = await db
    .select({ id: membros.id })
    .from(membros)
    .where(eq(membros.email, EMAIL_BRUNO))
    .limit(1);
  if (existente) return existente.id;

  const [membro] = await db
    .insert(membros)
    .values({ familiaId, nome: 'Bruno', email: EMAIL_BRUNO })
    .returning({ id: membros.id });
  if (!membro) throw new Error('seed: não consegui criar o segundo membro (Bruno)');
  return membro.id;
}

async function garantirConvitePendente(db: Db, familiaId: string): Promise<boolean> {
  const [pendente] = await db
    .select({ id: convites.id })
    .from(convites)
    .where(
      and(
        eq(convites.familiaId, familiaId),
        eq(convites.email, EMAIL_CONVITE_PENDENTE),
        isNull(convites.usadoEm),
        isNull(convites.recusadoEm),
      ),
    )
    .limit(1);
  if (pendente) return false;
  await criarConvite(db, familiaId, EMAIL_CONVITE_PENDENTE);
  return true;
}

export async function semear(db: Db): Promise<string> {
  // Sem default no código: a credencial de teste vem do AMBIENTE (D-07). O
  // compose de produção traz o valor de desenvolvimento, num lugar só.
  const usuario = process.env.PREATOR_TEST_USER;
  const senha = process.env.PREATOR_TEST_PASS;
  if (!usuario || !senha) {
    throw new Error(
      'seed: PREATOR_TEST_USER e PREATOR_TEST_PASS precisam estar no ambiente — ' +
      'sem eles o gate de navegação não alcança a área logada, que aqui é o app inteiro.',
    );
  }
  const email = usuario.trim().toLowerCase();

  // ── família ──────────────────────────────────────────────────────────────
  const [existente] = await db
    .select({ id: membros.id, familiaId: membros.familiaId })
    .from(membros)
    .where(eq(membros.email, email))
    .limit(1);

  let familiaId: string;
  let membroId: string;

  if (existente) {
    familiaId = existente.familiaId;
    membroId = existente.id;
  } else {
    const [familia] = await db
      .insert(familias)
      .values({ nome: FAMILIA_DE_TESTE })
      .returning({ id: familias.id });
    if (!familia) throw new Error('seed: não consegui criar a família');
    familiaId = familia.id;

    // Membro ACEITO: já é membro, não um convite pendente. É o que faz a área
    // logada existir para o gate.
    const [membro] = await db
      .insert(membros)
      .values({ familiaId, nome: 'Ana', email })
      .returning({ id: membros.id });
    if (!membro) throw new Error('seed: não consegui criar o membro');
    membroId = membro.id;
  }

  const segundoMembroId = await garantirSegundoMembro(db, familiaId);
  const conviteNovo = await garantirConvitePendente(db, familiaId);

  // ── identidade (provedor senha) ──────────────────────────────────────────
  const [credencial] = await db
    .select({ id: identidades.id })
    .from(identidades)
    .where(eq(identidades.email, email))
    .limit(1);

  const segredo = await gerarHashDeSenha(senha);

  if (credencial) {
    await db
      .update(identidades)
      .set({ segredo, atualizadoEm: new Date() })
      .where(eq(identidades.id, credencial.id));
  } else {
    await db.insert(identidades).values({
      membroId,
      provedor: 'senha',
      email,
      emailVerificado: new Date(),
      segredo,
    });
  }

  // ── os módulos ───────────────────────────────────────────────────────────
  const contexto: ContextoDoSeed = {
    familiaId,
    membroId,
    segundoMembroId,
    competencia: competenciaDeHoje(),
  };

  const partes: string[] = [
    `família de teste + Ana (${email}) + Bruno · competência ${contexto.competencia}`,
  ];
  if (conviteNovo) partes.push(`convite pendente (${EMAIL_CONVITE_PENDENTE})`);

  for (const semeador of SEMEADORES_DE_MODULO) {
    const quantos = await semeador.semear(db, contexto);
    partes.push(`${semeador.modulo}: ${quantos}`);
  }

  return partes.join(' · ');
}
