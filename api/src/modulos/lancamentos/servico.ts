/**
 * As consultas do módulo `lancamentos` (EF-04). Nenhum handler HTTP fala com
 * o banco diretamente — tudo passa por aqui, para que a checagem de tenant
 * (familiaId sempre no WHERE) e as regras RN-15..RN-22/RN-39 morem num lugar
 * só. Mesmo padrão de `modulos/orcamento/servico.ts` e `modulos/contas/servico.ts`.
 *
 * ⛔ Regra #0: RN-15..RN-22/RN-39 vêm de
 * `.preator/skills/negocio/lancamentos-e-parcelamento/SKILL.md`, citando
 * `docs/especificacoes/EF-04-lancamentos.md` §1/§2 como fonte primária.
 */
import { and, eq, gte } from 'drizzle-orm';
import type { z } from 'zod';

import type { Db } from '../../db';
import { categorias, contas, lancamentos, seriesParcelas } from '../../db/schema';
import { competenciaDaData, gerarParcelas } from './dominio';
import type { EsquemaModoDeExclusao, EsquemaNovoLancamento } from './esquemas';

export type EntradaDeLancamento = z.infer<typeof EsquemaNovoLancamento>;
export type ModoDeExclusao = z.infer<typeof EsquemaModoDeExclusao>;

export interface LancamentoLido {
  id: string;
  tipo: 'RECEITA' | 'DESPESA' | 'TRANSFERENCIA';
  descricao: string;
  valorCentavos: number;
  data: string;
  competencia: string;
  categoriaId: string | null;
  contaId: string;
  contaDestinoId: string | null;
  criadoPorMembroId: string;
  serieParcelaId: string | null;
  numeroParcela: number | null;
  criadoEm: string;
}

interface LinhaBruta {
  id: string;
  tipo: 'RECEITA' | 'DESPESA' | 'TRANSFERENCIA';
  descricao: string;
  valorCentavos: number;
  data: string;
  competencia: string;
  categoriaId: string | null;
  contaId: string;
  contaDestinoId: string | null;
  criadoPorMembroId: string;
  serieParcelaId: string | null;
  numeroParcela: number | null;
  criadoEm: Date;
}

const colunasDeLeitura = {
  id: lancamentos.id,
  tipo: lancamentos.tipo,
  descricao: lancamentos.descricao,
  valorCentavos: lancamentos.valorCentavos,
  data: lancamentos.data,
  competencia: lancamentos.competencia,
  categoriaId: lancamentos.categoriaId,
  contaId: lancamentos.contaId,
  contaDestinoId: lancamentos.contaDestinoId,
  criadoPorMembroId: lancamentos.criadoPorMembroId,
  serieParcelaId: lancamentos.serieParcelaId,
  numeroParcela: lancamentos.numeroParcela,
  criadoEm: lancamentos.criadoEm,
};

function paraLeitura(linha: LinhaBruta): LancamentoLido {
  return { ...linha, criadoEm: linha.criadoEm.toISOString() };
}

/**
 * `Db` OU o `tx` de dentro de `db.transaction(async tx => ...)` — mesmo tipo
 * de `modulos/orcamento/servico.ts#DbOuTx`. O parcelamento insere a
 * `SerieParcelas` e as N linhas de `lancamentos` na MESMA transação (RN-21:
 * nunca uma série sem todas as suas parcelas).
 */
type DbOuTx = Db | Parameters<Parameters<Db['transaction']>[0]>[0];

// ---------------------------------------------------------------------------
// RN-22 — competência selada não aceita novo lançamento (fork 2/#52).
// ---------------------------------------------------------------------------

/**
 * `FechamentoMes` é da EF-08 (issue #22,
 * docs/especificacoes/EF-08-fechamento.md), que AINDA NÃO EXISTE (ver
 * `.preator/CONTEXT.md` — "Estado atual"). Este é o ponto de checagem
 * NOMEADO que a escrita usa — hoje sempre devolve "não selada" — mesmo
 * padrão de `modulos/contas/servico.ts#contaPodeSerExcluida`. Quando a EF-08
 * criar `fechamentos_mes`, ela troca só o corpo por
 * `select exists(select 1 from fechamentos_mes
 *   where fechamentos_mes.familia_id = <familiaId>
 *     and fechamentos_mes.competencia = <competencia>)`
 * — o resto do fluxo de escrita (`criarLancamento` abaixo) não muda uma
 * linha. O caso positivo (competência de fato selada, lançamento de fato
 * recusado) fica pendente da EF-08 — registrado, não escondido.
 */
export async function competenciaEstaSelada(
  _db: DbOuTx,
  _familiaId: string,
  _competencia: string,
): Promise<boolean> {
  return false; // @fundacao — EF-08 substitui isto (ver comentário acima).
}

// ---------------------------------------------------------------------------
// Checagens de posse (R1) — conta e categoria precisam ser DESTA família.
// ---------------------------------------------------------------------------

async function contaExisteNaFamilia(db: DbOuTx, familiaId: string, contaId: string): Promise<boolean> {
  const [linha] = await db
    .select({ id: contas.id })
    .from(contas)
    .where(and(eq(contas.id, contaId), eq(contas.familiaId, familiaId)))
    .limit(1);
  return Boolean(linha);
}

async function categoriaExisteNaFamilia(
  db: DbOuTx,
  familiaId: string,
  categoriaId: string,
): Promise<boolean> {
  const [linha] = await db
    .select({ id: categorias.id })
    .from(categorias)
    .where(and(eq(categorias.id, categoriaId), eq(categorias.familiaId, familiaId)))
    .limit(1);
  return Boolean(linha);
}

// ---------------------------------------------------------------------------
// Criação — RN-15 (competência calculada na escrita), RN-16 (autor imutável),
// RN-17 (transferência sem categoria), RN-18 (crédito não move saldo — a
// leitura é que impõe isso, ver `modulos/contas/servico.ts`), RN-20/RN-21
// (motor de parcelamento) e RN-22 (competência selada, fork 2).
// ---------------------------------------------------------------------------

export type ResultadoDeCriacao =
  | { tipo: 'ok'; lancamentos: LancamentoLido[] } |
  { tipo: 'conta_nao_encontrada' } |
  { tipo: 'categoria_nao_encontrada' } |
  { tipo: 'competencia_selada' };

export interface DadosDeCriacao {
  familiaId: string;
  autorMembroId: string;
  entrada: EntradaDeLancamento;
}

async function inserirLinha(
  db: DbOuTx,
  valores: typeof lancamentos.$inferInsert,
): Promise<LancamentoLido> {
  const [linha] = await db.insert(lancamentos).values(valores).returning(colunasDeLeitura);
  if (!linha) throw new Error('lancamentos: não consegui criar o lançamento');
  return paraLeitura(linha);
}

export async function criarLancamento(
  db: Db,
  dados: DadosDeCriacao,
): Promise<ResultadoDeCriacao> {
  const { familiaId, autorMembroId, entrada } = dados;

  if (!(await contaExisteNaFamilia(db, familiaId, entrada.contaId))) {
    return { tipo: 'conta_nao_encontrada' };
  }
  if (entrada.tipo === 'TRANSFERENCIA') {
    if (!(await contaExisteNaFamilia(db, familiaId, entrada.contaDestinoId))) {
      return { tipo: 'conta_nao_encontrada' };
    }
  }
  if (entrada.tipo === 'DESPESA') {
    if (!(await categoriaExisteNaFamilia(db, familiaId, entrada.categoriaId))) {
      return { tipo: 'categoria_nao_encontrada' };
    }
  }

  // DESPESA parcelada (RN-20/RN-21) — motor de parcelamento + série, na MESMA
  // transação: nunca uma série sem todas as suas parcelas.
  //
  // Os campos de `entrada` usados abaixo são capturados em CONSTANTES locais
  // antes de entrar no `db.transaction(async tx => ...)`: o TypeScript não
  // propaga o estreitamento de `entrada.tipo === 'DESPESA'` (nem o de
  // `entrada.quantidadeParcelas` truthy) para dentro de uma closure aninhada
  // — não é regra de negócio, é limitação conhecida do controle de fluxo do
  // compilador através de fronteira de função.
  if (entrada.tipo === 'DESPESA' && entrada.quantidadeParcelas && entrada.quantidadeParcelas > 1) {
    const { descricao, categoriaId, contaId, quantidadeParcelas } = entrada;
    const parcelas = gerarParcelas(entrada.valorCentavos, quantidadeParcelas, entrada.data);
    const totalCentavos = entrada.valorCentavos;

    for (const parcela of parcelas) {
      if (await competenciaEstaSelada(db, familiaId, parcela.competencia)) {
        return { tipo: 'competencia_selada' };
      }
    }

    return db.transaction(async (tx) => {
      const [serie] = await tx
        .insert(seriesParcelas)
        .values({ familiaId, totalCentavos, quantidade: quantidadeParcelas })
        .returning({ id: seriesParcelas.id });
      if (!serie) throw new Error('lancamentos: não consegui criar a série de parcelas');

      const criados: LancamentoLido[] = [];
      for (const parcela of parcelas) {
        criados.push(
          await inserirLinha(tx, {
            familiaId,
            tipo: 'DESPESA',
            descricao,
            valorCentavos: parcela.valorCentavos,
            data: parcela.data,
            competencia: parcela.competencia,
            categoriaId,
            contaId,
            contaDestinoId: null,
            criadoPorMembroId: autorMembroId,
            serieParcelaId: serie.id,
            numeroParcela: parcela.numero,
          }),
        );
      }
      return { tipo: 'ok' as const, lancamentos: criados };
    });
  }

  // Lançamento avulso — RECEITA, TRANSFERENCIA, ou DESPESA sem parcelamento.
  const competencia = competenciaDaData(entrada.data);
  if (await competenciaEstaSelada(db, familiaId, competencia)) {
    return { tipo: 'competencia_selada' };
  }

  const criado = await inserirLinha(db, {
    familiaId,
    tipo: entrada.tipo,
    descricao: entrada.descricao,
    valorCentavos: entrada.valorCentavos,
    data: entrada.data,
    competencia,
    // RN-17 — categoriaId só em DESPESA; nulo em RECEITA/TRANSFERENCIA.
    categoriaId: entrada.tipo === 'DESPESA' ? entrada.categoriaId : null,
    contaId: entrada.contaId,
    contaDestinoId: entrada.tipo === 'TRANSFERENCIA' ? entrada.contaDestinoId : null,
    criadoPorMembroId: autorMembroId,
    serieParcelaId: null,
    numeroParcela: null,
  });

  return { tipo: 'ok', lancamentos: [criado] };
}

// ---------------------------------------------------------------------------
// Leitura — listagem (extrato) e detalhe.
// ---------------------------------------------------------------------------

export interface FiltrosDeListagem {
  competencia?: string;
  contaId?: string;
}

export async function listarLancamentos(
  db: Db,
  familiaId: string,
  filtros: FiltrosDeListagem = {},
): Promise<LancamentoLido[]> {
  const condicoes = [eq(lancamentos.familiaId, familiaId)];
  if (filtros.competencia) condicoes.push(eq(lancamentos.competencia, filtros.competencia));
  if (filtros.contaId) condicoes.push(eq(lancamentos.contaId, filtros.contaId));

  const linhas = await db
    .select(colunasDeLeitura)
    .from(lancamentos)
    .where(and(...condicoes))
    .orderBy(lancamentos.data, lancamentos.criadoEm);

  return linhas.map(paraLeitura);
}

export async function buscarLancamento(
  db: Db,
  familiaId: string,
  id: string,
): Promise<LancamentoLido | undefined> {
  const [linha] = await db
    .select(colunasDeLeitura)
    .from(lancamentos)
    .where(and(eq(lancamentos.id, id), eq(lancamentos.familiaId, familiaId)))
    .limit(1);
  return linha ? paraLeitura(linha) : undefined;
}

// ---------------------------------------------------------------------------
// Exclusão — fork 1/#52: o alcance pergunta (`esta` · `todas` · `a partir
// desta`). `SerieParcelas.total`/`quantidade` NUNCA são reescritos aqui (ver
// o comentário na tabela, `db/schema.ts`) — só linhas de `lancamentos` somem.
// ---------------------------------------------------------------------------

export type ResultadoDeExclusao =
  | { tipo: 'excluido'; quantidade: number; competencias: string[] } |
  { tipo: 'nao_encontrado' };

export async function excluirLancamento(
  db: Db,
  familiaId: string,
  id: string,
  modo: ModoDeExclusao,
): Promise<ResultadoDeExclusao> {
  const [alvo] = await db
    .select({ id: lancamentos.id, serieParcelaId: lancamentos.serieParcelaId, competencia: lancamentos.competencia })
    .from(lancamentos)
    .where(and(eq(lancamentos.id, id), eq(lancamentos.familiaId, familiaId)))
    .limit(1);
  if (!alvo) return { tipo: 'nao_encontrado' };

  // Fora de uma série, os três modos colapsam no mesmo efeito: só esta linha.
  if (modo === 'esta' || !alvo.serieParcelaId) {
    await db.delete(lancamentos).where(and(eq(lancamentos.id, id), eq(lancamentos.familiaId, familiaId)));
    return { tipo: 'excluido', quantidade: 1, competencias: [alvo.competencia] };
  }

  if (modo === 'todas') {
    const apagados = await db
      .delete(lancamentos)
      .where(and(eq(lancamentos.familiaId, familiaId), eq(lancamentos.serieParcelaId, alvo.serieParcelaId)))
      .returning({ competencia: lancamentos.competencia });
    return {
      tipo: 'excluido',
      quantidade: apagados.length,
      competencias: [...new Set(apagados.map(a => a.competencia))],
    };
  }

  // 'a-partir-desta' — esta parcela e as de competência POSTERIOR (mantém as anteriores).
  const apagados = await db
    .delete(lancamentos)
    .where(
      and(
        eq(lancamentos.familiaId, familiaId),
        eq(lancamentos.serieParcelaId, alvo.serieParcelaId),
        gte(lancamentos.competencia, alvo.competencia),
      ),
    )
    .returning({ competencia: lancamentos.competencia });
  return {
    tipo: 'excluido',
    quantidade: apagados.length,
    competencias: [...new Set(apagados.map(a => a.competencia))],
  };
}
