/**
 * As consultas do módulo `contas` (EF-02). Nenhum handler HTTP fala com o
 * banco diretamente — tudo passa por aqui, para que a checagem de tenant
 * (familiaId sempre no WHERE) e o cálculo do saldo derivado morem num lugar
 * só.
 */
import { and, eq, or, sql } from 'drizzle-orm';
import type { z } from 'zod';

import type { Db } from '../../db';
import { contas, lancamentos } from '../../db/schema';
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
 * EF-04 (tarefa #52) travava o termo dos lançamentos em 0 para `CREDITO`,
 * apontando explicitamente para esta EF (RN-19: "quem move é a fatura paga,
 * e a fatura é da EF-05 — ainda não construída"). **Este é o ponto que a
 * EF-05 estende, não duplica.**
 *
 * ⛔ Regra #0: RN-25 e D1 vêm de
 * `.preator/skills/negocio/faturas-e-ciclo-do-cartao/SKILL.md` — "Saldo do
 * cartão (exibido) = soma dos totais de TODAS as faturas em aberto do
 * cartão" —, citando `docs/especificacoes/EF-05-faturas.md` §2 como fonte
 * primária.
 *
 * O termo é um SOMATÓRIO COM SINAL — RN-17: transferência não é despesa,
 * então ela move as DUAS pontas (origem perde, destino ganha), nunca
 * decrementa "gasto":
 *   RECEITA                       → + valorCentavos
 *   DESPESA                       → − valorCentavos
 *   TRANSFERENCIA, esta é origem  → − valorCentavos
 *   TRANSFERENCIA, esta é destino → + valorCentavos
 *
 * Aplicado SEM EXCEÇÃO a `CREDITO` (a diferença para EF-04: antes havia um
 * `case when tipo = 'CREDITO' then 0 else (...)`, removido), o mesmo
 * somatório vira exatamente RN-25/D1: cada `DESPESA` (uma compra no cartão)
 * SUBTRAI, e o pagamento de fatura (RN-24 — uma `TRANSFERENCIA` com o cartão
 * como DESTINO) SOMA de volta. Como `saldoInicialCentavos` é sempre `null`
 * (coalescido a 0) numa `CREDITO` (EF-02 §1 — cartão não tem saldo inicial,
 * é dívida, não caixa), `saldoCentavos` de um cartão fica:
 *
 *   saldoCentavos = −Σ(fatura em aberto, D1: TODA fatura não paga)
 *
 * Negativo (ou zero, sem compra nenhuma) — nunca precisa de linha de
 * `Fatura` para estar correto: é a soma de TODO o histórico da conta, então
 * não fica desatualizado mesmo que ninguém tenha aberto a tela de fatura
 * (`modulos/faturas/servico.ts` usa isto para `limiteLivreCentavos`, RN-26).
 *
 * 🔀 FORK declarado ao humano: o comentário original de RN-18/RN-19 dizia
 * "não move o saldo da conta" para uma compra no crédito — eu leio isto como
 * "não move o CAIXA REAL de uma conta de débito/reserva" (o motivo real de
 * RN-18/RN-19: a compra no cartão não pode debitar duas vezes, na hora da
 * compra E na hora do pagamento). A skill de EF-05 (Regra #0, fonte
 * PRIMÁRIA e mais recente para esta EF) é explícita que o "saldo exibido do
 * cartão" DEVE refletir a fatura em aberto, que cresce a cada compra — dessa
 * forma o campo `saldoCentavos` de uma CREDITO passa a ter um significado
 * novo (dívida, não caixa) a partir desta tarefa. Se esta leitura estiver
 * errada, é decisão para reverter aqui, não em outro lugar.
 *
 * `::integer` no fim do `coalesce` é deliberado: `sum(integer)` no Postgres
 * devolve `bigint`, e o driver `pg` serializa `bigint` como STRING (evita
 * perda de precisão fora do range de um `number` do JS). Sem o cast,
 * `saldoCentavos` chegaria como `"31240"` em vez de `31240`.
 */
function expressaoSaldoDerivado() {
  const termoDosLancamentos = sql<number>`coalesce((
    select sum(
      case
        when ${lancamentos.tipo} = 'RECEITA' then ${lancamentos.valorCentavos}
        when ${lancamentos.tipo} = 'DESPESA' then -${lancamentos.valorCentavos}
        when ${lancamentos.tipo} = 'TRANSFERENCIA' and ${lancamentos.contaId} = ${contas.id}
          then -${lancamentos.valorCentavos}
        when ${lancamentos.tipo} = 'TRANSFERENCIA' and ${lancamentos.contaDestinoId} = ${contas.id}
          then ${lancamentos.valorCentavos}
        else 0
      end
    )
    from ${lancamentos}
    where ${lancamentos.contaId} = ${contas.id} or ${lancamentos.contaDestinoId} = ${contas.id}
  ), 0)::integer`;

  return sql<number>`(
    coalesce(${contas.saldoInicialCentavos}, 0) + (${termoDosLancamentos})
  )`;
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

/**
 * RN-07 — "o total 'em conta hoje' não soma reserva". Até a EF-05, isto
 * filtrava só `tipo !== 'RESERVA'` (incluindo `CREDITO`, cujo `saldoCentavos`
 * era sempre 0 — o filtro e a soma coincidiam por acidente). Agora que
 * `CREDITO` carrega uma dívida real (ver `expressaoSaldoDerivado` acima),
 * manter esse filtro subtrairia a fatura em aberto do "caixa de hoje" — uma
 * mudança de comportamento da RN-07 (EF-02, já mesclada) que NÃO é desta
 * tarefa decidir. Por isso o filtro passa a ser explícito `=== 'DEBITO'`:
 * numericamente idêntico ao de antes (CREDITO sempre contribuía 0), mas
 * agora correto por CONSTRUÇÃO, não por coincidência.
 */
function totalEmContaHoje(linhas: ContaLida[]): number {
  return linhas
    .filter(linha => linha.tipo === 'DEBITO')
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

/**
 * O único jeito de ler UMA conta — sempre filtrado por família (R1).
 * Exportado desde a EF-05: `modulos/faturas/servico.ts` reaproveita (não
 * duplica) para validar o cartão e para ler `saldoCentavos`/`limiteCentavos`
 * na hora de calcular `limiteLivreCentavos` (RN-26) e validar a conta
 * pagadora (D3).
 */
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
// RN-06 — conta com lançamento não pode ser excluída (EF-02 §2, tarefa #52)
// ---------------------------------------------------------------------------

/**
 * O ponto de checagem de RN-06. Cobre as DUAS pontas: `contaId` (a conta é a
 * origem/afetada de RECEITA, DESPESA ou TRANSFERENCIA) e `contaDestinoId` (a
 * conta é DESTINO de uma TRANSFERENCIA) — as duas colunas têm
 * `ON DELETE cascade` para `contas.id` (`db/schema.ts`), e o cascade existe
 * para o caso de a FAMÍLIA inteira ser apagada, não para liberar RN-06: quem
 * impede a exclusão indevida de UMA conta é esta checagem na aplicação,
 * antes do DELETE chegar ao banco.
 */
export async function contaPodeSerExcluida(db: Db, contaId: string): Promise<boolean> {
  const [linha] = await db
    .select({ id: lancamentos.id })
    .from(lancamentos)
    .where(or(eq(lancamentos.contaId, contaId), eq(lancamentos.contaDestinoId, contaId)))
    .limit(1);
  return !linha;
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
