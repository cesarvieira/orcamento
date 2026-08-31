/**
 * O SEMEADOR de `metas` (EF-07) — o ponto de extensão que `db/semear.ts`
 * abriu em `SEMEADORES_DE_MODULO`.
 *
 * Semeia DOIS cofrinhos: sem isto o gate de navegação abre `/metas` vazio, e
 * tela vazia não prova render — mesmo raciocínio de `modulos/contas/semear.ts`
 * e `modulos/orcamento/semear.ts`. Reaproveita `criarMeta` (o mesmo caminho da
 * API) em vez de duplicar a criação da conta RESERVA aqui.
 */
import { eq } from 'drizzle-orm';

import type { ContextoDoSeed, SemeadorDeModulo } from '../../db/semear';
import { metas } from '../../db/schema';
import { criarMeta } from './servico';

export const semeadorDeMetas: SemeadorDeModulo = {
  modulo: 'metas',
  async semear(db, contexto: ContextoDoSeed): Promise<number> {
    const existentes = await db
      .select({ id: metas.id })
      .from(metas)
      .where(eq(metas.familiaId, contexto.familiaId));

    // Idempotente: já semeado, não duplica.
    if (existentes.length > 0) return existentes.length;

    await criarMeta(db, contexto.familiaId, { nome: 'Viagem de férias', alvoCentavos: 300000 });
    await criarMeta(db, contexto.familiaId, { nome: 'Carro novo', alvoCentavos: 2000000 });

    return 2;
  },
};
