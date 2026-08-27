/**
 * Os esquemas do módulo `orcamento` (EF-03). O Zod aqui é a MESMA validação
 * que a rota usa em runtime — é dele que o contrato OpenAPI sai (D-03).
 *
 * ⛔ Regra #0: os campos e as regras RN-09..RN-14/RN-40 vêm de
 * `.preator/skills/negocio/orcamento-por-envelope/SKILL.md` (glossário e
 * tabela "Regras de negócio"), que cita `docs/especificacoes/EF-03-orcamento.md`
 * §1/§2 como fonte primária. Nada aqui foi preenchido de memória.
 */
import { z } from 'zod';

import { registrarEsquema } from '../../openapi/registro';

/**
 * `AAAA-MM` — mesma forma da coluna `competencia` (`db/tipos.ts`). Validado
 * aqui porque é PARÂMETRO DE CAMINHO: `registrarRota` só sabe declarar
 * parâmetro de caminho como string genérica no OpenAPI (ver
 * `openapi/registro.ts`), então a forma exata é responsabilidade do handler —
 * `PADRAO_COMPETENCIA` é o que ele usa para recusar um caminho malformado
 * antes de tocar o banco.
 */
export const PADRAO_COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;

// ---------------------------------------------------------------------------
// Categoria — EF-03 §1: nome, ícone, cor. SEM VALOR (RN-09: o teto é do par
// categoria × competência, nunca da categoria).
// ---------------------------------------------------------------------------

const camposDeCategoria = {
  nome: z.string().trim().min(1).meta({ description: 'Nome da categoria, escolhido pela família.' }),
  icone: z.string().trim().min(1),
  cor: z.string().trim().min(1),
};

export const EsquemaNovaCategoria = registrarEsquema(
  'NovaCategoria',
  z.object(camposDeCategoria),
);

export const EsquemaAtualizarCategoria = registrarEsquema(
  'AtualizarCategoria',
  z.object(camposDeCategoria),
);

const EsquemaCategoria = registrarEsquema(
  'Categoria',
  z.object({
    id: z.string(),
    ...camposDeCategoria,
  }).meta({ description: 'O envelope de gasto — sem valor (RN-09). O teto é leitura da competência.' }),
);

registrarEsquema(
  'CategoriasListadas',
  z.object({ categorias: z.array(EsquemaCategoria) }),
);

// ---------------------------------------------------------------------------
// OrcamentoMes — RN-09: o teto do par categoria × competência.
// ---------------------------------------------------------------------------

const EsquemaTetoCentavos = z
  .number()
  .int()
  .nonnegative()
  .meta({ description: 'Teto em centavos (D-06). Definido diretamente aqui é sempre ≥ 0.' });

export const EsquemaDefinirTeto = registrarEsquema(
  'DefinirTeto',
  z.object({ tetoCentavos: EsquemaTetoCentavos }),
);

registrarEsquema(
  'OrcamentoMesLido',
  z.object({
    categoriaId: z.string(),
    competencia: z.string().meta({ description: 'AAAA-MM.' }),
    tetoCentavos: z.number().int().meta({
      description:
        'Pode ser negativo aqui: um remanejamento (RN-14) pode deixar o teto negativo mesmo ' +
        'que a definição direta (acima) só aceite valor ≥ 0.',
    }),
  }),
);

// ---------------------------------------------------------------------------
// RendaPrevista — atributo da competência (EF-03 §1), não da categoria.
// ---------------------------------------------------------------------------

export const EsquemaDefinirRendaPrevista = registrarEsquema(
  'DefinirRendaPrevista',
  z.object({
    rendaPrevistaCentavos: z.number().int().nonnegative().meta({
      description: 'Referência de planejamento da competência (D-06). Não é teto de nada (RN-12).',
    }),
  }),
);

// ---------------------------------------------------------------------------
// A leitura da competência — RN-10, RN-11, RN-40 num só documento.
// ---------------------------------------------------------------------------

const EsquemaCategoriaNaCompetencia = registrarEsquema(
  'CategoriaNaCompetencia',
  z.object({
    id: z.string(),
    nome: z.string(),
    icone: z.string(),
    cor: z.string(),
    tetoCentavos: z.number().int().meta({
      description: 'RN-40: 0 quando a categoria não tem OrcamentoMes nesta competência.',
    }),
    gastoCentavos: z.number().int().meta({
      description:
        'RN-10: soma dos lançamentos DESPESA da categoria nesta competência. Os lançamentos ' +
        'são da EF-04 (ainda não construída) — hoje esta soma é sempre 0 (ver servico.ts).',
    }),
    disponivelCentavos: z.number().int().meta({
      description: 'RN-10: teto − gasto. Negativo significa que a categoria estourou.',
    }),
  }),
);

registrarEsquema(
  'CompetenciaLida',
  z.object({
    competencia: z.string().meta({ description: 'AAAA-MM.' }),
    rendaPrevistaCentavos: z.number().int(),
    planejadoCentavos: z.number().int().meta({ description: 'RN-11: Σ tetos das categorias.' }),
    recebidoCentavos: z.number().int().meta({
      description:
        'RN-39 (EF-04 §2): soma dos lançamentos RECEITA desta competência. Os lançamentos são ' +
        'da EF-04 (ainda não construída) — hoje esta soma é sempre 0 (ver servico.ts).',
    }),
    naoAlocadoCentavos: z.number().int().meta({ description: 'RN-11: recebido − planejado.' }),
    categorias: z.array(EsquemaCategoriaNaCompetencia),
  }),
);

// ---------------------------------------------------------------------------
// Remanejamento — RN-13: origem, destino, valor, competência, autor.
// RN-14: sem categoria com sobra, a API permite deixar negativo — não trava.
// ---------------------------------------------------------------------------

export const EsquemaNovoRemanejamento = registrarEsquema(
  'NovoRemanejamento',
  z
    .object({
      categoriaOrigemId: z.string().meta({ description: 'De onde o teto sai.' }),
      categoriaDestinoId: z.string().meta({ description: 'Para onde o teto vai.' }),
      valorCentavos: z.number().int().positive(),
    })
    .refine(dados => dados.categoriaOrigemId !== dados.categoriaDestinoId, {
      message: 'categoriaOrigemId e categoriaDestinoId precisam ser categorias diferentes.',
      path: ['categoriaDestinoId'],
    }),
);

registrarEsquema(
  'Remanejamento',
  z.object({
    id: z.string(),
    competencia: z.string().meta({ description: 'AAAA-MM — RN-13: só a competência corrente muda.' }),
    categoriaOrigemId: z.string(),
    categoriaDestinoId: z.string(),
    valorCentavos: z.number().int(),
    autorMembroId: z.string().meta({ description: 'RN-13: quem fez o remanejamento.' }),
    criadoEm: z.string().meta({ description: 'ISO 8601.' }),
  }),
);
