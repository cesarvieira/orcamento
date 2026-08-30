/**
 * AS ROTAS DE FATURAS (EF-05) — a fatura em aberto de um cartão, e o pagamento.
 *
 * ⛔ Regra #0: RN-23..RN-26 vêm de
 * `.preator/skills/negocio/faturas-e-ciclo-do-cartao/SKILL.md`, citando
 * `docs/especificacoes/EF-05-faturas.md` §1/§2 como fonte primária.
 *
 * Padrão de `familiaId`/`autorMembroId` idêntico a `modulos/lancamentos/rotas.ts`:
 * toda rota exige sessão; `familiaId` vem de `familiaDaRequisicao(req)` e o
 * autor de `membroDaRequisicao(req)` — nunca do corpo (R1 · D-05).
 *
 * D3 — a conta pagadora vem do CORPO do POST (`pagaComContaId`), escolhida
 * pelo usuário. Nunca inferida (a armadilha do protótipo: "primeira conta de
 * débito").
 */
import type { Response, Router as RouterType } from 'express';
import { Router } from 'express';

import { db } from '../../db';
import {
  exigirSessao,
  familiaDaRequisicao,
  membroDaRequisicao,
} from '../../http/middleware/tenant';
import { registrarRota } from '../../openapi/registro';
import { CABECALHO_ORIGEM_CLIENTE, emitirInvalidacao } from '../../realtime/emissor';
import { EsquemaPagarFatura, PADRAO_DATA } from './esquemas';
import { listarFaturasDoCartao, pagarFatura } from './servico';

export const rotasDeFaturas: RouterType = Router();

function dataValida(valor: string): boolean {
  return PADRAO_DATA.test(valor);
}

function respostaHojeInvalido(res: Response): void {
  res.status(422).json({ erro: 'hoje_invalido', mensagem: 'Informe hoje no formato AAAA-MM-DD.' });
}

/**
 * Uma mutação de fatura invalida TRÊS leituras: `faturas` (o status/pagamento
 * em si), `contas` (o saldo derivado da conta pagadora E do cartão mudaram —
 * RN-24 é uma transferência real) e `lancamentos` (o novo lançamento de
 * pagamento aparece no extrato). R3 — só invalidação, nunca o número
 * recalculado.
 */
function invalidarPagamento(
  familiaId: string,
  competenciaDoPagamento: string,
  origemClienteId: string | null,
): void {
  emitirInvalidacao({ familiaId, recurso: 'faturas', origemClienteId });
  emitirInvalidacao({ familiaId, recurso: 'contas', origemClienteId });
  emitirInvalidacao({
    familiaId,
    recurso: 'lancamentos',
    competencia: competenciaDoPagamento,
    origemClienteId,
  });
}

// ---------------------------------------------------------------------------
// GET /faturas?contaId= — a(s) fatura(s) em aberto (D1) do cartão informado.
// ---------------------------------------------------------------------------

registrarRota({
  metodo: 'get',
  caminho: '/faturas',
  resumo:
    'A(s) fatura(s) em aberto (D1: status ABERTA + FECHADA, nunca PAGA) do cartão informado — ' +
    'ciclo, itens e limite livre (RN-23/RN-25/RN-26)',
  etiquetas: ['faturas'],
  exigeSessao: true,
  query: [
    {
      nome: 'contaId',
      obrigatorio: true,
      descricao: 'O cartão (conta CREDITO) cuja fatura se quer ver.',
      esquema: { type: 'string' },
    },
    {
      nome: 'hoje',
      obrigatorio: true,
      descricao:
        'AAAA-MM-DD — o dia corrente do CLIENTE (D6, tarefa #91), que decide ABERTA/FECHADA. ' +
        'Nunca inferido do relógio do servidor.',
      esquema: { type: 'string' },
    },
  ],
  respostas: [
    { status: 200, descricao: 'A view de fatura do cartão', esquema: 'FaturasDoCartao' },
    { status: 401, descricao: 'Sem sessão', esquema: 'Erro' },
    {
      status: 404,
      descricao: 'Conta inexistente nesta família, ou não é um cartão (CREDITO)',
      esquema: 'Erro',
    },
    { status: 422, descricao: 'contaId ausente, ou hoje ausente/fora do formato AAAA-MM-DD', esquema: 'Erro' },
  ],
});

rotasDeFaturas.get('/faturas', exigirSessao, async (req, res, next) => {
  try {
    const contaId = typeof req.query.contaId === 'string' ? req.query.contaId : undefined;
    if (!contaId) {
      res.status(422).json({ erro: 'conta_id_obrigatorio', mensagem: 'Informe contaId na query.' });
      return;
    }

    // D6 (tarefa #91) — o dia corrente vem do CLIENTE, nunca do relógio do
    // servidor. Ver o comentário em `servico.ts#listarFaturasDoCartao`.
    const hoje = typeof req.query.hoje === 'string' ? req.query.hoje : undefined;
    if (!hoje || !dataValida(hoje)) {
      respostaHojeInvalido(res);
      return;
    }

    const familiaId = familiaDaRequisicao(req);
    const resultado = await listarFaturasDoCartao(db, familiaId, contaId, hoje);

    if (!resultado) {
      res.status(404).json({
        erro: 'conta_nao_encontrada',
        mensagem: 'Conta inexistente nesta família, ou não é um cartão (CREDITO).',
      });
      return;
    }

    res.json(resultado);
  } catch (erro) {
    next(erro);
  }
});

// ---------------------------------------------------------------------------
// POST /faturas/:id/pagar — RN-24: transferência da conta escolhida (D3)
// para o cartão. Os lançamentos originais MANTÊM sua conta.
// ---------------------------------------------------------------------------

registrarRota({
  metodo: 'post',
  caminho: '/faturas/:id/pagar',
  resumo:
    'Paga uma fatura — gera uma TRANSFERENCIA da conta escolhida (D3) para o cartão (RN-24); ' +
    'os lançamentos originais mantêm sua conta (não reatribui nada).',
  etiquetas: ['faturas'],
  exigeSessao: true,
  corpo: 'PagarFatura',
  respostas: [
    { status: 200, descricao: 'Fatura paga', esquema: 'Fatura' },
    { status: 400, descricao: 'A conta pagadora é o próprio cartão', esquema: 'Erro' },
    { status: 401, descricao: 'Sem sessão', esquema: 'Erro' },
    { status: 404, descricao: 'Fatura ou conta pagadora inexistente nesta família', esquema: 'Erro' },
    { status: 409, descricao: 'Fatura já paga, ou sem valor a pagar', esquema: 'Erro' },
    { status: 422, descricao: 'Corpo inválido', esquema: 'Erro' },
  ],
});

rotasDeFaturas.post('/faturas/:id/pagar', exigirSessao, async (req, res, next) => {
  try {
    const analise = EsquemaPagarFatura.safeParse(req.body);
    if (!analise.success) {
      res.status(422).json({ erro: 'corpo_invalido', mensagem: 'Informe pagaComContaId e data (AAAA-MM-DD).' });
      return;
    }

    const familiaId = familiaDaRequisicao(req);
    const autorMembroId = membroDaRequisicao(req);
    const resultado = await pagarFatura(db, {
      familiaId,
      autorMembroId,
      faturaId: req.params.id as string,
      pagaComContaId: analise.data.pagaComContaId,
      // D6 (tarefa #91) — a data do fato vem do CLIENTE, nunca do relógio do
      // servidor. Ver o comentário em `servico.ts#pagarFatura`.
      data: analise.data.data,
    });

    if (resultado.tipo === 'fatura_nao_encontrada') {
      res.status(404).json({ erro: 'fatura_nao_encontrada', mensagem: 'Fatura inexistente nesta família.' });
      return;
    }
    if (resultado.tipo === 'conta_pagadora_nao_encontrada') {
      res.status(404).json({ erro: 'conta_nao_encontrada', mensagem: 'Conta pagadora inexistente nesta família.' });
      return;
    }
    if (resultado.tipo === 'conta_pagadora_igual_ao_cartao') {
      res.status(400).json({
        erro: 'conta_pagadora_igual_ao_cartao',
        mensagem: 'A conta pagadora não pode ser o próprio cartão.',
      });
      return;
    }
    if (resultado.tipo === 'ja_paga') {
      res.status(409).json({ erro: 'fatura_ja_paga', mensagem: 'Esta fatura já foi paga.' });
      return;
    }
    if (resultado.tipo === 'sem_valor') {
      res.status(409).json({ erro: 'fatura_sem_valor', mensagem: 'Não há fatura em aberto nesse cartão.' });
      return;
    }

    const origemClienteId = req.get(CABECALHO_ORIGEM_CLIENTE) ?? null;
    // D6 (tarefa #91) — a competência invalidada é a da DATA informada pelo
    // cliente (mesmo cálculo de `servico.ts#pagarFatura`), nunca de `pagaEm`
    // (carimbo do RELÓGIO DO SERVIDOR): usar `pagaEm` aqui reintroduziria a
    // mesma classe de defeito só que na invalidação — a família que pagou
    // uma fatura com `data` retroativa veria o mês ERRADO recarregar.
    const competenciaDoPagamento = analise.data.data.slice(0, 7);
    invalidarPagamento(familiaId, competenciaDoPagamento, origemClienteId);

    res.json(resultado.fatura);
  } catch (erro) {
    next(erro);
  }
});
