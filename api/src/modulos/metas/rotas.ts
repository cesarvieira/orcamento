/**
 * AS ROTAS DE METAS (EF-07) — o cofrinho, o CRUD, e o ato de guardar.
 *
 * ⛔ Regra #0: RN-33..RN-35 e D1..D5 vêm de
 * `.preator/skills/negocio/metas-e-reservas/SKILL.md`, citando
 * `docs/especificacoes/EF-07-metas.md` §1/§2 como fonte primária.
 *
 * Padrão de `familiaId`/`autorMembroId` idêntico a `modulos/faturas/rotas.ts`:
 * toda rota exige sessão; `familiaId` vem de `familiaDaRequisicao(req)` e o
 * autor de `membroDaRequisicao(req)` — nunca do corpo (R1 · D-05).
 *
 * D2/D5 — a conta de origem e a meta de destino do "guardar" vêm do CORPO/
 * caminho, escolhidas pelo usuário. Nunca inferidas.
 */
import type { Router as RouterType } from 'express';
import { Router } from 'express';

import { db } from '../../db';
import {
  exigirSessao,
  familiaDaRequisicao,
  membroDaRequisicao,
} from '../../http/middleware/tenant';
import { registrarRota } from '../../openapi/registro';
import { CABECALHO_ORIGEM_CLIENTE, emitirInvalidacao } from '../../realtime/emissor';
import { EsquemaAtualizarMeta, EsquemaGuardar, EsquemaNovaMeta } from './esquemas';
import {
  atualizarMeta,
  criarMeta,
  excluirMeta,
  guardar,
  listarMetas,
} from './servico';

export const rotasDeMetas: RouterType = Router();

/**
 * Toda mutação de meta invalida DUAS leituras: `metas` (o cofrinho em si) e
 * `contas` (o guardar move dinheiro de verdade entre contas — RN-33; e
 * criar/excluir um cofrinho cria/apaga a conta RESERVA vinculada, D3). R3 —
 * só invalidação, nunca o número recalculado.
 */
function invalidarMetas(familiaId: string, origemClienteId: string | null): void {
  emitirInvalidacao({ familiaId, recurso: 'metas', origemClienteId });
  emitirInvalidacao({ familiaId, recurso: 'contas', origemClienteId });
}

const MENSAGEM_CORPO_INVALIDO = 'Informe nome (não vazio) e alvoCentavos (inteiro, > 0).';

// ---------------------------------------------------------------------------
// GET /metas — os cofrinhos da família da SESSÃO, com acumulado derivado
// ---------------------------------------------------------------------------

registrarRota({
  metodo: 'get',
  caminho: '/metas',
  resumo: 'Os cofrinhos da família da sessão, com o acumulado derivado (EF-07 §1)',
  etiquetas: ['metas'],
  exigeSessao: true,
  respostas: [
    { status: 200, descricao: 'Os cofrinhos da família', esquema: 'MetasListadas' },
    { status: 401, descricao: 'Sem sessão', esquema: 'Erro' },
  ],
});

rotasDeMetas.get('/metas', exigirSessao, async (req, res, next) => {
  try {
    const familiaId = familiaDaRequisicao(req);
    const metas = await listarMetas(db, familiaId);
    res.json({ metas });
  } catch (erro) {
    next(erro);
  }
});

// ---------------------------------------------------------------------------
// POST /metas — cria um cofrinho (D3: junto, a conta RESERVA dele)
// ---------------------------------------------------------------------------

registrarRota({
  metodo: 'post',
  caminho: '/metas',
  resumo: 'Cria um cofrinho na família da sessão — D3: junto, cria a conta RESERVA dele (saldo inicial 0)',
  etiquetas: ['metas'],
  exigeSessao: true,
  corpo: 'NovaMeta',
  respostas: [
    { status: 201, descricao: 'Cofrinho criado', esquema: 'Meta' },
    { status: 401, descricao: 'Sem sessão', esquema: 'Erro' },
    { status: 422, descricao: 'Corpo inválido', esquema: 'Erro' },
  ],
});

rotasDeMetas.post('/metas', exigirSessao, async (req, res, next) => {
  try {
    const analise = EsquemaNovaMeta.safeParse(req.body);
    if (!analise.success) {
      res.status(422).json({ erro: 'corpo_invalido', mensagem: MENSAGEM_CORPO_INVALIDO });
      return;
    }

    const familiaId = familiaDaRequisicao(req);
    const meta = await criarMeta(db, familiaId, analise.data);

    invalidarMetas(familiaId, req.get(CABECALHO_ORIGEM_CLIENTE) ?? null);

    res.status(201).json(meta);
  } catch (erro) {
    next(erro);
  }
});

// ---------------------------------------------------------------------------
// PATCH /metas/:id — edita nome e alvo (contaReservaId nunca muda, D3)
// ---------------------------------------------------------------------------

registrarRota({
  metodo: 'patch',
  caminho: '/metas/:id',
  resumo: 'Atualiza nome e alvo de um cofrinho da família da sessão (a conta RESERVA vinculada nunca muda, D3)',
  etiquetas: ['metas'],
  exigeSessao: true,
  corpo: 'AtualizarMeta',
  respostas: [
    { status: 200, descricao: 'Cofrinho atualizado', esquema: 'Meta' },
    { status: 401, descricao: 'Sem sessão', esquema: 'Erro' },
    { status: 404, descricao: 'Cofrinho inexistente nesta família', esquema: 'Erro' },
    { status: 422, descricao: 'Corpo inválido', esquema: 'Erro' },
  ],
});

rotasDeMetas.patch('/metas/:id', exigirSessao, async (req, res, next) => {
  try {
    const analise = EsquemaAtualizarMeta.safeParse(req.body);
    if (!analise.success) {
      res.status(422).json({ erro: 'corpo_invalido', mensagem: MENSAGEM_CORPO_INVALIDO });
      return;
    }

    const familiaId = familiaDaRequisicao(req);
    const meta = await atualizarMeta(db, familiaId, req.params.id as string, analise.data);

    if (!meta) {
      // Mesma resposta para "não existe" e "é de outra família" — não é
      // omissão: distinguir vazaria a EXISTÊNCIA de um id de outra família.
      res.status(404).json({ erro: 'meta_nao_encontrada', mensagem: 'Cofrinho inexistente.' });
      return;
    }

    invalidarMetas(familiaId, req.get(CABECALHO_ORIGEM_CLIENTE) ?? null);

    res.json(meta);
  } catch (erro) {
    next(erro);
  }
});

// ---------------------------------------------------------------------------
// DELETE /metas/:id — apaga o cofrinho (e a conta RESERVA vinculada, via
// cascade) — se ela não tiver lançamento nenhum (RN-06, reaproveitada).
// ---------------------------------------------------------------------------

registrarRota({
  metodo: 'delete',
  caminho: '/metas/:id',
  resumo: 'Apaga um cofrinho da família da sessão e a conta RESERVA vinculada, se nunca recebeu transferência',
  etiquetas: ['metas'],
  exigeSessao: true,
  respostas: [
    { status: 204, descricao: 'Cofrinho apagado' },
    { status: 401, descricao: 'Sem sessão', esquema: 'Erro' },
    { status: 404, descricao: 'Cofrinho inexistente nesta família', esquema: 'Erro' },
    {
      status: 409,
      descricao: 'O cofrinho já recebeu alguma transferência (guardou ≥ 1 vez) e não pode ser apagado',
      esquema: 'Erro',
    },
  ],
});

rotasDeMetas.delete('/metas/:id', exigirSessao, async (req, res, next) => {
  try {
    const familiaId = familiaDaRequisicao(req);
    const resultado = await excluirMeta(db, familiaId, req.params.id as string);

    if (resultado === 'nao_encontrada') {
      res.status(404).json({ erro: 'meta_nao_encontrada', mensagem: 'Cofrinho inexistente.' });
      return;
    }

    if (resultado === 'tem_lancamentos') {
      res.status(409).json({
        erro: 'meta_com_lancamentos',
        mensagem: 'Este cofrinho já recebeu alguma transferência e não pode ser apagado.',
      });
      return;
    }

    invalidarMetas(familiaId, req.get(CABECALHO_ORIGEM_CLIENTE) ?? null);

    res.status(204).end();
  } catch (erro) {
    next(erro);
  }
});

// ---------------------------------------------------------------------------
// POST /metas/:id/guardar — RN-33/RN-34 (D1)/D2/D5.
// ---------------------------------------------------------------------------

registrarRota({
  metodo: 'post',
  caminho: '/metas/:id/guardar',
  resumo:
    'Guarda dinheiro num cofrinho — gera uma TRANSFERENCIA real (RN-33) da conta DEBITO escolhida (D2) ' +
    'para a conta RESERVA do cofrinho, dentro do não alocado da competência (RN-34/D1)',
  etiquetas: ['metas'],
  exigeSessao: true,
  corpo: 'Guardar',
  respostas: [
    { status: 200, descricao: 'Guardado — o cofrinho com o acumulado atualizado', esquema: 'Meta' },
    { status: 400, descricao: 'A conta de origem informada não é uma conta DEBITO', esquema: 'Erro' },
    { status: 401, descricao: 'Sem sessão', esquema: 'Erro' },
    { status: 404, descricao: 'Cofrinho ou conta de origem inexistente nesta família', esquema: 'Erro' },
    {
      status: 409,
      descricao: 'RN-34/D1 — o valor excede o não alocado da competência (ou o não alocado já é ≤ 0)',
      esquema: 'Erro',
    },
    { status: 422, descricao: 'Corpo inválido', esquema: 'Erro' },
  ],
});

rotasDeMetas.post('/metas/:id/guardar', exigirSessao, async (req, res, next) => {
  try {
    const analise = EsquemaGuardar.safeParse(req.body);
    if (!analise.success) {
      res.status(422).json({
        erro: 'corpo_invalido',
        mensagem: 'Informe contaOrigemId, valorCentavos (inteiro, > 0) e data (AAAA-MM-DD).',
      });
      return;
    }

    const familiaId = familiaDaRequisicao(req);
    const autorMembroId = membroDaRequisicao(req);
    const resultado = await guardar(db, {
      familiaId,
      autorMembroId,
      metaId: req.params.id as string,
      contaOrigemId: analise.data.contaOrigemId,
      valorCentavos: analise.data.valorCentavos,
      // D6 (tarefa #91) — a data do fato vem do CLIENTE, nunca do relógio do
      // servidor. Ver o comentário em `servico.ts#guardar`.
      data: analise.data.data,
    });

    if (resultado.tipo === 'meta_nao_encontrada') {
      res.status(404).json({ erro: 'meta_nao_encontrada', mensagem: 'Cofrinho inexistente.' });
      return;
    }
    if (resultado.tipo === 'conta_origem_nao_encontrada') {
      res.status(404).json({ erro: 'conta_nao_encontrada', mensagem: 'Conta de origem inexistente.' });
      return;
    }
    if (resultado.tipo === 'conta_origem_invalida') {
      res.status(400).json({
        erro: 'conta_origem_invalida',
        mensagem: 'A conta de origem precisa ser uma conta DEBITO.',
      });
      return;
    }
    if (resultado.tipo === 'teto_excedido') {
      res.status(409).json({
        erro: 'teto_excedido',
        mensagem: `Guardar sai do não alocado do mês: o não alocado atual é ${resultado.naoAlocadoCentavos} centavos.`,
      });
      return;
    }

    const origemClienteId = req.get(CABECALHO_ORIGEM_CLIENTE) ?? null;
    invalidarMetas(familiaId, origemClienteId);

    res.json(resultado.meta);
  } catch (erro) {
    next(erro);
  }
});
