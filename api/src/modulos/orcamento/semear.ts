/**
 * O SEMEADOR de `orcamento` (EF-03) — o ponto de extensão que `db/semear.ts`
 * abriu em `SEMEADORES_DE_MODULO`.
 *
 * Semeia DUAS categorias com teto NA COMPETÊNCIA do seed (`contexto.competencia`):
 * sem isto o gate de navegação abre `/orcamento` vazio, e tela vazia não
 * prova render — mesmo raciocínio de `modulos/contas/semear.ts`.
 */
import { eq } from 'drizzle-orm';

import type { ContextoDoSeed, SemeadorDeModulo } from '../../db/semear';
import { categorias, orcamentosMes } from '../../db/schema';

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
      .values([
        { familiaId: contexto.familiaId, nome: 'Mercado', icone: 'carrinho', cor: '#16a34a' },
        { familiaId: contexto.familiaId, nome: 'Lazer', icone: 'estrela', cor: '#f59e0b' },
      ])
      .returning({ id: categorias.id });

    const [mercado, lazer] = linhas;
    if (!mercado || !lazer) throw new Error('semear orcamento: categorias não foram criadas');

    await db.insert(orcamentosMes).values([
      {
        familiaId: contexto.familiaId,
        categoriaId: mercado.id,
        competencia: contexto.competencia,
        tetoCentavos: 150000,
      },
      {
        familiaId: contexto.familiaId,
        categoriaId: lazer.id,
        competencia: contexto.competencia,
        tetoCentavos: 40000,
      },
    ]);

    return linhas.length;
  },
};
