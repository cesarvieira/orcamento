/**
 * As consultas do módulo `orcamento` (EF-03). Nenhum handler HTTP fala com o
 * banco diretamente — tudo passa por aqui, para que a checagem de tenant
 * (familiaId sempre no WHERE) e as regras RN-09..RN-14/RN-40 morem num lugar
 * só. Mesmo padrão de `modulos/contas/servico.ts`.
 */
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { z } from 'zod';

import type { Db } from '../../db';
import { categorias, competencias, lancamentos, orcamentosMes, remanejamentos } from '../../db/schema';
import { calcularLastro, ratearDeficit } from '../lastro/servico';
import type { EsquemaNovaCategoria, EsquemaNovoRemanejamento } from './esquemas';

export type EntradaDeCategoria = z.infer<typeof EsquemaNovaCategoria>;
type EntradaDeRemanejamento = z.infer<typeof EsquemaNovoRemanejamento>;

/**
 * `Db` OU o `tx` de dentro de `db.transaction(async tx => ...)`. Derivado do
 * próprio tipo de `Db['transaction']` — não do tipo interno do drizzle — para
 * não recriar a assinatura de `PgTransaction` à mão. `criarRemanejamento`
 * roda as duas escritas de teto e o insert do histórico na MESMA transação
 * (RN-13/RN-14 são atômicas: nunca uma origem debitada sem destino
 * creditado), e por isso `tetoAtual`/`upsertTeto` precisam aceitar tanto o
 * `db` normal quanto o `tx`.
 */
type DbOuTx = Db | Parameters<Parameters<Db['transaction']>[0]>[0];

export interface CategoriaLida {
  id: string;
  nome: string;
  icone: string;
  cor: string;
}

interface OrcamentoMesLido {
  categoriaId: string;
  competencia: string;
  tetoCentavos: number;
}

interface CategoriaNaCompetenciaLida extends CategoriaLida {
  tetoCentavos: number;
  gastoCentavos: number;
  disponivelCentavos: number;
  /** EF-06 RN-29/RN-32 — ver `lerCompetencia` abaixo. */
  liberadoCentavos: number;
  bloqueadoCentavos: number;
}

export interface CompetenciaLida {
  competencia: string;
  rendaPrevistaCentavos: number;
  planejadoCentavos: number;
  recebidoCentavos: number;
  naoAlocadoCentavos: number;
  /** EF-06 §2 — caixaReal + limiteLivre dos cartões. Base do bloqueio de plano. */
  lastroCentavos: number;
  /** EF-06 §2 — max(0, restanteTotal − lastro). */
  deficitCentavos: number;
  /** EF-06 RN-30 — max(0, restanteTotal − déficit). O número em destaque da home. */
  liberadoTotalCentavos: number;
  categorias: CategoriaNaCompetenciaLida[];
}

interface RemanejamentoLido {
  id: string;
  competencia: string;
  categoriaOrigemId: string;
  categoriaDestinoId: string;
  valorCentavos: number;
  autorMembroId: string;
  criadoEm: string;
}

// ---------------------------------------------------------------------------
// Categoria — CRUD simples (EF-03 §3: "criar · apagar"; folha de editar).
// ---------------------------------------------------------------------------

const colunasDeCategoria = {
  id: categorias.id,
  nome: categorias.nome,
  icone: categorias.icone,
  cor: categorias.cor,
};

export async function listarCategorias(db: Db, familiaId: string): Promise<CategoriaLida[]> {
  return db
    .select(colunasDeCategoria)
    .from(categorias)
    .where(eq(categorias.familiaId, familiaId))
    .orderBy(categorias.criadoEm);
}

async function buscarCategoriaDaFamilia(
  db: Db,
  familiaId: string,
  id: string,
): Promise<CategoriaLida | undefined> {
  const [linha] = await db
    .select(colunasDeCategoria)
    .from(categorias)
    .where(and(eq(categorias.familiaId, familiaId), eq(categorias.id, id)))
    .limit(1);
  return linha;
}

export async function criarCategoria(
  db: Db,
  familiaId: string,
  dados: EntradaDeCategoria,
): Promise<CategoriaLida> {
  const [linha] = await db
    .insert(categorias)
    .values({ familiaId, ...dados })
    .returning({ id: categorias.id });
  if (!linha) throw new Error('orcamento: não consegui criar a categoria');

  const criada = await buscarCategoriaDaFamilia(db, familiaId, linha.id);
  if (!criada) throw new Error('orcamento: categoria criada não apareceu na releitura');
  return criada;
}

/** `undefined` quando a categoria não existe NESTA família — o handler decide o status. */
export async function atualizarCategoria(
  db: Db,
  familiaId: string,
  id: string,
  dados: EntradaDeCategoria,
): Promise<CategoriaLida | undefined> {
  const [linha] = await db
    .update(categorias)
    .set({ ...dados, atualizadoEm: new Date() })
    .where(and(eq(categorias.familiaId, familiaId), eq(categorias.id, id)))
    .returning({ id: categorias.id });
  if (!linha) return undefined;

  return buscarCategoriaDaFamilia(db, familiaId, linha.id);
}

export type ResultadoDeExclusaoDeCategoria = 'excluida' | 'nao_encontrada';

/**
 * Exclui a categoria e, em cascata (FK `onDelete: 'cascade'` em
 * `orcamentos_mes` e `remanejamentos`), o teto e o histórico que a citavam —
 * não é omissão: o que se apaga é o ENVELOPE, e nada faz sentido órfão dele.
 */
export async function excluirCategoria(
  db: Db,
  familiaId: string,
  id: string,
): Promise<ResultadoDeExclusaoDeCategoria> {
  const [linha] = await db
    .delete(categorias)
    .where(and(eq(categorias.familiaId, familiaId), eq(categorias.id, id)))
    .returning({ id: categorias.id });
  return linha ? 'excluida' : 'nao_encontrada';
}

// ---------------------------------------------------------------------------
// gasto — RN-10. Soma dos lançamentos DESPESA da categoria na competência
// (EF-04, tarefa #52). Subquery CORRELACIONADA a `categorias.id`: só funciona
// dentro do `.select()` de `lerCompetencia`, que tem `categorias` no FROM.
// ---------------------------------------------------------------------------

/**
 * `::integer` no fim é deliberado: `sum(integer)` no Postgres devolve
 * `bigint`, e o driver `pg` serializa `bigint` como STRING (evita perda de
 * precisão em valores que não cabem num `number` do JS). Sem o cast, todo
 * `gastoCentavos` chegaria como `"800"` em vez de `800` — quebrando toda
 * aritmética a jusante (RN-10) e o contrato (`z.number().int()`).
 */
function expressaoGastoDerivado(competencia: string) {
  return sql<number>`coalesce((
    select sum(${lancamentos.valorCentavos})
    from ${lancamentos}
    where ${lancamentos.categoriaId} = ${categorias.id}
      and ${lancamentos.tipo} = 'DESPESA'
      and ${lancamentos.competencia} = ${competencia}
  ), 0)::integer`;
}

// ---------------------------------------------------------------------------
// recebido — RN-39 (EF-04 §2), consumida por RN-11 aqui. Soma dos
// lançamentos RECEITA da competência inteira (não por categoria).
// ---------------------------------------------------------------------------

async function recebidoDaCompetencia(
  db: Db,
  familiaId: string,
  competencia: string,
): Promise<number> {
  const [linha] = await db
    // `::integer` — mesmo motivo do cast em `expressaoGastoDerivado` acima:
    // `sum(integer)` é `bigint`, e o `pg` devolveria string sem o cast.
    .select({ recebidoCentavos: sql<number>`coalesce(sum(${lancamentos.valorCentavos}), 0)::integer` })
    .from(lancamentos)
    .where(
      and(
        eq(lancamentos.familiaId, familiaId),
        eq(lancamentos.tipo, 'RECEITA'),
        eq(lancamentos.competencia, competencia),
      ),
    );
  return linha?.recebidoCentavos ?? 0;
}

// ---------------------------------------------------------------------------
// RendaPrevista — atributo da competência (EF-03 §1).
// ---------------------------------------------------------------------------

async function rendaPrevistaDaCompetencia(
  db: Db,
  familiaId: string,
  competencia: string,
): Promise<number> {
  const [linha] = await db
    .select({ rendaPrevistaCentavos: competencias.rendaPrevistaCentavos })
    .from(competencias)
    .where(and(eq(competencias.familiaId, familiaId), eq(competencias.competencia, competencia)))
    .limit(1);
  // Ausência de linha lê como renda prevista ZERO (ver comentário em db/schema.ts).
  return linha?.rendaPrevistaCentavos ?? 0;
}

export async function definirRendaPrevista(
  db: Db,
  familiaId: string,
  competencia: string,
  rendaPrevistaCentavos: number,
): Promise<{ competencia: string; rendaPrevistaCentavos: number }> {
  await db
    .insert(competencias)
    .values({ familiaId, competencia, rendaPrevistaCentavos })
    .onConflictDoUpdate({
      target: [competencias.familiaId, competencias.competencia],
      set: { rendaPrevistaCentavos, atualizadoEm: new Date() },
    });
  return { competencia, rendaPrevistaCentavos };
}

// ---------------------------------------------------------------------------
// OrcamentoMes — RN-09 (o teto do par categoria × competência) e RN-40
// (sem linha, teto zero).
// ---------------------------------------------------------------------------

/** O teto ATUAL de uma categoria numa competência — 0 se não há linha (RN-40). */
async function tetoAtual(db: DbOuTx, categoriaId: string, competencia: string): Promise<number> {
  const [linha] = await db
    .select({ tetoCentavos: orcamentosMes.tetoCentavos })
    .from(orcamentosMes)
    .where(and(eq(orcamentosMes.categoriaId, categoriaId), eq(orcamentosMes.competencia, competencia)))
    .limit(1);
  return linha?.tetoCentavos ?? 0;
}

/**
 * Upsert do teto — o ÚNICO ponto de escrita de `orcamentosMes`. Usado tanto
 * por `definirTeto` (entrada humana direta, sempre ≥ 0 — ver
 * `esquemas.ts#EsquemaDefinirTeto`) quanto por `criarRemanejamento` (RN-14:
 * o resultado da subtração PODE ficar negativo, e esta função não impõe piso
 * nenhum — quem decide o piso é quem chama).
 */
interface DadosDeTeto {
  familiaId: string;
  categoriaId: string;
  competencia: string;
  tetoCentavos: number;
}

async function upsertTeto(db: DbOuTx, dados: DadosDeTeto): Promise<void> {
  const { familiaId, categoriaId, competencia, tetoCentavos } = dados;
  await db
    .insert(orcamentosMes)
    .values({ familiaId, categoriaId, competencia, tetoCentavos })
    .onConflictDoUpdate({
      target: [orcamentosMes.categoriaId, orcamentosMes.competencia],
      set: { tetoCentavos, atualizadoEm: new Date() },
    });
}

export type ResultadoDeDefinirTeto = OrcamentoMesLido | 'categoria_nao_encontrada';

export async function definirTeto(db: Db, dados: DadosDeTeto): Promise<ResultadoDeDefinirTeto> {
  const { familiaId, categoriaId, competencia, tetoCentavos } = dados;
  const [categoria] = await db
    .select({ id: categorias.id })
    .from(categorias)
    .where(and(eq(categorias.id, categoriaId), eq(categorias.familiaId, familiaId)))
    .limit(1);
  if (!categoria) return 'categoria_nao_encontrada';

  await upsertTeto(db, dados);
  return { categoriaId, competencia, tetoCentavos };
}

// ---------------------------------------------------------------------------
// A leitura da competência — RN-10, RN-11, RN-40 num só documento.
// ---------------------------------------------------------------------------

export async function lerCompetencia(
  db: Db,
  familiaId: string,
  competencia: string,
): Promise<CompetenciaLida> {
  // LEFT JOIN + coalesce: categoria sem OrcamentoMes nesta competência
  // aparece com teto 0 (RN-40), em vez de sumir da lista. `gastoCentavos`
  // (RN-10) é a subquery correlacionada a `categorias.id` — só funciona
  // porque `categorias` está no FROM desta mesma consulta.
  const linhas = await db
    .select({
      id: categorias.id,
      nome: categorias.nome,
      icone: categorias.icone,
      cor: categorias.cor,
      tetoCentavos: sql<number>`coalesce(${orcamentosMes.tetoCentavos}, 0)`,
      gastoCentavos: expressaoGastoDerivado(competencia),
    })
    .from(categorias)
    .leftJoin(
      orcamentosMes,
      and(eq(orcamentosMes.categoriaId, categorias.id), eq(orcamentosMes.competencia, competencia)),
    )
    .where(eq(categorias.familiaId, familiaId))
    .orderBy(categorias.criadoEm);

  const disponiveisPorId = new Map(
    linhas.map(linha => [linha.id, linha.tetoCentavos - linha.gastoCentavos]),
  );

  // RN-11 — planejado = Σ tetos. Somado das MESMAS linhas já lidas acima
  // (RN-40 incluído: teto 0 de categoria sem OrcamentoMes soma 0).
  const planejadoCentavos = linhas.reduce((soma, c) => soma + c.tetoCentavos, 0);
  const recebidoCentavos = await recebidoDaCompetencia(db, familiaId, competencia);
  const rendaPrevistaCentavos = await rendaPrevistaDaCompetencia(db, familiaId, competencia);

  // ---------------------------------------------------------------------
  // EF-06 (tarefa #76) — lastro e rateio pró-rata do déficit. ⛔ Regra #0:
  // RN-27..RN-32 vêm de `.preator/skills/negocio/contas-e-lastro/SKILL.md`,
  // citando `docs/especificacoes/EF-06-lastro.md` §2 como fonte primária. O
  // front NUNCA recalcula isto (regra inviolável #4 do `.preator/CONTEXT.md`)
  // — por isso os três campos de topo e os dois por categoria viajam
  // PRONTOS nesta mesma leitura, nunca derivados de novo no cliente.
  // ---------------------------------------------------------------------
  const { lastroCentavos } = await calcularLastro(db, familiaId);
  const rateio = ratearDeficit(
    linhas.map(linha => ({
      id: linha.id,
      disponivelCentavos: disponiveisPorId.get(linha.id) ?? 0,
    })),
    lastroCentavos,
  );
  const rateioPorId = new Map(rateio.categorias.map(c => [c.id, c]));

  const categoriasLidas: CategoriaNaCompetenciaLida[] = linhas.map((linha) => {
    const disponivelCentavos = disponiveisPorId.get(linha.id) ?? 0;
    const rateado = rateioPorId.get(linha.id);
    return {
      ...linha,
      // RN-10 — disponível = teto − gasto. Negativo significa que estourou.
      disponivelCentavos,
      // RN-29/RN-32 — sempre presente: `ratearDeficit` devolve UMA entrada
      // por categoria de entrada, então o `?.` é só defesa, nunca esperado.
      bloqueadoCentavos: rateado?.bloqueadoCentavos ?? 0,
      liberadoCentavos: rateado?.liberadoCentavos ?? disponivelCentavos,
    };
  });

  return {
    competencia,
    rendaPrevistaCentavos,
    planejadoCentavos,
    recebidoCentavos,
    // RN-11 — não alocado = recebido − planejado. RN-12: renda prevista NÃO
    // entra aqui de propósito — só `recebido` (dinheiro que já entrou).
    naoAlocadoCentavos: recebidoCentavos - planejadoCentavos,
    lastroCentavos,
    deficitCentavos: rateio.deficitCentavos,
    liberadoTotalCentavos: rateio.liberadoTotalCentavos,
    categorias: categoriasLidas,
  };
}

// ---------------------------------------------------------------------------
// Remanejamento — RN-13 (altera só a competência corrente, registra o
// autor) e RN-14 (sem sobra, a API permite deixar negativo — não trava).
// ---------------------------------------------------------------------------

export type ResultadoDeRemanejamento =
  | { tipo: 'ok'; remanejamento: RemanejamentoLido } |
  { tipo: 'categoria_nao_encontrada' };

export interface DadosDeRemanejamento {
  familiaId: string;
  autorMembroId: string;
  competencia: string;
  entrada: EntradaDeRemanejamento;
}

export async function criarRemanejamento(
  db: Db,
  dados: DadosDeRemanejamento,
): Promise<ResultadoDeRemanejamento> {
  const { familiaId, autorMembroId, competencia } = dados;
  const { categoriaOrigemId, categoriaDestinoId, valorCentavos } = dados.entrada;

  const encontradas = await db
    .select({ id: categorias.id })
    .from(categorias)
    .where(
      and(
        eq(categorias.familiaId, familiaId),
        inArray(categorias.id, [categoriaOrigemId, categoriaDestinoId]),
      ),
    );
  // As duas precisam existir NESTA família (R1) — categoria de outra família
  // some do isolamento, exatamente como um id inexistente.
  if (encontradas.length !== 2) return { tipo: 'categoria_nao_encontrada' };

  return db.transaction(async (tx) => {
    const tetoOrigemAtual = await tetoAtual(tx, categoriaOrigemId, competencia);
    const tetoDestinoAtual = await tetoAtual(tx, categoriaDestinoId, competencia);

    // RN-14 — sem trava: a subtração pode deixar a origem negativa, e a API
    // segue em frente. É a mesma função de escrita de `definirTeto`, sem
    // piso nenhum imposto aqui.
    await upsertTeto(tx, {
      familiaId,
      categoriaId: categoriaOrigemId,
      competencia,
      tetoCentavos: tetoOrigemAtual - valorCentavos,
    });
    await upsertTeto(tx, {
      familiaId,
      categoriaId: categoriaDestinoId,
      competencia,
      tetoCentavos: tetoDestinoAtual + valorCentavos,
    });

    // RN-13 — só esta competência muda (as duas linhas de orcamentosMes
    // acima são FILTRADAS por competência); e o autor fica registrado aqui.
    const [linha] = await tx
      .insert(remanejamentos)
      .values({
        familiaId,
        competencia,
        categoriaOrigemId,
        categoriaDestinoId,
        valorCentavos,
        autorMembroId,
      })
      .returning();
    if (!linha) throw new Error('orcamento: não consegui registrar o remanejamento');

    return {
      tipo: 'ok' as const,
      remanejamento: {
        id: linha.id,
        competencia: linha.competencia,
        categoriaOrigemId: linha.categoriaOrigemId,
        categoriaDestinoId: linha.categoriaDestinoId,
        valorCentavos: linha.valorCentavos,
        autorMembroId: linha.autorMembroId,
        criadoEm: linha.criadoEm.toISOString(),
      },
    };
  });
}
