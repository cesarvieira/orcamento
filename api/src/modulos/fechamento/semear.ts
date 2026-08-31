/**
 * O SEMEADOR de `fechamento` (EF-08) — sela o mês mais antigo do seed
 * (competência −2), para a tela `/fechamento` e RN-22 (competência selada
 * recusa novo lançamento) terem dado real no ambiente de teste.
 *
 * Roda DEPOIS de lançamentos e faturas: a selagem bloqueia escrita nova
 * naquela competência.
 */
import { and, eq } from 'drizzle-orm';

import { deslocarCompetencia } from '../../db/semear-datas';
import type { ContextoDoSeed, SemeadorDeModulo } from '../../db/semear';
import { fechamentosMes } from '../../db/schema';
import { fecharCompetencia } from './servico';

export const semeadorDeFechamento: SemeadorDeModulo = {
  modulo: 'fechamento',
  async semear(db, contexto: ContextoDoSeed): Promise<number> {
    const competenciaAlvo = deslocarCompetencia(contexto.competencia, -2);

    const [existente] = await db
      .select({ id: fechamentosMes.id })
      .from(fechamentosMes)
      .where(
        and(
          eq(fechamentosMes.familiaId, contexto.familiaId),
          eq(fechamentosMes.competencia, competenciaAlvo),
        ),
      )
      .limit(1);

    if (existente) return 1;

    const resultado = await fecharCompetencia(
      db,
      contexto.familiaId,
      contexto.membroId,
      competenciaAlvo,
    );
    if (resultado.tipo === 'ja_fechado') return 1;
    return 1;
  },
};
