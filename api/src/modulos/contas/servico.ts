/**
 * As consultas do módulo `contas` (EF-02). Nenhum handler HTTP fala com o
 * banco diretamente — tudo passa por aqui, para que a checagem de tenant
 * (familiaId sempre no WHERE) e o cálculo do saldo derivado morem num lugar
 * só.
 */
import { and, eq, sql } from 'drizzle-orm';
import type { z } from 'zod';

import type { Db } from '../../db';
import { contas } from '../../db/schema';
import type { EsquemaNovaConta } from './esquemas';

export type EntradaDeConta = z.infer<typeof EsquemaNovaConta>;

export interface ContaLida {
  id: string;
  tipo: 'DEBITO' | 'CREDITO' | 'RESERVA';
  nome: string;
  icone: string;
  cor: string;
  saldoInicialCentavos: number | null;
  limiteCentavos: number | null;
  diaFechamento: number | null;
  diaVencimento: number | null;
  saldoCentavos: number;
}

// ---------------------------------------------------------------------------
// O saldo DERIVADO — EF-02 §1: "saldoInicial mais os lançamentos da conta.
// Nunca materializado em coluna: é calculado na leitura."
// ---------------------------------------------------------------------------

/**
 * Não existe tabela de lançamentos ainda — ela é da EF-04. O termo da soma
 * fica FIXO em 0 até lá, mas a expressão já está montada como uma ADIÇÃO
 * (`saldoInicial + termoDosLancamentos`) de propósito: quando a EF-04 criar
 * `lancamentos`, ela troca só este termo por
 * `coalesce((select sum(valor_centavos) from lancamentos
 *   where lancamentos.conta_id = contas.id), 0)` — a leitura inteira não muda.
 */
function expressaoSaldoDerivado() {
  const termoDosLancamentosAindaNaoExiste = sql`0`; // @fundacao — EF-04 substitui isto (ver comentário acima).
  return sql<number>`(coalesce(${contas.saldoInicialCentavos}, 0) + (${termoDosLancamentosAindaNaoExiste}))`;
}

const colunasDeLeitura = {
  id: contas.id,
  tipo: contas.tipo,
  nome: contas.nome,
  icone: contas.icone,
  cor: contas.cor,
  saldoInicialCentavos: contas.saldoInicialCentavos,
  limiteCentavos: contas.limiteCentavos,
  diaFechamento: contas.diaFechamento,
  diaVencimento: contas.diaVencimento,
  saldoCentavos: expressaoSaldoDerivado(),
};

/** RN-07 — "o total 'em conta hoje' não soma reserva": soma tudo que não é RESERVA. */
function totalEmContaHoje(linhas: ContaLida[]): number {
  return linhas
    .filter(linha => linha.tipo !== 'RESERVA')
    .reduce((total, linha) => total + linha.saldoCentavos, 0);
}

export async function listarContas(
  db: Db,
  familiaId: string,
): Promise<{ contas: ContaLida[]; totalEmContaHojeCentavos: number }> {
  const linhas = await db
    .select(colunasDeLeitura)
    .from(contas)
    .where(eq(contas.familiaId, familiaId))
    .orderBy(contas.criadoEm);

  return { contas: linhas, totalEmContaHojeCentavos: totalEmContaHoje(linhas) };
}

/** O único jeito de ler UMA conta — sempre filtrado por família (R1). */
export async function buscarContaDaFamilia(
  db: Db,
  familiaId: string,
  id: string,
): Promise<ContaLida | undefined> {
  const [linha] = await db
    .select(colunasDeLeitura)
    .from(contas)
    .where(and(eq(contas.familiaId, familiaId), eq(contas.id, id)))
    .limit(1);
  return linha;
}

/**
 * Converte a entrada validada (união discriminada por `tipo`) nas colunas da
 * tabela — garantindo em código, e não só no CHECK do banco, que o campo do
 * OUTRO tipo vai como `null` (EF-02 §1).
 */
function valoresPersistidos(dados: EntradaDeConta) {
  const comuns = { tipo: dados.tipo, nome: dados.nome, icone: dados.icone, cor: dados.cor };

  if (dados.tipo === 'CREDITO') {
    return {
      ...comuns,
      saldoInicialCentavos: null,
      limiteCentavos: dados.limiteCentavos,
      diaFechamento: dados.diaFechamento,
      diaVencimento: dados.diaVencimento,
    };
  }

  return {
    ...comuns,
    saldoInicialCentavos: dados.saldoInicialCentavos,
    limiteCentavos: null,
    diaFechamento: null,
    diaVencimento: null,
  };
}

export async function criarConta(
  db: Db,
  familiaId: string,
  dados: EntradaDeConta,
): Promise<ContaLida> {
  const [linha] = await db
    .insert(contas)
    .values({ familiaId, ...valoresPersistidos(dados) })
    .returning({ id: contas.id });
  if (!linha) throw new Error('contas: não consegui criar a conta');

  const criada = await buscarContaDaFamilia(db, familiaId, linha.id);
  if (!criada) throw new Error('contas: conta criada não apareceu na releitura');
  return criada;
}

/** `undefined` quando a conta não existe NESTA família — nunca lança 403/404 aqui, é o handler que decide. */
export async function atualizarConta(
  db: Db,
  familiaId: string,
  id: string,
  dados: EntradaDeConta,
): Promise<ContaLida | undefined> {
  const [linha] = await db
    .update(contas)
    .set({ ...valoresPersistidos(dados), atualizadoEm: new Date() })
    .where(and(eq(contas.familiaId, familiaId), eq(contas.id, id)))
    .returning({ id: contas.id });
  if (!linha) return undefined;

  return buscarContaDaFamilia(db, familiaId, linha.id);
}

// ---------------------------------------------------------------------------
// RN-06 — conta com lançamento não pode ser excluída
// ---------------------------------------------------------------------------

/**
 * O ponto de checagem de RN-06.
 *
 * DECISÃO DE DESENHO (tarefa #39): a tabela `lancamentos` não existe ainda —
 * ela é da EF-04, e fingir que já a consulta seria inventar dado que não
 * existe. Em vez de deixar a regra comentada ou espalhada num `if` dentro da
 * rota, ela vira esta função nomeada, com a assinatura que a EF-04 vai manter:
 * hoje o corpo SEMPRE devolve `true` (nenhuma conta tem lançamento, porque
 * lançamento não existe), e a EF-04 troca só o corpo por
 * `!(await db.select().from(lancamentos).where(eq(lancamentos.contaId, contaId)).limit(1)).length`
 * — `excluirConta` e a rota que a chama não mudam uma linha.
 */
export async function contaPodeSerExcluida(_db: Db, _contaId: string): Promise<boolean> {
  return true;
}

export type ResultadoDeExclusao = 'excluida' | 'nao_encontrada' | 'tem_lancamentos';

export async function excluirConta(
  db: Db,
  familiaId: string,
  id: string,
): Promise<ResultadoDeExclusao> {
  const existente = await buscarContaDaFamilia(db, familiaId, id);
  if (!existente) return 'nao_encontrada';

  const podeExcluir = await contaPodeSerExcluida(db, id);
  if (!podeExcluir) return 'tem_lancamentos';

  await db.delete(contas).where(and(eq(contas.familiaId, familiaId), eq(contas.id, id)));
  return 'excluida';
}
