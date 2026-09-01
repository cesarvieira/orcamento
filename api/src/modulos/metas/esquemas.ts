/**
 * Os esquemas do módulo `metas` (EF-07). O Zod aqui é a MESMA validação que a
 * rota usa em runtime — é dele que o contrato OpenAPI sai (D-03).
 *
 * ⛔ Regra #0: os campos e as regras RN-33..RN-35 e D1..D5 vêm de
 * `.preator/skills/negocio/metas-e-reservas/SKILL.md` (glossário e tabela
 * "Regras de negócio"), que cita `docs/especificacoes/EF-07-metas.md` §1/§2
 * como fonte primária. Nada aqui foi preenchido de memória.
 */
import { z } from 'zod';

import { registrarEsquema } from '../../openapi/registro';

/**
 * A entrada de criar/editar um cofrinho — nome e alvo. `contaReservaId` NÃO
 * aparece aqui: ela é criada pelo servidor junto com a meta (D3), nunca
 * escolhida ou informada pelo cliente — nem na criação, nem na edição (o
 * vínculo 1:1 é imutável).
 */
const camposDeMeta = {
  nome: z.string().trim().min(1).meta({ description: 'Nome do cofrinho, escolhido pela família.' }),
  alvoCentavos: z.number().int().positive().meta({
    description: 'Quanto a família pretende juntar (D-06 — inteiro em centavos). EF-07 §1.',
  }),
};

export const EsquemaNovaMeta = registrarEsquema('NovaMeta', z.object(camposDeMeta));
export const EsquemaAtualizarMeta = registrarEsquema('AtualizarMeta', z.object(camposDeMeta));

/**
 * O cofrinho como o front o enxerga. `acumuladoCentavos` é DERIVADO (EF-07
 * §1) — a soma das transferências para `contaReservaId`, nunca uma coluna.
 */
const EsquemaMeta = registrarEsquema(
  'Meta',
  z.object({
    id: z.string(),
    nome: z.string(),
    alvoCentavos: z.number().int(),
    contaReservaId: z.string().meta({ description: 'D3 — a conta RESERVA própria deste cofrinho, 1:1.' }),
    acumuladoCentavos: z.number().int().nonnegative().meta({
      description:
        'Derivado: soma das TRANSFERENCIA cujo contaDestinoId é contaReservaId. Nunca materializado (EF-07 §1).',
    }),
  }),
);

registrarEsquema('MetasListadas', z.object({ metas: z.array(EsquemaMeta) }));

/**
 * O corpo de `POST /metas/:id/guardar` — D2/D5: as DUAS pontas vêm do
 * REQUEST, escolhidas pelo usuário no ato. `contaOrigemId` nunca é inferida
 * (mesma armadilha, mesmo remédio, de `pagaComContaId` em `faturas/esquemas.ts`).
 *
 * `data` — D6 (2026-08-29, tarefa #91): a data do fato vem do CLIENTE, nunca
 * do relógio do servidor (`hojeIso()` em UTC virava o dia seguinte das 21h à
 * meia-noite no fuso do Brasil, e no último dia do mês isso empurrava a
 * competência inteira para o mês errado — RN-34/D1 conferido contra o teto
 * do mês seguinte). Espelha literalmente `lancamentos/esquemas.ts:31`
 * (`camposComuns.data`) — mesmo campo, mesmo formato, mesma regra: RN-15
 * (`.preator/skills/negocio/lancamentos-e-parcelamento/SKILL.md`) já
 * estabelece que a competência segue a `data`, nunca o relógio; guardar passa
 * a seguir o mesmo caminho.
 */
export const EsquemaGuardar = registrarEsquema(
  'Guardar',
  z.object({
    contaOrigemId: z.string().meta({ description: 'D2 — a conta DEBITO escolhida pelo usuário para guardar.' }),
    valorCentavos: z.number().int().positive().meta({
      description: 'Quanto guardar (D-06 — inteiro em centavos). Sujeito ao teto de RN-34/D1.',
    }),
    data: z.iso.date().meta({
      description:
        'AAAA-MM-DD — quando o ato aconteceu, do CLIENTE (D6). A competência de RN-34/D1 é ' +
        'calculada a partir DESTA data (RN-15), nunca do relógio do servidor.',
    }),
  }),
);
