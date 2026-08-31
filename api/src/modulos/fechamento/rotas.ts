import type { Router as RouterType } from 'express';
import { Router } from 'express';
import { db } from '../../db';

import { exigirSessao, familiaDaRequisicao, membroDaRequisicao } from '../../http/middleware/tenant';
import { registrarRota } from '../../openapi/registro';
import { PADRAO_COMPETENCIA } from './esquemas';
import { resumoDeFechamento, fecharCompetencia } from './servico';
import './esquemas';

export const rotasDeFechamento: RouterType = Router();

// ---------------------------------------------------------------------------
// GET /competencias/:competencia/fechamento — Resumo para fechamento
// ---------------------------------------------------------------------------

registrarRota({
  metodo: 'get',
  caminho: '/competencias/:competencia/fechamento',
  resumo: 'Resumo da competência para o fechamento (recebido, planejado, gasto, sobra projetada, categorias estouradas e status)',
  etiquetas: ['fechamento'],
  exigeSessao: true,
  respostas: [
    { status: 200, descricao: 'Resumo do fechamento da competência', esquema: 'ResumoFechamento' },
    { status: 401, descricao: 'Sem sessão', esquema: 'Erro' },
    { status: 422, descricao: 'Competência fora do formato AAAA-MM', esquema: 'Erro' },
  ],
});

rotasDeFechamento.get('/competencias/:competencia/fechamento', exigirSessao, async (req, res, _next) => {
  const competencia = req.params.competencia as string;
  
  if (!PADRAO_COMPETENCIA.test(competencia)) {
    return res.status(422).json({ erro: 'parametros_invalidos', mensagem: 'Competência fora do formato AAAA-MM' });
  }

  const familiaId = familiaDaRequisicao(req);
  const resumo = await resumoDeFechamento(db, familiaId, competencia);
  res.status(200).json(resumo);
});

// ---------------------------------------------------------------------------
// POST /competencias/:competencia/fechar — Executa o fechamento
// ---------------------------------------------------------------------------

registrarRota({
  metodo: 'post',
  caminho: '/competencias/:competencia/fechar',
  resumo: 'Realiza o fechamento da competência, selando-a e apurando a sobra que vai para o lastro do próximo mês.',
  etiquetas: ['fechamento'],
  exigeSessao: true,
  respostas: [
    { status: 200, descricao: 'Competência fechada com sucesso', esquema: 'FechamentoMes' },
    { status: 400, descricao: 'Competência já se encontra fechada', esquema: 'Erro' },
    { status: 401, descricao: 'Sem sessão', esquema: 'Erro' },
    { status: 422, descricao: 'Competência fora do formato AAAA-MM', esquema: 'Erro' },
  ],
});

rotasDeFechamento.post('/competencias/:competencia/fechar', exigirSessao, async (req, res, _next) => {
  const competencia = req.params.competencia as string;
  
  if (!PADRAO_COMPETENCIA.test(competencia)) {
    return res.status(422).json({ erro: 'parametros_invalidos', mensagem: 'Competência fora do formato AAAA-MM' });
  }

  const familiaId = familiaDaRequisicao(req);
  const membroId = membroDaRequisicao(req);
  const resultado = await fecharCompetencia(db, familiaId, membroId, competencia);
  
  if (resultado.tipo === 'ja_fechado') {
    return res.status(400).json({ erro: 'regra_de_negocio', mensagem: 'Competência já se encontra fechada' });
  }
  
  res.status(200).json(resultado.fechamento);
});
