/**
 * AS ROTAS DE ORÇAMENTO (EF-03) — categorias, teto por competência, renda
 * prevista e remanejamento.
 *
 * ⛔ Regra #0: RN-09..RN-14 e RN-40 vêm de
 * `.preator/skills/negocio/orcamento-por-envelope/SKILL.md` (glossário e
 * tabela "Regras de negócio"), citando `docs/especificacoes/EF-03-orcamento.md`
 * §1/§2 como fonte primária. Nada aqui foi decidido de memória.
 *
 * Padrão de `familiaId` idêntico a `modulos/contas/rotas.ts`: toda rota exige
 * sessão e lê a família de `familiaDaRequisicao(req)` — nunca do corpo, nunca
 * da query, nunca do caminho (R1 · D-05). `registrarRota` recusaria sozinho
 * qualquer tentativa de pôr `familiaId` no caminho.
 *
 * ⚠️ `/categorias` e `/competencias` estavam livres na tarefa — a forma
 * abaixo é a decisão desta implementação: um recurso `Categoria` (sem valor,
 * RN-09) separado da LEITURA da competência (`GET /competencias/:competencia`,
 * que junta teto/gasto/disponível de cada categoria — RN-10, RN-11, RN-40).
 * `POST /competencias/:competencia/remanejamentos` é o único caminho FIXO
 * pela tarefa (RN-13).
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
import {
  EsquemaAtualizarCategoria,
  EsquemaDefinirRendaPrevista,
  EsquemaDefinirTeto,
  EsquemaNovaCategoria,
  EsquemaNovoRemanejamento,
  PADRAO_COMPETENCIA,
} from './esquemas';
import {
  atualizarCategoria,
  criarCategoria,
  criarRemanejamento,
  definirRendaPrevista,
  definirTeto,
  excluirCategoria,
  lerCompetencia,
  listarCategorias,
} from './servico';

export const rotasDeOrcamento: RouterType = Router();

/**
 * Todo mutador deste módulo emite `orcamento`, como a tarefa pede. Quando a
 * mudança pertence a UMA competência (teto, renda prevista, remanejamento),
 * ela viaja junto; quando é uma mudança de `Categoria` — que não tem
 * competência, RN-09 — a invalidação sai com `competencia: null`
 * ("não é mensal", conforme `openapi/esquemas.ts#EsquemaInvalidacao"), e o
 * cliente refaz a leitura de qualquer competência aberta.
 */
function invalidarOrcamento(
  familiaId: string,
  competencia: string | null,
  origemClienteId: string | null,
): void {
  emitirInvalidacao({ familiaId, recurso: 'orcamento', competencia, origemClienteId });
}

function competenciaValida(valor: string): boolean {
  return PADRAO_COMPETENCIA.test(valor);
}

function respostaCompetenciaInvalida(res: Response): void {
  res.status(422).json({
    erro: 'competencia_invalida',
    mensagem: 'Competência precisa estar no formato AAAA-MM.',
  });
}

// ---------------------------------------------------------------------------
// GET /categorias — as categorias da família da SESSÃO (sem valor, RN-09)
// ---------------------------------------------------------------------------

registrarRota({
  metodo: 'get',
  caminho: '/categorias',
  resumo: 'As categorias da família da sessão (nome, ícone, cor — sem valor)',
  etiquetas: ['orcamento'],
  exigeSessao: true,
  respostas: [
    { status: 200, descricao: 'As categorias da família', esquema: 'CategoriasListadas' },
    { status: 401, descricao: 'Sem sessão', esquema: 'Erro' },
  ],
});

rotasDeOrcamento.get('/categorias', exigirSessao, async (req, res, next) => {
  try {
    const familiaId = familiaDaRequisicao(req);
    const categorias = await listarCategorias(db, familiaId);
    res.json({ categorias });
  } catch (erro) {
    next(erro);
  }
});

// ---------------------------------------------------------------------------
// POST /categorias — cria uma categoria na família da SESSÃO
// ---------------------------------------------------------------------------

registrarRota({
  metodo: 'post',
  caminho: '/categorias',
  resumo: 'Cria uma categoria (envelope de gasto) na família da sessão',
  etiquetas: ['orcamento'],
  exigeSessao: true,
  corpo: 'NovaCategoria',
  respostas: [
    { status: 201, descricao: 'Categoria criada', esquema: 'Categoria' },
    { status: 401, descricao: 'Sem sessão', esquema: 'Erro' },
    { status: 422, descricao: 'Corpo inválido — informe nome, ícone e cor', esquema: 'Erro' },
  ],
});

rotasDeOrcamento.post('/categorias', exigirSessao, async (req, res, next) => {
  try {
    const analise = EsquemaNovaCategoria.safeParse(req.body);
    if (!analise.success) {
      res.status(422).json({
        erro: 'corpo_invalido',
        mensagem: 'Informe nome, ícone e cor.',
      });
      return;
    }

    const familiaId = familiaDaRequisicao(req);
    const categoria = await criarCategoria(db, familiaId, analise.data);

    invalidarOrcamento(familiaId, null, req.get(CABECALHO_ORIGEM_CLIENTE) ?? null);

    res.status(201).json(categoria);
  } catch (erro) {
    next(erro);
  }
});

// ---------------------------------------------------------------------------
// PATCH /categorias/:id — edita nome, ícone, cor (folha "editar categoria")
// ---------------------------------------------------------------------------

registrarRota({
  metodo: 'patch',
  caminho: '/categorias/:id',
  resumo: 'Atualiza nome, ícone e cor de uma categoria da família da sessão',
  etiquetas: ['orcamento'],
  exigeSessao: true,
  corpo: 'AtualizarCategoria',
  respostas: [
    { status: 200, descricao: 'Categoria atualizada', esquema: 'Categoria' },
    { status: 401, descricao: 'Sem sessão', esquema: 'Erro' },
    { status: 404, descricao: 'Categoria inexistente nesta família', esquema: 'Erro' },
    { status: 422, descricao: 'Corpo inválido — informe nome, ícone e cor', esquema: 'Erro' },
  ],
});

rotasDeOrcamento.patch('/categorias/:id', exigirSessao, async (req, res, next) => {
  try {
    const analise = EsquemaAtualizarCategoria.safeParse(req.body);
    if (!analise.success) {
      res.status(422).json({ erro: 'corpo_invalido', mensagem: 'Informe nome, ícone e cor.' });
      return;
    }

    const familiaId = familiaDaRequisicao(req);
    const categoria = await atualizarCategoria(db, familiaId, req.params.id as string, analise.data);

    if (!categoria) {
      // Mesma resposta para "não existe" e "é de outra família" — não é
      // omissão: distinguir vazaria a EXISTÊNCIA de um id de outra família.
      res.status(404).json({ erro: 'categoria_nao_encontrada', mensagem: 'Categoria inexistente.' });
      return;
    }

    invalidarOrcamento(familiaId, null, req.get(CABECALHO_ORIGEM_CLIENTE) ?? null);

    res.json(categoria);
  } catch (erro) {
    next(erro);
  }
});

// ---------------------------------------------------------------------------
// DELETE /categorias/:id — apaga a categoria (EF-03 §3: "criar · apagar")
// ---------------------------------------------------------------------------

registrarRota({
  metodo: 'delete',
  caminho: '/categorias/:id',
  resumo: 'Apaga uma categoria da família da sessão (leva junto teto e histórico)',
  etiquetas: ['orcamento'],
  exigeSessao: true,
  respostas: [
    { status: 204, descricao: 'Categoria apagada' },
    { status: 401, descricao: 'Sem sessão', esquema: 'Erro' },
    { status: 404, descricao: 'Categoria inexistente nesta família', esquema: 'Erro' },
  ],
});

rotasDeOrcamento.delete('/categorias/:id', exigirSessao, async (req, res, next) => {
  try {
    const familiaId = familiaDaRequisicao(req);
    const resultado = await excluirCategoria(db, familiaId, req.params.id as string);

    if (resultado === 'nao_encontrada') {
      res.status(404).json({ erro: 'categoria_nao_encontrada', mensagem: 'Categoria inexistente.' });
      return;
    }

    invalidarOrcamento(familiaId, null, req.get(CABECALHO_ORIGEM_CLIENTE) ?? null);

    res.status(204).end();
  } catch (erro) {
    next(erro);
  }
});

// ---------------------------------------------------------------------------
// GET /competencias/:competencia — a leitura da competência (RN-10/11/40)
// ---------------------------------------------------------------------------

registrarRota({
  metodo: 'get',
  caminho: '/competencias/:competencia',
  resumo: 'A leitura de uma competência: renda prevista, planejado, recebido, não alocado e as categorias com teto/gasto/disponível',
  etiquetas: ['orcamento'],
  exigeSessao: true,
  respostas: [
    { status: 200, descricao: 'A leitura da competência', esquema: 'CompetenciaLida' },
    { status: 401, descricao: 'Sem sessão', esquema: 'Erro' },
    { status: 422, descricao: 'Competência fora do formato AAAA-MM', esquema: 'Erro' },
  ],
});

rotasDeOrcamento.get('/competencias/:competencia', exigirSessao, async (req, res, next) => {
  try {
    const competencia = req.params.competencia as string;
    if (!competenciaValida(competencia)) {
      respostaCompetenciaInvalida(res);
      return;
    }

    const familiaId = familiaDaRequisicao(req);
    const leitura = await lerCompetencia(db, familiaId, competencia);
    res.json(leitura);
  } catch (erro) {
    next(erro);
  }
});

// ---------------------------------------------------------------------------
// PUT /competencias/:competencia/renda-prevista — RendaPrevista da competência
// ---------------------------------------------------------------------------

registrarRota({
  metodo: 'put',
  caminho: '/competencias/:competencia/renda-prevista',
  resumo: 'Define a renda prevista da competência (referência de planejamento — RN-12: não é teto)',
  etiquetas: ['orcamento'],
  exigeSessao: true,
  corpo: 'DefinirRendaPrevista',
  respostas: [
    { status: 200, descricao: 'Renda prevista definida' },
    { status: 401, descricao: 'Sem sessão', esquema: 'Erro' },
    { status: 422, descricao: 'Corpo ou competência inválidos', esquema: 'Erro' },
  ],
});

rotasDeOrcamento.put(
  '/competencias/:competencia/renda-prevista',
  exigirSessao,
  async (req, res, next) => {
    try {
      const competencia = req.params.competencia as string;
      if (!competenciaValida(competencia)) {
        respostaCompetenciaInvalida(res);
        return;
      }

      const analise = EsquemaDefinirRendaPrevista.safeParse(req.body);
      if (!analise.success) {
        res.status(422).json({
          erro: 'corpo_invalido',
          mensagem: 'Informe rendaPrevistaCentavos (inteiro, ≥ 0).',
        });
        return;
      }

      const familiaId = familiaDaRequisicao(req);
      const resultado = await definirRendaPrevista(
        db,
        familiaId,
        competencia,
        analise.data.rendaPrevistaCentavos,
      );

      invalidarOrcamento(familiaId, competencia, req.get(CABECALHO_ORIGEM_CLIENTE) ?? null);

      res.json(resultado);
    } catch (erro) {
      next(erro);
    }
  },
);

// ---------------------------------------------------------------------------
// PUT /competencias/:competencia/categorias/:categoriaId/teto — RN-09
// ---------------------------------------------------------------------------

registrarRota({
  metodo: 'put',
  caminho: '/competencias/:competencia/categorias/:categoriaId/teto',
  resumo: 'Define o teto de UMA categoria NESTA competência (RN-09) — cria ou substitui a linha de OrcamentoMes',
  etiquetas: ['orcamento'],
  exigeSessao: true,
  corpo: 'DefinirTeto',
  respostas: [
    { status: 200, descricao: 'Teto definido', esquema: 'OrcamentoMesLido' },
    { status: 401, descricao: 'Sem sessão', esquema: 'Erro' },
    { status: 404, descricao: 'Categoria inexistente nesta família', esquema: 'Erro' },
    { status: 422, descricao: 'Corpo ou competência inválidos', esquema: 'Erro' },
  ],
});

rotasDeOrcamento.put(
  '/competencias/:competencia/categorias/:categoriaId/teto',
  exigirSessao,
  async (req, res, next) => {
    try {
      const competencia = req.params.competencia as string;
      if (!competenciaValida(competencia)) {
        respostaCompetenciaInvalida(res);
        return;
      }

      const analise = EsquemaDefinirTeto.safeParse(req.body);
      if (!analise.success) {
        res.status(422).json({ erro: 'corpo_invalido', mensagem: 'Informe tetoCentavos (inteiro, ≥ 0).' });
        return;
      }

      const familiaId = familiaDaRequisicao(req);
      const resultado = await definirTeto(db, {
        familiaId,
        competencia,
        categoriaId: req.params.categoriaId as string,
        tetoCentavos: analise.data.tetoCentavos,
      });

      if (resultado === 'categoria_nao_encontrada') {
        res.status(404).json({ erro: 'categoria_nao_encontrada', mensagem: 'Categoria inexistente.' });
        return;
      }

      invalidarOrcamento(familiaId, competencia, req.get(CABECALHO_ORIGEM_CLIENTE) ?? null);

      res.json(resultado);
    } catch (erro) {
      next(erro);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /competencias/:competencia/remanejamentos — RN-13/RN-14
// ---------------------------------------------------------------------------

registrarRota({
  metodo: 'post',
  caminho: '/competencias/:competencia/remanejamentos',
  resumo: 'Remaneja teto de uma categoria de origem para uma de destino, NESTA competência (RN-13). Sem trava (RN-14).',
  etiquetas: ['orcamento'],
  exigeSessao: true,
  corpo: 'NovoRemanejamento',
  respostas: [
    { status: 201, descricao: 'Remanejamento registrado', esquema: 'Remanejamento' },
    { status: 401, descricao: 'Sem sessão', esquema: 'Erro' },
    { status: 404, descricao: 'Categoria de origem ou destino inexistente nesta família', esquema: 'Erro' },
    { status: 422, descricao: 'Corpo ou competência inválidos', esquema: 'Erro' },
  ],
});

rotasDeOrcamento.post(
  '/competencias/:competencia/remanejamentos',
  exigirSessao,
  async (req, res, next) => {
    try {
      const competencia = req.params.competencia as string;
      if (!competenciaValida(competencia)) {
        respostaCompetenciaInvalida(res);
        return;
      }

      const analise = EsquemaNovoRemanejamento.safeParse(req.body);
      if (!analise.success) {
        res.status(422).json({
          erro: 'corpo_invalido',
          mensagem: 'Informe categoriaOrigemId, categoriaDestinoId (diferentes) e valorCentavos (> 0).',
        });
        return;
      }

      const familiaId = familiaDaRequisicao(req);
      const autorMembroId = membroDaRequisicao(req);
      const resultado = await criarRemanejamento(db, {
        familiaId,
        autorMembroId,
        competencia,
        entrada: analise.data,
      });

      if (resultado.tipo === 'categoria_nao_encontrada') {
        res.status(404).json({
          erro: 'categoria_nao_encontrada',
          mensagem: 'Categoria de origem ou destino inexistente nesta família.',
        });
        return;
      }

      invalidarOrcamento(familiaId, competencia, req.get(CABECALHO_ORIGEM_CLIENTE) ?? null);

      res.status(201).json(resultado.remanejamento);
    } catch (erro) {
      next(erro);
    }
  },
);
