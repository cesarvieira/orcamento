/**
 * Os esquemas do módulo `faturas` (EF-05). O Zod aqui é a MESMA validação que
 * a rota usa em runtime — é dele que o contrato OpenAPI sai (D-03).
 *
 * ⛔ Regra #0: os campos e as regras RN-23..RN-26 vêm de
 * `.preator/skills/negocio/faturas-e-ciclo-do-cartao/SKILL.md` (glossário e
 * tabela "Regras de negócio"), que cita `docs/especificacoes/EF-05-faturas.md`
 * §1/§2 como fonte primária. Nada aqui foi preenchido de memória.
 */
import { z } from 'zod';

import { registrarEsquema } from '../../openapi/registro';

/**
 * `AAAA-MM-DD` — mesmo padrão de `lancamentos/esquemas.ts#PADRAO_COMPETENCIA`,
 * para validar o `?hoje=` de `GET /faturas` (D6, tarefa #91: o dia corrente
 * também vem do CLIENTE, nunca do relógio do servidor — ver o cabeçalho de
 * `servico.ts#listarFaturasDoCartao`).
 */
export const PADRAO_DATA = /^\d{4}-\d{2}-\d{2}$/;

const EsquemaStatusFatura = z.enum(['ABERTA', 'FECHADA', 'PAGA']);

/**
 * Um lançamento dentro da fatura (EF-05 §3: "itens"). Forma reduzida do
 * `Lancamento` de `modulos/lancamentos/esquemas.ts` — só os campos que a tela
 * de fatura precisa (EF-05 §3/mockup `mapLanc`); não redeclara o esquema
 * inteiro porque uma fatura só lista `DESPESA` (RN-23), nunca os outros tipos.
 */
const EsquemaItemDeFatura = registrarEsquema(
  'ItemDeFatura',
  z.object({
    id: z.string(),
    descricao: z.string(),
    valorCentavos: z.number().int(),
    data: z.string().meta({ description: 'AAAA-MM-DD.' }),
    categoriaId: z.string().nullable(),
    numeroParcela: z.number().int().nullable().meta({ description: '1-baseado; nulo fora de parcelamento.' }),
    quantidadeParcelas: z.number().int().nullable().meta({
      description: 'O total de parcelas da série (RN-20/RN-21). Nulo fora de parcelamento.',
    }),
  }),
);

/**
 * Uma fatura (cartão × ciclo, EF-05 §1). `totalCentavos` é a soma, na
 * leitura, dos itens — NUNCA persistido (`db/schema.ts#faturas`).
 *
 * ⚠️ `status` aqui é o enum ABERTA/FECHADA/PAGA — NÃO o termo de negócio
 * "fatura em aberto" (D1, que inclui ABERTA E FECHADA). Ver
 * `LimiteDoCartao.limiteLivreCentavos` abaixo para o valor que de fato
 * implementa D1.
 */
const EsquemaFatura = registrarEsquema(
  'Fatura',
  z.object({
    id: z.string(),
    contaId: z.string(),
    abreEm: z.string().meta({ description: 'AAAA-MM-DD — primeiro dia do ciclo.' }),
    fechaEm: z.string().meta({ description: 'AAAA-MM-DD — RN-23: dia em que o ciclo encerra.' }),
    venceEm: z.string().meta({ description: 'AAAA-MM-DD — dia em que a fatura deve ser paga.' }),
    status: EsquemaStatusFatura,
    totalCentavos: z.number().int().meta({
      description: 'Derivado: Σ dos lançamentos DESPESA da conta com data em [abreEm, fechaEm]. Nunca materializado.',
    }),
    pagaEm: z.string().nullable().meta({ description: 'ISO 8601. RN-24 — só preenchido quando status = PAGA.' }),
    pagaComContaId: z.string().nullable().meta({ description: 'RN-24/D3 — a conta escolhida pelo usuário ao pagar.' }),
    itens: z.array(EsquemaItemDeFatura),
  }),
);

/**
 * A resposta de `GET /faturas?contaId=`. `faturas` traz TODA fatura em
 * aberto do cartão (D1: ABERTA + FECHADA, nunca PAGA) — a corrente E a(s)
 * fechada(s) ainda não paga(s), mais antiga primeiro (`fechaEm` crescente).
 *
 * `limiteLivreCentavos` implementa RN-26/D1: `limite − Σ(fatura em aberto)`,
 * onde a soma é justamente o total de TODAS as faturas do array acima — não
 * só a do ciclo corrente (essa era a leitura estreita que D1 rejeitou).
 * `null` quando a conta não é `CREDITO` (não tem limite para ter livre).
 */
registrarEsquema(
  'FaturasDoCartao',
  z.object({
    contaId: z.string(),
    limiteCentavos: z.number().int().nullable(),
    limiteLivreCentavos: z.number().int().nullable().meta({
      description: 'RN-26: limite − Σ(fatura em aberto, D1 — ABERTA + FECHADA, nunca só o ciclo corrente).',
    }),
    faturas: z.array(EsquemaFatura),
  }),
);

/**
 * O corpo de `POST /faturas/:id/pagar` — D3: a conta pagadora vem do
 * REQUEST, o usuário escolhe. NUNCA a primeira conta de débito (armadilha do
 * protótipo, EF-05 §4/recorte-desenho §5).
 *
 * `data` — D6 (2026-08-29, tarefa #91): a data do fato vem do CLIENTE, nunca
 * do relógio do servidor. Mesmo defeito e mesmo remédio de `metas/esquemas.ts
 * #EsquemaGuardar`: a `TRANSFERENCIA` de RN-24 e a competência do pagamento
 * saem desta data (RN-15,
 * `.preator/skills/negocio/lancamentos-e-parcelamento/SKILL.md`).
 */
export const EsquemaPagarFatura = registrarEsquema(
  'PagarFatura',
  z.object({
    pagaComContaId: z
      .string()
      .meta({ description: 'D3 — a conta escolhida pelo usuário para pagar esta fatura.' }),
    data: z.iso.date().meta({
      description: 'AAAA-MM-DD — quando o pagamento aconteceu, do CLIENTE (D6). Decide a competência (RN-15).',
    }),
  }),
);
