/**
 * AS ROTAS DE CONTAS (EF-02) — cadastro e saldo das contas da família.
 *
 * ⛔ Regra #0: RN-06, RN-07 e RN-08 vêm de
 * `.preator/skills/negocio/contas-e-lastro/SKILL.md` (tabela "Regras de
 * negócio" e glossário), citando `docs/especificacoes/EF-02-contas.md` §1/§2
 * como fonte primária. Nada aqui foi decidido de memória.
 *
 * Padrão de `familiaId` idêntico a `modulos/familia/rotas.ts`: toda rota exige
 * sessão e lê a família de `familiaDaRequisicao(req)` — nunca do corpo, nunca
 * da query, nunca do caminho (R1 · D-05). `registrarRota` recusaria sozinho
 * qualquer tentativa de pôr `familiaId` no caminho.
 */
import type { Router as RouterType } from 'express';
import { Router } from 'express';

import { db } from '../../db';
import {
  exigirSessao,
  familiaDaRequisicao,
} from '../../http/middleware/tenant';
import { registrarRota } from '../../openapi/registro';
import { CABECALHO_ORIGEM_CLIENTE, emitirInvalidacao } from '../../realtime/emissor';
import { EsquemaAtualizarConta, EsquemaNovaConta } from './esquemas';
import {
  atualizarConta,
  criarConta,
  excluirConta,
  listarContas,
} from './servico';

export const rotasDeContas: RouterType = Router();

function invalidarContas(familiaId: string, origemClienteId: string | null): void {
  emitirInvalidacao({ familiaId, recurso: 'contas', origemClienteId });
}

// ---------------------------------------------------------------------------
// GET /contas — as contas da família da SESSÃO
// ---------------------------------------------------------------------------

registrarRota({
  metodo: 'get',
  caminho: '/contas',
  resumo: 'As contas da família da sessão, com saldo derivado',
  etiquetas: ['contas'],
  exigeSessao: true,
  respostas: [
    { status: 200, descricao: 'As contas da família', esquema: 'ContasListadas' },
    { status: 401, descricao: 'Sem sessão', esquema: 'Erro' },
  ],
});

rotasDeContas.get('/contas', exigirSessao, async (req, res, next) => {
  try {
    const familiaId = familiaDaRequisicao(req);
    const resultado = await listarContas(db, familiaId);
    res.json(resultado);
  } catch (erro) {
    next(erro);
  }
});

// ---------------------------------------------------------------------------
// POST /contas — cria uma conta na família da SESSÃO
// ---------------------------------------------------------------------------

registrarRota({
  metodo: 'post',
  caminho: '/contas',
  resumo: 'Cria uma conta (DEBITO, CREDITO ou RESERVA) na família da sessão',
  etiquetas: ['contas'],
  exigeSessao: true,
  corpo: 'NovaConta',
  respostas: [
    { status: 201, descricao: 'Conta criada', esquema: 'Conta' },
    { status: 401, descricao: 'Sem sessão', esquema: 'Erro' },
    {
      status: 422,
      descricao: 'Corpo inválido — inclusive RN-08 (fechamento/vencimento fora de 1–28)',
      esquema: 'Erro',
    },
  ],
});

rotasDeContas.post('/contas', exigirSessao, async (req, res, next) => {
  try {
    const analise = EsquemaNovaConta.safeParse(req.body);
    if (!analise.success) {
      res.status(422).json({
        erro: 'corpo_invalido',
        mensagem:
          'Informe tipo, nome, ícone e cor. Débito e reserva pedem saldo inicial; ' +
          'cartão pede limite, fechamento e vencimento (1–28).',
      });
      return;
    }

    const familiaId = familiaDaRequisicao(req);
    const conta = await criarConta(db, familiaId, analise.data);

    invalidarContas(familiaId, req.get(CABECALHO_ORIGEM_CLIENTE) ?? null);

    res.status(201).json(conta);
  } catch (erro) {
    next(erro);
  }
});

// ---------------------------------------------------------------------------
// PATCH /contas/:id — atualiza uma conta da família da SESSÃO
// ---------------------------------------------------------------------------
//
// ⚠️ DECISÃO DE DESENHO: o corpo do PATCH usa a MESMA forma inteira do POST
// (`AtualizarConta` é o mesmo esquema de `NovaConta`), não um `.partial()`.
// A EF-02 §3 descreve editar como "o membro passa pelo MESMO fluxo do
// cadastro" — o formulário reabre preenchido e é reenviado inteiro. Um
// `.partial()` cruzado com união discriminada por `tipo` (o que muda quando
// só ALGUNS campos do tipo novo chegam?) é ambiguidade que a especificação
// não cobre; exigir o objeto inteiro elimina a ambiguidade sem inventar regra.

registrarRota({
  metodo: 'patch',
  caminho: '/contas/:id',
  resumo: 'Atualiza uma conta da família da sessão (substitui os dados do tipo)',
  etiquetas: ['contas'],
  exigeSessao: true,
  corpo: 'AtualizarConta',
  respostas: [
    { status: 200, descricao: 'Conta atualizada', esquema: 'Conta' },
    { status: 401, descricao: 'Sem sessão', esquema: 'Erro' },
    { status: 404, descricao: 'Conta inexistente nesta família', esquema: 'Erro' },
    {
      status: 422,
      descricao: 'Corpo inválido — inclusive RN-08 (fechamento/vencimento fora de 1–28)',
      esquema: 'Erro',
    },
  ],
});

rotasDeContas.patch('/contas/:id', exigirSessao, async (req, res, next) => {
  try {
    const analise = EsquemaAtualizarConta.safeParse(req.body);
    if (!analise.success) {
      res.status(422).json({
        erro: 'corpo_invalido',
        mensagem:
          'Informe tipo, nome, ícone e cor. Débito e reserva pedem saldo inicial; ' +
          'cartão pede limite, fechamento e vencimento (1–28).',
      });
      return;
    }

    const familiaId = familiaDaRequisicao(req);
    const conta = await atualizarConta(db, familiaId, req.params.id as string, analise.data);

    if (!conta) {
      // Mesma resposta para "não existe" e "é de outra família" — não é
      // omissão: distinguir vazaria a EXISTÊNCIA de um id de outra família.
      res.status(404).json({ erro: 'conta_nao_encontrada', mensagem: 'Conta inexistente.' });
      return;
    }

    invalidarContas(familiaId, req.get(CABECALHO_ORIGEM_CLIENTE) ?? null);

    res.json(conta);
  } catch (erro) {
    next(erro);
  }
});

// ---------------------------------------------------------------------------
// DELETE /contas/:id — exclui uma conta da família da SESSÃO (RN-06)
// ---------------------------------------------------------------------------

registrarRota({
  metodo: 'delete',
  caminho: '/contas/:id',
  resumo: 'Exclui uma conta da família da sessão, se ela não tiver lançamentos (RN-06)',
  etiquetas: ['contas'],
  exigeSessao: true,
  respostas: [
    { status: 204, descricao: 'Conta excluída' },
    { status: 401, descricao: 'Sem sessão', esquema: 'Erro' },
    { status: 404, descricao: 'Conta inexistente nesta família', esquema: 'Erro' },
    { status: 409, descricao: 'Conta tem lançamentos e não pode ser excluída (RN-06)', esquema: 'Erro' },
  ],
});

rotasDeContas.delete('/contas/:id', exigirSessao, async (req, res, next) => {
  try {
    const familiaId = familiaDaRequisicao(req);
    const resultado = await excluirConta(db, familiaId, req.params.id as string);

    if (resultado === 'nao_encontrada') {
      res.status(404).json({ erro: 'conta_nao_encontrada', mensagem: 'Conta inexistente.' });
      return;
    }

    if (resultado === 'tem_lancamentos') {
      res.status(409).json({
        erro: 'conta_com_lancamentos',
        mensagem: 'Esta conta tem lançamentos e não pode ser excluída.',
      });
      return;
    }

    invalidarContas(familiaId, req.get(CABECALHO_ORIGEM_CLIENTE) ?? null);

    res.status(204).end();
  } catch (erro) {
    next(erro);
  }
});
