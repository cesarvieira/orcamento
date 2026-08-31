import { z } from 'zod';
import { registrarEsquema } from '../../openapi/registro';

export const PADRAO_COMPETENCIA = /^\d{4}-\d{2}$/;

export const EsquemaCategoriaEstourada = registrarEsquema(
  'CategoriaEstourada',
  z.object({
    id: z.string(),
    nome: z.string(),
    disponivelCentavos: z.number().int(),
  }),
);

export const EsquemaResumoFechamento = registrarEsquema(
  'ResumoFechamento',
  z.object({
    competencia: z.string().regex(PADRAO_COMPETENCIA),
    recebidoCentavos: z.number().int(),
    planejadoCentavos: z.number().int(),
    gastoCentavos: z.number().int(),
    sobraProjetadaCentavos: z.number().int(),
    categoriasEstouradas: z.array(EsquemaCategoriaEstourada),
    status: z.enum(['aberto', 'fechado']),
    fechadoEm: z.string().datetime().nullable().optional(),
    autorMembroId: z.string().nullable().optional(),
  }),
);

export const EsquemaFechamentoMes = registrarEsquema(
  'FechamentoMes',
  z.object({
    competencia: z.string().regex(PADRAO_COMPETENCIA),
    sobraCentavos: z.number().int(),
    fechadoEm: z.string().datetime(),
    autorMembroId: z.string(),
  }),
);
