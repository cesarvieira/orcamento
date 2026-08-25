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
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ESCOPO — o seed é da plataforma, os dados são dos módulos.
 *
 * A EF-00 declara "nenhuma entidade de domínio": não existem ainda tabelas de
 * contas, categorias, lançamentos, faturas ou metas para semear. Por isso este
 * arquivo entrega o ARNÊS e a parte de acesso (família + membro aceito), e
 * abre um ponto de extensão explícito: cada EF de módulo acrescenta a sua
 * função em `SEMEADORES_DE_MODULO` e semeia de 1 a 3 registros seus.
 *
 * Registrar-se aqui é parte da Definition of Done de cada módulo — um módulo
 * que não semeia deixa o gate de navegação abrindo a sua tela vazia, e tela
 * vazia não prova render.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { eq } from 'drizzle-orm';

import type { Db } from './index';
import { familias, identidades, membros } from './schema';
import { gerarHashDeSenha } from '../modulos/familia/senha';

/** O contrato que cada módulo cumpre para semear os seus 1–3 registros. */
export interface SemeadorDeModulo {
  /** O módulo, para o log. Ex.: `contas`, `orcamento`. */
  modulo: string;
  semear: (db: Db, contexto: ContextoDoSeed) => Promise<number>;
}

/** O que a plataforma entrega pronto a quem semeia depois dela. */
export interface ContextoDoSeed {
  familiaId: string;
  membroId: string;
  /** A competência de referência do seed, `AAAA-MM`. */
  competencia: string;
}

/**
 * Os semeadores dos módulos. EF-02 a EF-08 acrescentam os seus aqui.
 * Vazio na EF-00 porque não há entidade de domínio ainda — e um seed que
 * fingisse ter é pior que um seed honesto e curto.
 */
export const SEMEADORES_DE_MODULO: SemeadorDeModulo[] = [];

const FAMILIA_DE_TESTE = 'Família de teste';

function competenciaDeHoje(): string {
  const agora = new Date();
  const mes = String(agora.getUTCMonth() + 1).padStart(2, '0');
  return `${agora.getUTCFullYear()}-${mes}`;
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
    competencia: competenciaDeHoje(),
  };

  const partes: string[] = [`família de teste + membro aceito (${email})`];

  for (const semeador of SEMEADORES_DE_MODULO) {
    const quantos = await semeador.semear(db, contexto);
    partes.push(`${semeador.modulo}: ${quantos}`);
  }

  if (SEMEADORES_DE_MODULO.length === 0) {
    partes.push(
      'nenhum módulo registrado — a EF-00 não tem entidade de domínio (ver SEMEADORES_DE_MODULO)',
    );
  }

  return partes.join(' · ');
}
