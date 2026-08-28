/**
 * Os esquemas do módulo `lancamentos` (EF-04). O Zod aqui é a MESMA validação
 * que a rota usa em runtime — é dele que o contrato OpenAPI sai (D-03).
 *
 * ⛔ Regra #0: os campos e as regras RN-15..RN-22/RN-39 vêm de
 * `.preator/skills/negocio/lancamentos-e-parcelamento/SKILL.md` (glossário e
 * tabela "Regras de negócio"), que cita `docs/especificacoes/EF-04-lancamentos.md`
 * §1/§2 como fonte primária. Nada aqui foi preenchido de memória.
 *
 * TIPO EXPLÍCITO, NÃO SINAL (EF-04 §1/§4): `tipo` é um discriminador Zod —
 * cada tipo tem sua PRÓPRIA forma, então `categoriaId` só EXISTE (no tipo) em
 * `DESPESA`, e `contaDestinoId` só existe em `TRANSFERENCIA` — nem chega a
 * ser "campo nulo", é campo AUSENTE na entrada errada.
 */
import { z } from 'zod';

import { registrarEsquema } from '../../openapi/registro';

/** Mesmo padrão de `modulos/orcamento/esquemas.ts#PADRAO_COMPETENCIA` — `AAAA-MM`. */
export const PADRAO_COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;

const EsquemaTipoLancamento = z.enum(['RECEITA', 'DESPESA', 'TRANSFERENCIA']);

const camposComuns = {
  descricao: z.string().trim().min(1).meta({ description: 'O que foi lançado, em texto livre.' }),
  valorCentavos: z.number().int().positive().meta({
    description:
      'Inteiro em centavos (D-06). Em DESPESA parcelada, é o TOTAL da compra — o motor de ' +
      'parcelamento divide (RN-20/RN-21).',
  }),
  data: z.iso.date().meta({ description: 'AAAA-MM-DD — quando aconteceu (distinta da competência, RN-15).' }),
  contaId: z.string().meta({ description: 'A conta afetada (origem, em TRANSFERENCIA).' }),
};

const EsquemaNovaReceita = z.object({
  tipo: z.literal('RECEITA'),
  ...camposComuns,
});

const EsquemaNovaTransferencia = z.object({
  tipo: z.literal('TRANSFERENCIA'),
  ...camposComuns,
  contaDestinoId: z.string().meta({ description: 'Para onde o dinheiro vai. Não pode ser igual a contaId (fork 3/#52 — 400, validação de entrada).' }),
});

const EsquemaNovaDespesa = z.object({
  tipo: z.literal('DESPESA'),
  ...camposComuns,
  categoriaId: z.string().meta({ description: 'Obrigatório em DESPESA (EF-04 §1).' }),
  quantidadeParcelas: z
    .number()
    .int()
    .min(2)
    .max(48)
    .optional()
    .meta({
      description:
        'RN-20 — até 48×. Ausente (ou 1, que esta forma nem aceita) é despesa avulsa, sem ' +
        'SerieParcelas.',
    }),
});

export const EsquemaNovoLancamento = registrarEsquema(
  'NovoLancamento',
  z.discriminatedUnion('tipo', [
    EsquemaNovaReceita,
    EsquemaNovaDespesa,
    EsquemaNovaTransferencia,
  ]),
);

// ---------------------------------------------------------------------------
// A leitura — a MESMA forma para criação, listagem e detalhe.
// ---------------------------------------------------------------------------

const EsquemaLancamento = registrarEsquema(
  'Lancamento',
  z.object({
    id: z.string(),
    tipo: EsquemaTipoLancamento,
    descricao: z.string(),
    valorCentavos: z.number().int(),
    data: z.string().meta({ description: 'AAAA-MM-DD.' }),
    competencia: z.string().meta({ description: 'AAAA-MM — calculada na escrita (RN-15).' }),
    categoriaId: z.string().nullable(),
    contaId: z.string(),
    contaDestinoId: z.string().nullable(),
    criadoPorMembroId: z.string().meta({ description: 'RN-16 — imutável.' }),
    serieParcelaId: z.string().nullable().meta({ description: 'RN-20/RN-21 — nulo fora de parcelamento.' }),
    numeroParcela: z.number().int().nullable().meta({ description: '1-baseado; nulo fora de parcelamento.' }),
    quantidadeParcelas: z.number().int().nullable().meta({
      description:
        'O total de parcelas da série (series_parcelas.quantidade) — a CONTAGEM da compra ' +
        'original (RN-20/RN-21), imutável à exclusão de parcela (#52), igual a ' +
        'criadoPorMembroId (RN-16). Nulo fora de parcelamento, igual a numeroParcela/serieParcelaId.',
    }),
    criadoEm: z.string().meta({ description: 'ISO 8601.' }),
  }),
);

registrarEsquema(
  'LancamentosListados',
  z.object({ lancamentos: z.array(EsquemaLancamento) }),
);

// ---------------------------------------------------------------------------
// Exclusão — fork 1/#52: o alcance pergunta.
// ---------------------------------------------------------------------------

export const EsquemaModoDeExclusao = registrarEsquema(
  'ModoDeExclusao',
  z.enum(['esta', 'todas', 'a-partir-desta']),
);
