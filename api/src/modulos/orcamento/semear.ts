/**
 * O SEMEADOR de `orcamento` (EF-03) — o ponto de extensão que `db/semear.ts`
 * abriu em `SEMEADORES_DE_MODULO`.
 *
 * Semeia categorias com ícones/cores do vocabulário da UI, tetos e renda
 * prevista em 4 competências (2 meses passados, mês atual e o seguinte) e um
 * remanejamento no mês corrente — o histórico que a tela de orçamento
 * precisa para parecer um ambiente real.
 */
import { eq } from 'drizzle-orm';

import { deslocarCompetencia } from '../../db/semear-datas';
import type { ContextoDoSeed, SemeadorDeModulo } from '../../db/semear';
import { categorias, orcamentosMes } from '../../db/schema';
import { criarRemanejamento, definirRendaPrevista } from './servico';

const CATEGORIAS_DO_SEED = [
  { nome: 'Mercado', icone: 'ti-shopping-cart', cor: '#4c7d5a', tetoCentavos: 150000 },
  { nome: 'Moradia', icone: 'ti-home', cor: '#14325a', tetoCentavos: 220000 },
  { nome: 'Transporte', icone: 'ti-bus', cor: '#2e6b8f', tetoCentavos: 60000 },
  { nome: 'Saúde', icone: 'ti-heartbeat', cor: '#a04a4a', tetoCentavos: 40000 },
  { nome: 'Lazer', icone: 'ti-glass-full', cor: '#6b4a7d', tetoCentavos: 50000 },
  { nome: 'Educação', icone: 'ti-school', cor: '#8a5a2b', tetoCentavos: 30000 },
  { nome: 'Vestuário', icone: 'ti-shirt', cor: '#2f6f6f', tetoCentavos: 25000 },
  { nome: 'Assinaturas', icone: 'ti-wifi', cor: '#3d5a8a', tetoCentavos: 20000 },
] as const;

/** Renda prevista mensal — acima do planejado para sobrar `naoAlocado`. */
const RENDA_PREVISTA_CENTAVOS = 850000;

export const semeadorDeOrcamento: SemeadorDeModulo = {
  modulo: 'orcamento',
  async semear(db, contexto: ContextoDoSeed): Promise<number> {
    const existentes = await db
      .select({ id: categorias.id })
      .from(categorias)
      .where(eq(categorias.familiaId, contexto.familiaId));

    // Idempotente: já semeado, não duplica.
    if (existentes.length > 0) return existentes.length;

    const linhas = await db
      .insert(categorias)
      .values(
        CATEGORIAS_DO_SEED.map(c => ({
          familiaId: contexto.familiaId,
          nome: c.nome,
          icone: c.icone,
          cor: c.cor,
        })),
      )
      .returning({ id: categorias.id, nome: categorias.nome });

    if (linhas.length !== CATEGORIAS_DO_SEED.length) {
      throw new Error('semear orcamento: categorias não foram criadas');
    }

    const porNome = new Map(linhas.map(l => [l.nome, l.id]));
    const competencias = [
      deslocarCompetencia(contexto.competencia, -2),
      deslocarCompetencia(contexto.competencia, -1),
      contexto.competencia,
      deslocarCompetencia(contexto.competencia, 1),
    ];

    const tetos = [];
    for (const competencia of competencias) {
      await definirRendaPrevista(db, contexto.familiaId, competencia, RENDA_PREVISTA_CENTAVOS);
      for (const cat of CATEGORIAS_DO_SEED) {
        const categoriaId = porNome.get(cat.nome);
        if (!categoriaId) throw new Error(`semear orcamento: falta categoria ${cat.nome}`);
        tetos.push({
          familiaId: contexto.familiaId,
          categoriaId,
          competencia,
          tetoCentavos: cat.tetoCentavos,
        });
      }
    }
    await db.insert(orcamentosMes).values(tetos);

    // Remanejamento no mês corrente — Mercado → Lazer (histórico na tela).
    const mercadoId = porNome.get('Mercado');
    const lazerId = porNome.get('Lazer');
    if (!mercadoId || !lazerId) throw new Error('semear orcamento: Mercado/Lazer ausentes');

    const remanejamento = await criarRemanejamento(db, {
      familiaId: contexto.familiaId,
      autorMembroId: contexto.membroId,
      competencia: contexto.competencia,
      entrada: {
        categoriaOrigemId: mercadoId,
        categoriaDestinoId: lazerId,
        valorCentavos: 15000,
      },
    });
    if (remanejamento.tipo !== 'ok') {
      throw new Error('semear orcamento: remanejamento falhou');
    }

    return linhas.length;
  },
};
