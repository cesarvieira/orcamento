import type { Router as RouterType } from 'express';
import { Router } from 'express';

import { exigirSessao } from '../../http/middleware/tenant';
import { registrarRota } from '../../openapi/registro';
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
  // Stub - a implementação virá em outra tarefa (provavelmente frontend precisa dos DTOs antes).
  res.status(501).json({ erro: 'nao_implementado', mensagem: 'Em construção.' });
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
  // Stub - a implementação virá em outra tarefa.
  res.status(501).json({ erro: 'nao_implementado', mensagem: 'Em construção.' });
});
