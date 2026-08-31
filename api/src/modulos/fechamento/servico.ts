import { and, eq } from 'drizzle-orm';
import type { Db } from '../../db';
import { fechamentosMes } from '../../db/schema';
import { lerCompetencia } from '../orcamento/servico';

export async function resumoDeFechamento(db: Db, familiaId: string, competencia: string) {
  const comp = await lerCompetencia(db, familiaId, competencia);

  const gastoCentavos = comp.categorias.reduce((acc, cat) => acc + cat.gastoCentavos, 0);
  const sobraProjetadaCentavos = comp.recebidoCentavos - gastoCentavos;

  const categoriasEstouradas = comp.categorias
    .filter(c => c.disponivelCentavos < 0)
    .map(c => ({
      id: c.id,
      nome: c.nome,
      disponivelCentavos: c.disponivelCentavos,
    }));

  const [fechamento] = await db
    .select({
      fechadoEm: fechamentosMes.fechadoEm,
      autorMembroId: fechamentosMes.autorMembroId,
    })
    .from(fechamentosMes)
    .where(and(eq(fechamentosMes.familiaId, familiaId), eq(fechamentosMes.competencia, competencia)))
    .limit(1);

  return {
    competencia,
    recebidoCentavos: comp.recebidoCentavos,
    planejadoCentavos: comp.planejadoCentavos,
    gastoCentavos,
    sobraProjetadaCentavos,
    categoriasEstouradas,
    status: fechamento ? ('fechado' as const) : ('aberto' as const),
    fechadoEm: fechamento ? fechamento.fechadoEm.toISOString() : null,
    autorMembroId: fechamento ? fechamento.autorMembroId : null,
  };
}

export type ResultadoDeFechamento =
  | { tipo: 'ok'; fechamento: { competencia: string; sobraCentavos: number; fechadoEm: string; autorMembroId: string } } |
  { tipo: 'ja_fechado' };

export async function fecharCompetencia(
  db: Db,
  familiaId: string,
  autorMembroId: string,
  competencia: string,
): Promise<ResultadoDeFechamento> {
  const [existente] = await db
    .select({ id: fechamentosMes.id })
    .from(fechamentosMes)
    .where(and(eq(fechamentosMes.familiaId, familiaId), eq(fechamentosMes.competencia, competencia)))
    .limit(1);

  if (existente) {
    return { tipo: 'ja_fechado' };
  }

  const resumo = await resumoDeFechamento(db, familiaId, competencia);

  const [fechamento] = await db
    .insert(fechamentosMes)
    .values({
      familiaId,
      competencia,
      sobraCentavos: resumo.sobraProjetadaCentavos,
      autorMembroId,
    })
    .returning();

  if (!fechamento) throw new Error('Não foi possível registrar o fechamento');

  return {
    tipo: 'ok',
    fechamento: {
      competencia: fechamento.competencia,
      sobraCentavos: fechamento.sobraCentavos,
      fechadoEm: fechamento.fechadoEm.toISOString(),
      autorMembroId: fechamento.autorMembroId,
    },
  };
}
