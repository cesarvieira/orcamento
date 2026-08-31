/**
 * O SEMEADOR de `lancamentos` (EF-04) — cobria o buraco documentado em
 * MC-04/EF04-MC-003: sem lançamentos o gate nunca exercitava extrato com
 * dado, cartão de estouro nem parcelas.
 *
 * Gera um fluxo de caixa de família real: receita, despesas (débito e
 * crédito), transferências, parcelamento e aportes em meta — cobrindo 2 meses
 * passados, o mês atual e alguns lançamentos futuros (parcelas + avulsos).
 *
 * ⛔ Regra #0: RN-15..RN-22/RN-39 em
 * `.preator/skills/negocio/lancamentos-e-parcelamento/SKILL.md`; RN-33/RN-34
 * (guardar em meta) em `.preator/skills/negocio/metas-e-reservas/SKILL.md`.
 */
import { and, eq } from 'drizzle-orm';

import { dataNaCompetencia, deslocarCompetencia } from '../../db/semear-datas';
import type { ContextoDoSeed, SemeadorDeModulo } from '../../db/semear';
import { categorias, contas, lancamentos, metas } from '../../db/schema';
import { criarLancamento } from './servico';
import { guardar } from '../metas/servico';

interface ContasDoSeed {
  itau: string;
  nubankDebito: string;
  cartaoNubank: string;
  cartaoInter: string;
  reserva: string;
}

interface CatsDoSeed {
  mercado: string;
  moradia: string;
  transporte: string;
  saude: string;
  lazer: string;
  educacao: string;
  vestuario: string;
  assinaturas: string;
}

async function carregarContas(db: Parameters<SemeadorDeModulo['semear']>[0], familiaId: string): Promise<ContasDoSeed> {
  const linhas = await db
    .select({ id: contas.id, nome: contas.nome, tipo: contas.tipo })
    .from(contas)
    .where(eq(contas.familiaId, familiaId));

  const porNome = new Map(linhas.map(l => [l.nome, l.id]));
  const precisa = (nome: string): string => {
    const id = porNome.get(nome);
    if (!id) throw new Error(`semear lancamentos: conta "${nome}" não encontrada`);
    return id;
  };

  return {
    itau: precisa('Itaú'),
    nubankDebito: precisa('Nubank'),
    cartaoNubank: precisa('Cartão Nubank'),
    cartaoInter: precisa('Cartão Inter'),
    reserva: precisa('Reserva de emergência'),
  };
}

async function carregarCategorias(
  db: Parameters<SemeadorDeModulo['semear']>[0],
  familiaId: string,
): Promise<CatsDoSeed> {
  const linhas = await db
    .select({ id: categorias.id, nome: categorias.nome })
    .from(categorias)
    .where(eq(categorias.familiaId, familiaId));
  const porNome = new Map(linhas.map(l => [l.nome, l.id]));
  const precisa = (nome: string): string => {
    const id = porNome.get(nome);
    if (!id) throw new Error(`semear lancamentos: categoria "${nome}" não encontrada`);
    return id;
  };
  return {
    mercado: precisa('Mercado'),
    moradia: precisa('Moradia'),
    transporte: precisa('Transporte'),
    saude: precisa('Saúde'),
    lazer: precisa('Lazer'),
    educacao: precisa('Educação'),
    vestuario: precisa('Vestuário'),
    assinaturas: precisa('Assinaturas'),
  };
}

async function lancar(
  db: Parameters<SemeadorDeModulo['semear']>[0],
  contexto: ContextoDoSeed,
  autorMembroId: string,
  entrada: Parameters<typeof criarLancamento>[1]['entrada'],
): Promise<number> {
  const resultado = await criarLancamento(db, {
    familiaId: contexto.familiaId,
    autorMembroId,
    entrada,
  });
  if (resultado.tipo !== 'ok') {
    throw new Error(`semear lancamentos: falhou (${resultado.tipo}) — ${JSON.stringify(entrada)}`);
  }
  return resultado.lancamentos.length;
}

export const semeadorDeLancamentos: SemeadorDeModulo = {
  modulo: 'lancamentos',
  async semear(db, contexto: ContextoDoSeed): Promise<number> {
    const existentes = await db
      .select({ id: lancamentos.id })
      .from(lancamentos)
      .where(eq(lancamentos.familiaId, contexto.familiaId))
      .limit(1);

    // Idempotente: já semeado, não duplica.
    if (existentes.length > 0) {
      const todos = await db
        .select({ id: lancamentos.id })
        .from(lancamentos)
        .where(eq(lancamentos.familiaId, contexto.familiaId));
      return todos.length;
    }

    const c = await carregarContas(db, contexto.familiaId);
    const cat = await carregarCategorias(db, contexto.familiaId);
    const ana = contexto.membroId;
    const bruno = contexto.segundoMembroId;

    const mesMenos2 = deslocarCompetencia(contexto.competencia, -2);
    const mesMenos1 = deslocarCompetencia(contexto.competencia, -1);
    const mesAtual = contexto.competencia;
    const mesMais1 = deslocarCompetencia(contexto.competencia, 1);

    let total = 0;

    // ── Mês −2 ────────────────────────────────────────────────────────────
    total += await lancar(db, contexto, ana, {
      tipo: 'RECEITA',
      descricao: 'Salário Ana',
      valorCentavos: 550000,
      data: dataNaCompetencia(mesMenos2, 5),
      contaId: c.itau,
    });
    total += await lancar(db, contexto, bruno, {
      tipo: 'RECEITA',
      descricao: 'Salário Bruno',
      valorCentavos: 300000,
      data: dataNaCompetencia(mesMenos2, 5),
      contaId: c.nubankDebito,
    });
    total += await lancar(db, contexto, ana, {
      tipo: 'DESPESA',
      descricao: 'Aluguel',
      valorCentavos: 210000,
      data: dataNaCompetencia(mesMenos2, 8),
      contaId: c.itau,
      categoriaId: cat.moradia,
    });
    total += await lancar(db, contexto, ana, {
      tipo: 'DESPESA',
      descricao: 'Compras do mês',
      valorCentavos: 98000,
      data: dataNaCompetencia(mesMenos2, 12),
      contaId: c.itau,
      categoriaId: cat.mercado,
    });
    total += await lancar(db, contexto, bruno, {
      tipo: 'DESPESA',
      descricao: 'Combustível',
      valorCentavos: 35000,
      data: dataNaCompetencia(mesMenos2, 14),
      contaId: c.nubankDebito,
      categoriaId: cat.transporte,
    });
    total += await lancar(db, contexto, ana, {
      tipo: 'DESPESA',
      descricao: 'Farmácia',
      valorCentavos: 12750,
      data: dataNaCompetencia(mesMenos2, 3),
      contaId: c.cartaoNubank,
      categoriaId: cat.saude,
    });
    total += await lancar(db, contexto, bruno, {
      tipo: 'DESPESA',
      descricao: 'Jantar fora',
      valorCentavos: 18900,
      data: dataNaCompetencia(mesMenos2, 18),
      contaId: c.cartaoInter,
      categoriaId: cat.lazer,
    });
    total += await lancar(db, contexto, ana, {
      tipo: 'DESPESA',
      descricao: 'Netflix + Spotify',
      valorCentavos: 7590,
      data: dataNaCompetencia(mesMenos2, 2),
      contaId: c.cartaoNubank,
      categoriaId: cat.assinaturas,
    });
    total += await lancar(db, contexto, ana, {
      tipo: 'TRANSFERENCIA',
      descricao: 'Reforço da reserva',
      valorCentavos: 50000,
      data: dataNaCompetencia(mesMenos2, 20),
      contaId: c.itau,
      contaDestinoId: c.reserva,
    });

    // ── Mês −1 ────────────────────────────────────────────────────────────
    total += await lancar(db, contexto, ana, {
      tipo: 'RECEITA',
      descricao: 'Salário Ana',
      valorCentavos: 550000,
      data: dataNaCompetencia(mesMenos1, 5),
      contaId: c.itau,
    });
    total += await lancar(db, contexto, bruno, {
      tipo: 'RECEITA',
      descricao: 'Salário Bruno',
      valorCentavos: 300000,
      data: dataNaCompetencia(mesMenos1, 5),
      contaId: c.nubankDebito,
    });
    total += await lancar(db, contexto, ana, {
      tipo: 'DESPESA',
      descricao: 'Aluguel',
      valorCentavos: 210000,
      data: dataNaCompetencia(mesMenos1, 8),
      contaId: c.itau,
      categoriaId: cat.moradia,
    });
    total += await lancar(db, contexto, ana, {
      tipo: 'DESPESA',
      descricao: 'Supermercado',
      valorCentavos: 112400,
      data: dataNaCompetencia(mesMenos1, 11),
      contaId: c.itau,
      categoriaId: cat.mercado,
    });
    total += await lancar(db, contexto, bruno, {
      tipo: 'DESPESA',
      descricao: 'Uber / 99',
      valorCentavos: 28400,
      data: dataNaCompetencia(mesMenos1, 16),
      contaId: c.nubankDebito,
      categoriaId: cat.transporte,
    });
    total += await lancar(db, contexto, ana, {
      tipo: 'DESPESA',
      descricao: 'Consulta médica',
      valorCentavos: 25000,
      data: dataNaCompetencia(mesMenos1, 4),
      contaId: c.cartaoNubank,
      categoriaId: cat.saude,
    });
    total += await lancar(db, contexto, bruno, {
      tipo: 'DESPESA',
      descricao: 'Cinema',
      valorCentavos: 9600,
      data: dataNaCompetencia(mesMenos1, 22),
      contaId: c.cartaoInter,
      categoriaId: cat.lazer,
    });
    total += await lancar(db, contexto, ana, {
      tipo: 'DESPESA',
      descricao: 'Material escolar',
      valorCentavos: 18500,
      data: dataNaCompetencia(mesMenos1, 9),
      contaId: c.itau,
      categoriaId: cat.educacao,
    });
    // Parcelamento 6× — parcelas caem no mês −1, atual e nos 4 seguintes.
    total += await lancar(db, contexto, ana, {
      tipo: 'DESPESA',
      descricao: 'Curso de inglês',
      valorCentavos: 359994,
      data: dataNaCompetencia(mesMenos1, 7),
      contaId: c.cartaoNubank,
      categoriaId: cat.educacao,
      quantidadeParcelas: 6,
    });

    // Aporte em meta (RN-33) — precisa de naoAlocado > 0 (receita − planejado).
    const [metaViagem] = await db
      .select({ id: metas.id })
      .from(metas)
      .where(and(eq(metas.familiaId, contexto.familiaId), eq(metas.nome, 'Viagem de férias')))
      .limit(1);
    if (!metaViagem) throw new Error('semear lancamentos: meta "Viagem de férias" não encontrada');

    const aporteMenos1 = await guardar(db, {
      familiaId: contexto.familiaId,
      autorMembroId: ana,
      metaId: metaViagem.id,
      contaOrigemId: c.itau,
      valorCentavos: 80000,
      data: dataNaCompetencia(mesMenos1, 25),
    });
    if (aporteMenos1.tipo !== 'ok') {
      throw new Error(`semear lancamentos: guardar em meta falhou (${aporteMenos1.tipo})`);
    }
    total += 1;

    // ── Mês atual ─────────────────────────────────────────────────────────
    total += await lancar(db, contexto, ana, {
      tipo: 'RECEITA',
      descricao: 'Salário Ana',
      valorCentavos: 550000,
      data: dataNaCompetencia(mesAtual, 5),
      contaId: c.itau,
    });
    total += await lancar(db, contexto, bruno, {
      tipo: 'RECEITA',
      descricao: 'Salário Bruno',
      valorCentavos: 300000,
      data: dataNaCompetencia(mesAtual, 5),
      contaId: c.nubankDebito,
    });
    total += await lancar(db, contexto, ana, {
      tipo: 'DESPESA',
      descricao: 'Aluguel',
      valorCentavos: 210000,
      data: dataNaCompetencia(mesAtual, 8),
      contaId: c.itau,
      categoriaId: cat.moradia,
    });
    total += await lancar(db, contexto, ana, {
      tipo: 'DESPESA',
      descricao: 'Feira e mercado',
      valorCentavos: 87500,
      data: dataNaCompetencia(mesAtual, 10),
      contaId: c.itau,
      categoriaId: cat.mercado,
    });
    total += await lancar(db, contexto, bruno, {
      tipo: 'DESPESA',
      descricao: 'Gasolina',
      valorCentavos: 32000,
      data: dataNaCompetencia(mesAtual, 12),
      contaId: c.nubankDebito,
      categoriaId: cat.transporte,
    });
    // Estouro de Lazer — acende o cartão "Remanejar" na home (MC-04).
    total += await lancar(db, contexto, ana, {
      tipo: 'DESPESA',
      descricao: 'Show + jantar',
      valorCentavos: 72000,
      data: dataNaCompetencia(mesAtual, 15),
      contaId: c.cartaoInter,
      categoriaId: cat.lazer,
    });
    total += await lancar(db, contexto, bruno, {
      tipo: 'DESPESA',
      descricao: 'Camiseta',
      valorCentavos: 12990,
      data: dataNaCompetencia(mesAtual, 6),
      contaId: c.cartaoNubank,
      categoriaId: cat.vestuario,
    });
    total += await lancar(db, contexto, ana, {
      tipo: 'DESPESA',
      descricao: 'Plano de internet',
      valorCentavos: 12990,
      data: dataNaCompetencia(mesAtual, 3),
      contaId: c.itau,
      categoriaId: cat.assinaturas,
    });

    const [metaCarro] = await db
      .select({ id: metas.id })
      .from(metas)
      .where(and(eq(metas.familiaId, contexto.familiaId), eq(metas.nome, 'Carro novo')))
      .limit(1);
    if (!metaCarro) throw new Error('semear lancamentos: meta "Carro novo" não encontrada');

    const aporteAtual = await guardar(db, {
      familiaId: contexto.familiaId,
      autorMembroId: bruno,
      metaId: metaCarro.id,
      contaOrigemId: c.nubankDebito,
      valorCentavos: 100000,
      data: dataNaCompetencia(mesAtual, 18),
    });
    if (aporteAtual.tipo !== 'ok') {
      throw new Error(`semear lancamentos: guardar carro falhou (${aporteAtual.tipo})`);
    }
    total += 1;

    // ── Futuro (avulsos além das parcelas) ────────────────────────────────
    total += await lancar(db, contexto, ana, {
      tipo: 'RECEITA',
      descricao: '13º salário (previsto)',
      valorCentavos: 550000,
      data: dataNaCompetencia(mesMais1, 5),
      contaId: c.itau,
    });
    total += await lancar(db, contexto, ana, {
      tipo: 'DESPESA',
      descricao: 'Seguro do carro (anual)',
      valorCentavos: 180000,
      data: dataNaCompetencia(mesMais1, 12),
      contaId: c.itau,
      categoriaId: cat.transporte,
    });

    return total;
  },
};
