/**
 * As consultas do módulo `metas` (EF-07) — o cofrinho, o CRUD e o ato de
 * guardar. Nenhum handler HTTP fala com o banco diretamente — tudo passa por
 * aqui, mesmo padrão de `modulos/contas/servico.ts` e `modulos/faturas/servico.ts`.
 *
 * ⛔ Regra #0: RN-33..RN-35 e D1..D5 vêm de
 * `.preator/skills/negocio/metas-e-reservas/SKILL.md`, citando
 * `docs/especificacoes/EF-07-metas.md` §1/§2 como fonte primária. Nada aqui
 * foi decidido de memória.
 *
 * Precedentes reaproveitados (nunca reescritos): `criarConta`/`buscarContaDaFamilia`/
 * `excluirConta` de `../contas/servico` (D3, RN-06 na exclusão) e `lerCompetencia`
 * de `../orcamento/servico` (RN-34/D1 — o teto). `modulos/contas/` e
 * `modulos/orcamento/` são IMPORTADAS aqui, nunca editadas — mesmo contrato que
 * `modulos/lastro/servico.ts` já segue com `listarContas`.
 */
import { and, eq, sql } from 'drizzle-orm';
import type { z } from 'zod';

import type { Db } from '../../db';
import { lancamentos, metas } from '../../db/schema';
import { buscarContaDaFamilia, criarConta, excluirConta } from '../contas/servico';
import { competenciaDaData } from '../lancamentos/dominio';
import { lerCompetencia } from '../orcamento/servico';
import type { EsquemaNovaMeta } from './esquemas';

export type EntradaDeMeta = z.infer<typeof EsquemaNovaMeta>;

export interface MetaLida {
  id: string;
  nome: string;
  alvoCentavos: number;
  contaReservaId: string;
  acumuladoCentavos: number;
}

// ---------------------------------------------------------------------------
// O acumulado DERIVADO — EF-07 §1: "soma das transferências para a conta
// RESERVA vinculada". Nunca materializado em coluna.
// ---------------------------------------------------------------------------

/**
 * Subquery correlacionada a `metas.contaReservaId` — só funciona dentro de um
 * `.select()` que tem `metas` no FROM (mesmo padrão de
 * `modulos/orcamento/servico.ts#expressaoGastoDerivado`).
 *
 * `::integer` no fim é deliberado: `sum(integer)` no Postgres devolve
 * `bigint`, e o driver `pg` serializa `bigint` como STRING — sem o cast,
 * `acumuladoCentavos` chegaria como `"31240"` em vez de `31240` (mesmo motivo
 * do cast em `contas/servico.ts#expressaoSaldoDerivado`).
 */
function expressaoAcumuladoDerivado() {
  return sql<number>`coalesce((
    select sum(${lancamentos.valorCentavos})
    from ${lancamentos}
    where ${lancamentos.contaDestinoId} = ${metas.contaReservaId}
      and ${lancamentos.tipo} = 'TRANSFERENCIA'
  ), 0)::integer`;
}

const colunasDeLeitura = {
  id: metas.id,
  nome: metas.nome,
  alvoCentavos: metas.alvoCentavos,
  contaReservaId: metas.contaReservaId,
  acumuladoCentavos: expressaoAcumuladoDerivado(),
};

export async function listarMetas(db: Db, familiaId: string): Promise<MetaLida[]> {
  return db
    .select(colunasDeLeitura)
    .from(metas)
    .where(eq(metas.familiaId, familiaId))
    .orderBy(metas.criadoEm);
}

/** O único jeito de ler UMA meta — sempre filtrado por família (R1). */
async function buscarMetaDaFamilia(db: Db, familiaId: string, id: string): Promise<MetaLida | undefined> {
  const [linha] = await db
    .select(colunasDeLeitura)
    .from(metas)
    .where(and(eq(metas.familiaId, familiaId), eq(metas.id, id)))
    .limit(1);
  return linha;
}

// ---------------------------------------------------------------------------
// CRUD — D3: criar meta cria, JUNTO, a conta RESERVA dela (saldo inicial 0).
// ---------------------------------------------------------------------------

export async function criarMeta(db: Db, familiaId: string, dados: EntradaDeMeta): Promise<MetaLida> {
  // D3 — a conta RESERVA nasce ANTES da meta, com saldo inicial 0. Reaproveita
  // `criarConta` (precedente declarado pela tarefa), nunca reescreve a
  // criação de conta aqui. Ícone/cor são só metadado visual da conta interna
  // do cofrinho — nenhuma fonte (EF-07, SKILL.md) define um valor para eles,
  // então usam o mesmo par de `modulos/contas/semear.ts` (conta RESERVA de
  // exemplo) por consistência visual, não por regra.
  //
  // ⚠️ Sem transação explícita cobrindo os dois INSERTs: `criarConta` é
  // tipado para aceitar só `Db` (nunca o `tx` de uma `db.transaction`), e
  // ampliar esse tipo para aceitar `tx` também exigiria editar
  // `contas/servico.ts` — fora do escopo desta tarefa (a costura declarada
  // permite IMPORTAR daquela pasta, nunca editá-la). O pior caso de uma falha
  // entre os dois INSERTs é uma conta RESERVA órfã (sem meta apontando para
  // ela) — nunca dado financeiro inconsistente, porque nenhuma transferência
  // acontece nesta função.
  const conta = await criarConta(db, familiaId, {
    tipo: 'RESERVA',
    nome: dados.nome,
    icone: 'cofre',
    cor: '#16a34a',
    saldoInicialCentavos: 0,
  });

  const [linha] = await db
    .insert(metas)
    .values({
      familiaId,
      nome: dados.nome,
      alvoCentavos: dados.alvoCentavos,
      contaReservaId: conta.id,
    })
    .returning({ id: metas.id });
  if (!linha) throw new Error('metas: não consegui criar o cofrinho');

  const criada = await buscarMetaDaFamilia(db, familiaId, linha.id);
  if (!criada) throw new Error('metas: cofrinho criado não apareceu na releitura');
  return criada;
}

/**
 * Edita nome e alvo. `contaReservaId` NUNCA muda aqui — o vínculo 1:1 (D3) é
 * imutável; não há caminho para "trocar a conta" de um cofrinho já criado.
 * `undefined` quando a meta não existe NESTA família — o handler decide o status.
 */
export async function atualizarMeta(
  db: Db,
  familiaId: string,
  id: string,
  dados: EntradaDeMeta,
): Promise<MetaLida | undefined> {
  const [linha] = await db
    .update(metas)
    .set({ nome: dados.nome, alvoCentavos: dados.alvoCentavos, atualizadoEm: new Date() })
    .where(and(eq(metas.familiaId, familiaId), eq(metas.id, id)))
    .returning({ id: metas.id });
  if (!linha) return undefined;

  return buscarMetaDaFamilia(db, familiaId, linha.id);
}

export type ResultadoDeExclusaoDeMeta = 'excluida' | 'nao_encontrada' | 'tem_lancamentos';

/**
 * Exclui o cofrinho excluindo a conta RESERVA vinculada — o `ON DELETE
 * cascade` de `metas.contaReservaId` (`db/schema.ts`) arrasta a linha de
 * `metas` junto, então não há um segundo DELETE aqui.
 *
 * A armadilha que a tarefa avisa: um cofrinho que já recebeu QUALQUER
 * transferência (guardou ≥ 1 vez) tem uma conta RESERVA com lançamento —
 * `excluirConta` (precedente declarado) já impõe RN-06 e devolve
 * `'tem_lancamentos'` nesse caso. Aqui isso vira erro de DOMÍNIO (o handler
 * responde 409), nunca uma exceção não tratada (nunca 500).
 */
export async function excluirMeta(
  db: Db,
  familiaId: string,
  id: string,
): Promise<ResultadoDeExclusaoDeMeta> {
  const existente = await buscarMetaDaFamilia(db, familiaId, id);
  if (!existente) return 'nao_encontrada';

  const resultado = await excluirConta(db, familiaId, existente.contaReservaId);
  if (resultado === 'tem_lancamentos') return 'tem_lancamentos';
  // 'nao_encontrada' aqui seria inconsistência (a FK garante a conta existir
  // enquanto a meta existe) — trata como "meta já não existe" em vez de 500.
  return 'excluida';
}

// ---------------------------------------------------------------------------
// Guardar — POST /metas/:id/guardar (RN-33, RN-34/D1, D2, D5).
// ---------------------------------------------------------------------------

export type ResultadoDeGuardar =
  | { tipo: 'ok'; meta: MetaLida } |
  { tipo: 'meta_nao_encontrada' } |
  { tipo: 'conta_origem_nao_encontrada' } |
  { tipo: 'conta_origem_invalida' } |
  { tipo: 'teto_excedido'; naoAlocadoCentavos: number };

export interface DadosDeGuardar {
  familiaId: string;
  autorMembroId: string;
  metaId: string;
  contaOrigemId: string;
  valorCentavos: number;
  /**
   * D6 (2026-08-29, tarefa #91) — a data do fato vem do CLIENTE, nunca do
   * relógio do servidor. `AAAA-MM-DD`.
   */
  data: string;
}

export async function guardar(db: Db, dados: DadosDeGuardar): Promise<ResultadoDeGuardar> {
  const { familiaId, autorMembroId, metaId, contaOrigemId, valorCentavos, data } = dados;

  const meta = await buscarMetaDaFamilia(db, familiaId, metaId);
  if (!meta) return { tipo: 'meta_nao_encontrada' };

  // D2/D5 — a conta de origem vem do CORPO, nunca inferida (precedente
  // literal: `pagaComContaId` em `modulos/faturas/esquemas.ts`).
  const contaOrigem = await buscarContaDaFamilia(db, familiaId, contaOrigemId);
  if (!contaOrigem) return { tipo: 'conta_origem_nao_encontrada' };

  // SKILL.md, glossário "Conta de origem": "a conta DEBITO de onde o dinheiro
  // sai ao guardar". Efeito colateral desejado: como a conta RESERVA de
  // QUALQUER meta é sempre tipo RESERVA (nunca DEBITO), esta checagem também
  // descarta por construção o caso "conta de origem igual à conta RESERVA de
  // destino" — edge case que o SKILL.md registra como não decidido em nenhuma
  // fonte ("não inventado aqui"); aqui ele simplesmente nunca ocorre.
  if (contaOrigem.tipo !== 'DEBITO') return { tipo: 'conta_origem_invalida' };

  // D6 (tarefa #91) — a competência segue a DATA DO CLIENTE (RN-15), nunca o
  // relógio do servidor. Era aqui que `hojeIso()` UTC produzia o defeito: das
  // 21h à meia-noite no fuso do Brasil, `hojeIso()` já devolvia o dia
  // seguinte, e no último dia do mês isso arrastava a competência inteira
  // para o mês seguinte — RN-34/D1 conferido contra o não alocado errado.
  const competencia = competenciaDaData(data);

  // RN-34/D1 — TETO: recusa guardar acima do naoAlocado da competência; com
  // naoAlocado ≤ 0, recusa QUALQUER valor, mesmo pequeno (D1, sem piso de
  // tolerância). Erro de domínio — o handler responde com um status de
  // conflito, nunca deixa a escrita seguir e nunca 500.
  const { naoAlocadoCentavos } = await lerCompetencia(db, familiaId, competencia);
  if (naoAlocadoCentavos <= 0 || valorCentavos > naoAlocadoCentavos) {
    return { tipo: 'teto_excedido', naoAlocadoCentavos };
  }

  // RN-33 — a TRANSFERENCIA de verdade, DEBITO → RESERVA (precedente:
  // `pagarFatura`, `modulos/faturas/servico.ts`). Um único INSERT: não há um
  // segundo passo que precise de transação explícita (a leitura seguinte é
  // só releitura, não escrita).
  await db.insert(lancamentos).values({
    familiaId,
    tipo: 'TRANSFERENCIA',
    descricao: `Guardado em ${meta.nome}`,
    valorCentavos,
    data,
    competencia,
    categoriaId: null,
    contaId: contaOrigemId,
    contaDestinoId: meta.contaReservaId,
    criadoPorMembroId: autorMembroId,
    serieParcelaId: null,
    numeroParcela: null,
  });

  const atualizada = await buscarMetaDaFamilia(db, familiaId, metaId);
  if (!atualizada) throw new Error('metas: cofrinho sumiu entre a transferência e a releitura');

  return { tipo: 'ok', meta: atualizada };
}
