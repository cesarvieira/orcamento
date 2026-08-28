/**
 * As consultas do módulo `faturas` (EF-05). Nenhum handler HTTP fala com o
 * banco diretamente — tudo passa por aqui, para que a checagem de tenant
 * (familiaId sempre no WHERE) e o ciclo (RN-23) morem num lugar só. Mesmo
 * padrão de `modulos/contas/servico.ts` e `modulos/lancamentos/servico.ts`.
 *
 * ⛔ Regra #0: RN-23..RN-26 e D1 vêm de
 * `.preator/skills/negocio/faturas-e-ciclo-do-cartao/SKILL.md`, citando
 * `docs/especificacoes/EF-05-faturas.md` §1/§2 como fonte primária.
 *
 * ⚠️ Duas armadilhas do protótipo (EF-05 §4) — NÃO copiadas aqui:
 *   1. Pagar NÃO reatribui lançamentos: `pagarFatura` só faz um INSERT (a
 *      transferência); nunca um UPDATE em `lancamentos.contaId`.
 *   2. O total de cada fatura é a soma por CICLO (RN-23, `dominio.ts`), nunca
 *      pelo mês civil.
 *
 * O AGREGADO de "fatura em aberto" (D1 — Σ de TODA fatura não paga) não
 * depende de nenhuma linha de `faturas` existir: `limiteLivreCentavos` é lido
 * do `saldoCentavos` DERIVADO da própria conta CREDITO
 * (`modulos/contas/servico.ts#expressaoSaldoDerivado`, estendido por esta EF
 * — é o ponto que já existia, travado em 0, apontando para cá). Esse saldo é
 * a soma de TODA DESPESA (−) e TODO pagamento (+) já lançados na conta,
 * então nunca fica desatualizado mesmo que a família passe meses sem abrir a
 * tela de fatura — ao contrário das linhas de `faturas`, que só existem
 * depois de materializadas por `garantirFaturaDoCiclo` (find-or-create, sob
 * demanda) e servem só para AGRUPAR a exibição em ciclos (itens, total por
 * ciclo, datas, pagamento), nunca para a soma agregada.
 */
import { and, asc, eq, ne } from 'drizzle-orm';

import type { Db } from '../../db';
import { faturas, lancamentos, seriesParcelas } from '../../db/schema';
import { buscarContaDaFamilia } from '../contas/servico';
import {
  abreEmDoCiclo,
  fechaEmDoCiclo,
  hojeIso,
  statusDoCiclo,
  type StatusFatura,
  venceEmDoCiclo,
} from './dominio';

type DbOuTx = Db | Parameters<Parameters<Db['transaction']>[0]>[0];
type FaturaDb = typeof faturas.$inferSelect;

/**
 * Não exportado de propósito (o knip reprova export sem consumidor fora do
 * arquivo): quem lê fatura de fora consome `FaturasDoCartaoLidas` (a raiz),
 * não este tipo aninhado.
 */
interface ItemDeFaturaLido {
  id: string;
  descricao: string;
  valorCentavos: number;
  data: string;
  categoriaId: string | null;
  numeroParcela: number | null;
  quantidadeParcelas: number | null;
}

/** Mesmo motivo do comentário acima — aninhado dentro de `FaturasDoCartaoLidas.faturas`. */
interface FaturaLida {
  id: string;
  contaId: string;
  abreEm: string;
  fechaEm: string;
  venceEm: string;
  status: StatusFatura;
  totalCentavos: number;
  pagaEm: string | null;
  pagaComContaId: string | null;
  itens: ItemDeFaturaLido[];
}

export interface FaturasDoCartaoLidas {
  contaId: string;
  limiteCentavos: number | null;
  limiteLivreCentavos: number | null;
  faturas: FaturaLida[];
}

interface DespesaBruta {
  id: string;
  descricao: string;
  valorCentavos: number;
  data: string;
  categoriaId: string | null;
  numeroParcela: number | null;
  quantidadeParcelas: number | null;
}

// ---------------------------------------------------------------------------
// RN-23 — agrupar as DESPESAS do cartão por ciclo. Só DESPESA entra na conta
// de uma fatura (o item da tela, EF-05 §3/mockup `itensFatura`): um
// pagamento é `TRANSFERENCIA` (RN-24) e não é "item comprado" nenhum — se
// fosse somado aqui pela DATA (hoje), contaminaria o total do ciclo CORRENTE
// com o valor de um pagamento que quita o ciclo ANTERIOR.
// ---------------------------------------------------------------------------

async function despesasDoCartao(
  db: DbOuTx,
  familiaId: string,
  contaId: string,
): Promise<DespesaBruta[]> {
  const linhas = await db
    .select({
      id: lancamentos.id,
      descricao: lancamentos.descricao,
      valorCentavos: lancamentos.valorCentavos,
      data: lancamentos.data,
      categoriaId: lancamentos.categoriaId,
      numeroParcela: lancamentos.numeroParcela,
      quantidadeParcelas: seriesParcelas.quantidade,
    })
    .from(lancamentos)
    .leftJoin(seriesParcelas, eq(lancamentos.serieParcelaId, seriesParcelas.id))
    .where(
      and(
        eq(lancamentos.familiaId, familiaId),
        eq(lancamentos.contaId, contaId),
        eq(lancamentos.tipo, 'DESPESA'),
      ),
    );

  return linhas.map(l => ({ ...l, quantidadeParcelas: l.quantidadeParcelas ?? null }));
}

function agruparPorFechaEm(
  diaFechamento: number,
  despesas: DespesaBruta[],
): Map<string, DespesaBruta[]> {
  const grupos = new Map<string, DespesaBruta[]>();
  for (const despesa of despesas) {
    const fechaEm = fechaEmDoCiclo(diaFechamento, despesa.data);
    const grupo = grupos.get(fechaEm);
    if (grupo) grupo.push(despesa);
    else grupos.set(fechaEm, [despesa]);
  }
  return grupos;
}

function paraItem(despesa: DespesaBruta): ItemDeFaturaLido {
  return {
    id: despesa.id,
    descricao: despesa.descricao,
    valorCentavos: despesa.valorCentavos,
    data: despesa.data,
    categoriaId: despesa.categoriaId,
    numeroParcela: despesa.numeroParcela,
    quantidadeParcelas: despesa.quantidadeParcelas,
  };
}

// ---------------------------------------------------------------------------
// Find-or-create de UMA fatura (um ciclo) — a identidade é (contaId, fechaEm).
// ---------------------------------------------------------------------------

/**
 * Defesa em profundidade — mesmo espírito dos CHECKs de `db/schema.ts`
 * (que duplicam de propósito o que o Zod já impõe na borda, ver os
 * comentários lá): `familiaId` entra no WHERE mesmo os dois chamadores já
 * validando o cartão antes (`listarFaturasDoCartao` via
 * `buscarContaDaFamilia`). Sem isto, um caminho novo amanhã que chame
 * `garantirFaturaDoCiclo`/`encontrarFatura` sem validar o cartão primeiro
 * vazaria fatura de uma família para outra em silêncio — a invariante não
 * pode depender só de disciplina do chamador.
 */
async function encontrarFatura(
  db: DbOuTx,
  familiaId: string,
  contaId: string,
  fechaEm: string,
): Promise<FaturaDb | undefined> {
  const [linha] = await db
    .select()
    .from(faturas)
    .where(
      and(
        eq(faturas.familiaId, familiaId),
        eq(faturas.contaId, contaId),
        eq(faturas.fechaEm, fechaEm),
      ),
    )
    .limit(1);
  return linha;
}

interface DadosDoCartao {
  familiaId: string;
  contaId: string;
  diaFechamento: number;
  diaVencimento: number;
}

async function garantirFaturaDoCiclo(
  db: DbOuTx,
  cartao: DadosDoCartao,
  fechaEm: string,
  hoje: string,
): Promise<FaturaDb> {
  const { familiaId, contaId, diaFechamento, diaVencimento } = cartao;
  const existente = await encontrarFatura(db, familiaId, contaId, fechaEm);
  if (existente) return existente;

  const abreEm = abreEmDoCiclo(fechaEm);
  const venceEm = venceEmDoCiclo(diaFechamento, diaVencimento, fechaEm);
  const status = statusDoCiclo(fechaEm, hoje, null);

  const inseridas = await db
    .insert(faturas)
    .values({ familiaId, contaId, abreEm, fechaEm, venceEm, status })
    .onConflictDoNothing({ target: [faturas.contaId, faturas.fechaEm] })
    .returning();

  const inserida = inseridas[0];
  if (inserida) return inserida;

  // Corrida — outra requisição criou o MESMO ciclo entre o SELECT e o INSERT.
  const linha = await encontrarFatura(db, familiaId, contaId, fechaEm);
  if (!linha) throw new Error('faturas: não consegui encontrar nem criar a fatura do ciclo');
  return linha;
}

/**
 * O ciclo fecha SOZINHO, pela passagem do tempo (skill, fluxo 2) — não por um
 * job. Aqui é onde isso se torna visível: se uma fatura não paga já passou do
 * `fechaEm`, o status persistido é corrigido para `FECHADA` na PRÓPRIA
 * leitura (self-heal, idempotente). `PAGA` nunca é sobrescrito por aqui —
 * só `pagarFatura` escreve `PAGA` (RN-24).
 */
async function comStatusEmDia(db: DbOuTx, fatura: FaturaDb, hoje: string): Promise<FaturaDb> {
  if (fatura.status === 'PAGA') return fatura;
  const statusCorreto = statusDoCiclo(fatura.fechaEm, hoje, fatura.pagaEm);
  if (statusCorreto === fatura.status) return fatura;

  const [atualizada] = await db
    .update(faturas)
    .set({ status: statusCorreto, atualizadoEm: new Date() })
    .where(eq(faturas.id, fatura.id))
    .returning();
  return atualizada ?? fatura;
}

// ---------------------------------------------------------------------------
// Leitura — GET /faturas?contaId=
// ---------------------------------------------------------------------------

export async function listarFaturasDoCartao(
  db: Db,
  familiaId: string,
  contaId: string,
): Promise<FaturasDoCartaoLidas | undefined> {
  const conta = await buscarContaDaFamilia(db, familiaId, contaId);
  if (!conta || conta.tipo !== 'CREDITO') return undefined;
  if (conta.diaFechamento == null || conta.diaVencimento == null) {
    // Defesa em profundidade: RN-08/EF-02 já garante isto na escrita da
    // conta (CHECK `contas_campos_de_credito_apenas_em_credito`) — uma conta
    // CREDITO sem os dois campos é estado que a escrita nunca deveria
    // produzir.
    throw new Error(`faturas: conta ${contaId} é CREDITO sem diaFechamento/diaVencimento`);
  }

  const hoje = hojeIso();
  const despesas = await despesasDoCartao(db, familiaId, contaId);
  const grupos = agruparPorFechaEm(conta.diaFechamento, despesas);

  // O ciclo CORRENTE sempre é garantido, mesmo sem nenhuma compra ainda (a
  // tela precisa de "a fatura de agora" para mostrar datas/limite livre). Os
  // ciclos JÁ FECHADOS (fechaEm <= hoje) que têm despesa e ainda não têm
  // linha também são materializados aqui — cobre a família que passou meses
  // sem abrir a tela (D1: soma TODA fatura não paga, não só a mais recente).
  const fechaEmCorrente = fechaEmDoCiclo(conta.diaFechamento, hoje);
  const fechaEmsParaGarantir = new Set<string>([fechaEmCorrente]);
  for (const fechaEm of grupos.keys()) {
    if (fechaEm <= hoje) fechaEmsParaGarantir.add(fechaEm);
  }
  const dadosDoCartao: DadosDoCartao = {
    familiaId,
    contaId,
    diaFechamento: conta.diaFechamento,
    diaVencimento: conta.diaVencimento,
  };
  for (const fechaEm of fechaEmsParaGarantir) {
    await garantirFaturaDoCiclo(db, dadosDoCartao, fechaEm, hoje);
  }

  // D1 — TODA fatura não paga (ABERTA + FECHADA), nunca só `status = 'ABERTA'`
  // (essa seria a leitura estreita que D1 rejeitou). `familiaId` no WHERE é
  // defesa em profundidade (mesmo espírito do comentário em
  // `encontrarFatura`) — `contaId` já foi validado como desta família pelo
  // `buscarContaDaFamilia` no topo desta função, mas a query não deveria
  // PRECISAR confiar nisso para estar correta.
  const linhas = await db
    .select()
    .from(faturas)
    .where(
      and(
        eq(faturas.familiaId, familiaId),
        eq(faturas.contaId, contaId),
        ne(faturas.status, 'PAGA'),
      ),
    )
    .orderBy(asc(faturas.fechaEm));

  const faturasLidas: FaturaLida[] = [];
  for (const linha of linhas) {
    const atual = await comStatusEmDia(db, linha, hoje);
    const itensDoGrupo = grupos.get(atual.fechaEm) ?? [];
    faturasLidas.push({
      id: atual.id,
      contaId: atual.contaId,
      abreEm: atual.abreEm,
      fechaEm: atual.fechaEm,
      venceEm: atual.venceEm,
      status: atual.status,
      totalCentavos: itensDoGrupo.reduce((soma, d) => soma + d.valorCentavos, 0),
      pagaEm: atual.pagaEm ? atual.pagaEm.toISOString() : null,
      pagaComContaId: atual.pagaComContaId,
      itens: itensDoGrupo.map(paraItem),
    });
  }

  return {
    contaId,
    limiteCentavos: conta.limiteCentavos,
    // RN-26/D1 — limite − Σ(fatura em aberto). `saldoCentavos` de uma CREDITO
    // já É −Σ(fatura em aberto) (ver o comentário no topo do arquivo e
    // `modulos/contas/servico.ts#expressaoSaldoDerivado`), então somar (não
    // subtrair) já dá a conta certa.
    limiteLivreCentavos: conta.limiteCentavos !== null ? conta.limiteCentavos + conta.saldoCentavos : null,
    faturas: faturasLidas,
  };
}

// ---------------------------------------------------------------------------
// Pagamento — POST /faturas/:id/pagar (RN-24, D3).
// ---------------------------------------------------------------------------

export type ResultadoDePagamento =
  | { tipo: 'ok'; fatura: FaturaLida } |
  { tipo: 'fatura_nao_encontrada' } |
  { tipo: 'ja_paga' } |
  { tipo: 'sem_valor' } |
  { tipo: 'conta_pagadora_nao_encontrada' } |
  { tipo: 'conta_pagadora_igual_ao_cartao' };

export interface DadosDePagamento {
  familiaId: string;
  autorMembroId: string;
  faturaId: string;
  pagaComContaId: string;
}

export async function pagarFatura(db: Db, dados: DadosDePagamento): Promise<ResultadoDePagamento> {
  const { familiaId, autorMembroId, faturaId, pagaComContaId } = dados;

  const [fatura] = await db
    .select()
    .from(faturas)
    .where(and(eq(faturas.id, faturaId), eq(faturas.familiaId, familiaId)))
    .limit(1);
  if (!fatura) return { tipo: 'fatura_nao_encontrada' };
  if (fatura.status === 'PAGA') return { tipo: 'ja_paga' };

  // Mesma defesa de `lancamentos_conta_destino_diferente_da_origem`
  // (`db/schema.ts`) — o CHECK do banco pegaria isto de qualquer forma, mas
  // um 400 claro aqui é melhor do que deixar a transação estourar.
  if (pagaComContaId === fatura.contaId) return { tipo: 'conta_pagadora_igual_ao_cartao' };

  const pagadora = await buscarContaDaFamilia(db, familiaId, pagaComContaId);
  if (!pagadora) return { tipo: 'conta_pagadora_nao_encontrada' };

  const despesas = await despesasDoCartao(db, familiaId, fatura.contaId);
  const itensDoCiclo = despesas.filter(d => d.data >= fatura.abreEm && d.data <= fatura.fechaEm);
  const totalCentavos = itensDoCiclo.reduce((soma, d) => soma + d.valorCentavos, 0);
  if (totalCentavos <= 0) return { tipo: 'sem_valor' };

  const hoje = hojeIso();
  const competencia = hoje.slice(0, 7);

  const faturaPaga = await db.transaction(async (tx) => {
    // RN-24 — a transferência em si. ⛔ NENHUM update em `lancamentos` aqui:
    // os lançamentos originais (as compras) mantêm `contaId` = o cartão.
    // "Pagar" é só este INSERT a mais — nunca uma reatribuição da armadilha 1
    // (EF-05 §4).
    await tx.insert(lancamentos).values({
      familiaId,
      tipo: 'TRANSFERENCIA',
      descricao: 'Pagamento de fatura',
      valorCentavos: totalCentavos,
      data: hoje,
      competencia,
      categoriaId: null,
      contaId: pagaComContaId,
      contaDestinoId: fatura.contaId,
      criadoPorMembroId: autorMembroId,
      serieParcelaId: null,
      numeroParcela: null,
    });

    const [paga] = await tx
      .update(faturas)
      .set({
        status: 'PAGA',
        pagaEm: new Date(),
        pagaComContaId,
        atualizadoEm: new Date(),
      })
      .where(eq(faturas.id, faturaId))
      .returning();
    if (!paga) throw new Error('faturas: não consegui marcar a fatura como paga');
    return paga;
  });

  return {
    tipo: 'ok',
    fatura: {
      id: faturaPaga.id,
      contaId: faturaPaga.contaId,
      abreEm: faturaPaga.abreEm,
      fechaEm: faturaPaga.fechaEm,
      venceEm: faturaPaga.venceEm,
      status: faturaPaga.status,
      totalCentavos,
      pagaEm: faturaPaga.pagaEm ? faturaPaga.pagaEm.toISOString() : null,
      pagaComContaId: faturaPaga.pagaComContaId,
      itens: itensDoCiclo.map(paraItem),
    },
  };
}
