/**
 * Os esquemas do módulo `contas` (EF-02). O Zod aqui é a MESMA validação que a
 * rota usa em runtime — é dele que o contrato OpenAPI sai (D-03).
 *
 * ⛔ Regra #0: os campos, seus tipos e as regras RN-06/RN-07/RN-08 vêm de
 * `.preator/skills/negocio/contas-e-lastro/SKILL.md` (seção "Glossário do
 * domínio" e tabela "Regras de negócio"), que por sua vez cita
 * `docs/especificacoes/EF-02-contas.md` §1/§2 como fonte primária. Nada aqui
 * foi preenchido de memória.
 */
import { z } from 'zod';

import { registrarEsquema } from '../../openapi/registro';

/** O tipo de conta — STRING no contrato (mesmo motivo do schema, ver `db/schema.ts`). */
export const EsquemaTipoConta = z.enum(['DEBITO', 'CREDITO', 'RESERVA']);

/** RN-08 — dia de fechamento/vencimento só existe em CREDITO, e vale 1–28. */
const EsquemaDiaDoMes = z
  .number()
  .int()
  .min(1)
  .max(28)
  .meta({ description: 'Dia do mês, 1–28 (RN-08): dia 29–31 não existe em todo mês.' });

const camposComuns = {
  nome: z.string().trim().min(1).meta({ description: 'Nome da conta, escolhido pela família.' }),
  icone: z.string().trim().min(1),
  cor: z.string().trim().min(1),
};

/**
 * DEBITO e RESERVA compartilham a forma: `saldoInicialCentavos` é a base sobre
 * a qual o saldo derivado soma os lançamentos (EF-02 §1). Nenhum dos dois tem
 * limite, fechamento ou vencimento — campos exclusivos de CREDITO.
 */
const EsquemaContaDebito = z.object({
  tipo: z.literal('DEBITO'),
  ...camposComuns,
  saldoInicialCentavos: z.number().int(),
});

const EsquemaContaReserva = z.object({
  tipo: z.literal('RESERVA'),
  ...camposComuns,
  saldoInicialCentavos: z.number().int(),
});

/**
 * CREDITO não tem saldo inicial (é dívida, não caixa): tem limite e as duas
 * datas do ciclo de fatura, exigidas aqui — a EF-05 (faturas) só consegue
 * calcular o ciclo se as duas sempre existirem quando o tipo é CREDITO.
 */
const EsquemaContaCredito = z.object({
  tipo: z.literal('CREDITO'),
  ...camposComuns,
  limiteCentavos: z.number().int().nonnegative(),
  diaFechamento: EsquemaDiaDoMes,
  diaVencimento: EsquemaDiaDoMes,
});

/**
 * A entrada de cadastro/edição — um esquema só, reaproveitado por criar e por
 * atualizar (ver o comentário em `rotas.ts` sobre por que PATCH usa a MESMA
 * forma inteira, não um `.partial()`).
 */
const EsquemaEntradaDeConta = z.discriminatedUnion('tipo', [
  EsquemaContaDebito,
  EsquemaContaReserva,
  EsquemaContaCredito,
]);

export const EsquemaNovaConta = registrarEsquema('NovaConta', EsquemaEntradaDeConta);
export const EsquemaAtualizarConta = registrarEsquema('AtualizarConta', EsquemaEntradaDeConta);

/**
 * A conta como o front a enxerga. `saldoCentavos` é o saldo DERIVADO (EF-02
 * §1) — nunca uma coluna. Os campos que não se aplicam ao tipo vêm nulos, não
 * ausentes: um esquema com forma fixa é mais simples para o front do que uma
 * união discriminada na leitura.
 */
export const EsquemaConta = registrarEsquema(
  'Conta',
  z.object({
    id: z.string(),
    tipo: EsquemaTipoConta,
    nome: z.string(),
    icone: z.string(),
    cor: z.string(),
    saldoInicialCentavos: z.number().int().nullable(),
    limiteCentavos: z.number().int().nullable(),
    diaFechamento: z.number().int().nullable(),
    diaVencimento: z.number().int().nullable(),
    saldoCentavos: z.number().int().meta({
      description:
        'Derivado: saldoInicialCentavos + Σ lançamentos da conta (EF-02 §1). Nunca materializado.',
    }),
  }),
);

/**
 * A resposta de `GET /contas`. `totalEmContaHojeCentavos` é a leitura de
 * RN-07: "o total 'em conta hoje' não soma reserva" (EF-02 §2/tarefa #39) —
 * soma o `saldoCentavos` de toda conta cujo tipo NÃO é RESERVA. O lastro em si
 * (caixaReal, limiteLivre) é derivação própria da EF-06 e não mora aqui.
 */
export const EsquemaContasListadas = registrarEsquema(
  'ContasListadas',
  z.object({
    contas: z.array(EsquemaConta),
    totalEmContaHojeCentavos: z.number().int(),
  }),
);
