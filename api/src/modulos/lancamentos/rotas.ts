/**
 * AS ROTAS DE LANÇAMENTOS (EF-04) — registrar, listar, detalhar e excluir.
 *
 * ⛔ Regra #0: RN-15..RN-22/RN-39 vêm de
 * `.preator/skills/negocio/lancamentos-e-parcelamento/SKILL.md`, citando
 * `docs/especificacoes/EF-04-lancamentos.md` §1/§2 como fonte primária.
 *
 * Padrão de `familiaId`/`autorMembroId` idêntico a `modulos/orcamento/rotas.ts`:
 * toda rota exige sessão; `familiaId` vem de `familiaDaRequisicao(req)` e o
 * autor de `membroDaRequisicao(req)` — nunca do corpo (R1 · D-05 · RN-16).
 *
 * Forks fechados pelo humano (issue #52), aplicados aqui:
 *   1. Exclusão pergunta o alcance — `?modo=esta|todas|a-partir-desta`.
 *   3. Transferência com contaId == contaDestinoId: RECUSA COM 400 — é
 *      validação de entrada, não regra de negócio, por isso NÃO está no Zod
 *      (que responde 422 para tudo) e sim aqui, com o texto exato da decisão.
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
import { EsquemaModoDeExclusao, EsquemaNovoLancamento, PADRAO_COMPETENCIA } from './esquemas';
import {
  buscarLancamento,
  criarLancamento,
  excluirLancamento,
  listarLancamentos,
  saldosPorDiaDoExtrato,
} from './servico';

export const rotasDeLancamentos: RouterType = Router();

/**
 * Emite UMA invalidação por competência afetada — um lançamento avulso afeta
 * uma só; uma série parcelada pode afetar várias (uma por parcela), e cada
 * mês de orçamento aberto precisa saber que ficou velho.
 */
function invalidarLancamentos(
  familiaId: string,
  competencias: string[],
  origemClienteId: string | null,
): void {
  for (const competencia of competencias) {
    emitirInvalidacao({ familiaId, recurso: 'lancamentos', competencia, origemClienteId });
  }
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
// POST /lancamentos — registra RECEITA, DESPESA (com ou sem parcelamento) ou
// TRANSFERENCIA na família da SESSÃO.
// ---------------------------------------------------------------------------

registrarRota({
  metodo: 'post',
  caminho: '/lancamentos',
  resumo:
    'Registra um lançamento (RECEITA, DESPESA ou TRANSFERENCIA) na família da sessão. ' +
    'DESPESA com quantidadeParcelas > 1 gera uma SerieParcelas e N lançamentos (RN-20/RN-21).',
  etiquetas: ['lancamentos'],
  exigeSessao: true,
  corpo: 'NovoLancamento',
  respostas: [
    { status: 201, descricao: 'Lançamento(s) criado(s)', esquema: 'LancamentosListados' },
    { status: 400, descricao: 'contaId igual a contaDestinoId (fork 3/#52)', esquema: 'Erro' },
    { status: 401, descricao: 'Sem sessão', esquema: 'Erro' },
    { status: 404, descricao: 'Conta ou categoria inexistente nesta família', esquema: 'Erro' },
    { status: 409, descricao: 'Competência selada (RN-22, EF-08)', esquema: 'Erro' },
    { status: 422, descricao: 'Corpo inválido', esquema: 'Erro' },
  ],
});

rotasDeLancamentos.post('/lancamentos', exigirSessao, async (req, res, next) => {
  try {
    const analise = EsquemaNovoLancamento.safeParse(req.body);
    if (!analise.success) {
      res.status(422).json({ erro: 'corpo_invalido', mensagem: 'Corpo do lançamento inválido.' });
      return;
    }

    // Fork 3/#52 — decisão do condutor: validação de ENTRADA, não regra de
    // negócio, por isso 400 e não 422 (que é o status do restante do Zod).
    if (
      analise.data.tipo === 'TRANSFERENCIA' &&
      analise.data.contaId === analise.data.contaDestinoId
    ) {
      res.status(400).json({
        erro: 'conta_origem_igual_destino',
        mensagem: 'contaId e contaDestinoId precisam ser contas diferentes.',
      });
      return;
    }

    const familiaId = familiaDaRequisicao(req);
    const autorMembroId = membroDaRequisicao(req);
    const resultado = await criarLancamento(db, { familiaId, autorMembroId, entrada: analise.data });

    if (resultado.tipo === 'conta_nao_encontrada') {
      res.status(404).json({ erro: 'conta_nao_encontrada', mensagem: 'Conta inexistente nesta família.' });
      return;
    }
    if (resultado.tipo === 'categoria_nao_encontrada') {
      res.status(404).json({
        erro: 'categoria_nao_encontrada',
        mensagem: 'Categoria inexistente nesta família.',
      });
      return;
    }
    if (resultado.tipo === 'competencia_selada') {
      res.status(409).json({
        erro: 'competencia_selada',
        mensagem: 'Esta competência já foi fechada e não aceita novo lançamento (RN-22).',
      });
      return;
    }

    const competencias = [...new Set(resultado.lancamentos.map(l => l.competencia))];
    invalidarLancamentos(familiaId, competencias, req.get(CABECALHO_ORIGEM_CLIENTE) ?? null);

    res.status(201).json({ lancamentos: resultado.lancamentos });
  } catch (erro) {
    next(erro);
  }
});

// ---------------------------------------------------------------------------
// GET /lancamentos — o extrato: lançamentos da família da SESSÃO, com
// filtros opcionais de competência e conta.
// ---------------------------------------------------------------------------

registrarRota({
  metodo: 'get',
  caminho: '/lancamentos',
  resumo: 'Lista os lançamentos da família da sessão (extrato), com filtro opcional de competência e conta',
  etiquetas: ['lancamentos'],
  exigeSessao: true,
  query: [
    {
      nome: 'competencia',
      obrigatorio: false,
      descricao: 'Filtra o extrato pela competência, no formato AAAA-MM.',
      esquema: { type: 'string' },
    },
    {
      nome: 'contaId',
      obrigatorio: false,
      descricao: 'Filtra o extrato pelos lançamentos desta conta.',
      esquema: { type: 'string' },
    },
  ],
  respostas: [
    { status: 200, descricao: 'Os lançamentos da família', esquema: 'LancamentosListados' },
    { status: 401, descricao: 'Sem sessão', esquema: 'Erro' },
    { status: 422, descricao: 'Competência fora do formato AAAA-MM', esquema: 'Erro' },
  ],
});

rotasDeLancamentos.get('/lancamentos', exigirSessao, async (req, res, next) => {
  try {
    const competencia = typeof req.query.competencia === 'string' ? req.query.competencia : undefined;
    if (competencia && !competenciaValida(competencia)) {
      respostaCompetenciaInvalida(res);
      return;
    }
    const contaId = typeof req.query.contaId === 'string' ? req.query.contaId : undefined;

    const familiaId = familiaDaRequisicao(req);

    // As duas leituras usam os MESMOS filtros e o mesmo `where` (o serviço
    // deriva as duas de `condicoesDaListagem`), então os dias de
    // `saldosPorDia` são exatamente os dias presentes em `lancamentos`.
    const filtros = { competencia, contaId };
    const [lancamentos, saldosPorDia] = await Promise.all([
      listarLancamentos(db, familiaId, filtros),
      saldosPorDiaDoExtrato(db, familiaId, filtros),
    ]);
    res.json({ lancamentos, saldosPorDia });
  } catch (erro) {
    next(erro);
  }
});

// ---------------------------------------------------------------------------
// GET /lancamentos/:id — o detalhe (EF-04 §3: descrição, valor, categoria,
// conta, data, quem lançou, parcelamento).
// ---------------------------------------------------------------------------

registrarRota({
  metodo: 'get',
  caminho: '/lancamentos/:id',
  resumo: 'O detalhe de um lançamento da família da sessão',
  etiquetas: ['lancamentos'],
  exigeSessao: true,
  respostas: [
    { status: 200, descricao: 'O lançamento', esquema: 'Lancamento' },
    { status: 401, descricao: 'Sem sessão', esquema: 'Erro' },
    { status: 404, descricao: 'Lançamento inexistente nesta família', esquema: 'Erro' },
  ],
});

rotasDeLancamentos.get('/lancamentos/:id', exigirSessao, async (req, res, next) => {
  try {
    const familiaId = familiaDaRequisicao(req);
    const lancamento = await buscarLancamento(db, familiaId, req.params.id as string);

    if (!lancamento) {
      res.status(404).json({ erro: 'lancamento_nao_encontrado', mensagem: 'Lançamento inexistente.' });
      return;
    }

    res.json(lancamento);
  } catch (erro) {
    next(erro);
  }
});

// ---------------------------------------------------------------------------
// DELETE /lancamentos/:id?modo=esta|todas|a-partir-desta — fork 1/#52.
// ---------------------------------------------------------------------------

registrarRota({
  metodo: 'delete',
  caminho: '/lancamentos/:id',
  resumo:
    'Apaga um lançamento da família da sessão. ?modo escolhe o alcance quando ele é parcela de ' +
    'uma série: esta (default) · todas · a-partir-desta (fork 1/#52)',
  etiquetas: ['lancamentos'],
  exigeSessao: true,
  query: [
    {
      nome: 'modo',
      obrigatorio: false,
      descricao:
        'Alcance da exclusão quando o lançamento é parcela de uma série: esta (default) · ' +
        'todas · a-partir-desta (fork 1/#52).',
      esquema: { type: 'string', enum: EsquemaModoDeExclusao.options },
    },
  ],
  respostas: [
    { status: 204, descricao: 'Lançamento(s) apagado(s)' },
    { status: 401, descricao: 'Sem sessão', esquema: 'Erro' },
    { status: 404, descricao: 'Lançamento inexistente nesta família', esquema: 'Erro' },
    { status: 422, descricao: 'modo inválido', esquema: 'Erro' },
  ],
});

rotasDeLancamentos.delete('/lancamentos/:id', exigirSessao, async (req, res, next) => {
  try {
    const modoBruto = typeof req.query.modo === 'string' ? req.query.modo : 'esta';
    const analiseModo = EsquemaModoDeExclusao.safeParse(modoBruto);
    if (!analiseModo.success) {
      res.status(422).json({
        erro: 'modo_invalido',
        mensagem: 'modo precisa ser esta, todas ou a-partir-desta.',
      });
      return;
    }

    const familiaId = familiaDaRequisicao(req);
    const resultado = await excluirLancamento(db, familiaId, req.params.id as string, analiseModo.data);

    if (resultado.tipo === 'nao_encontrado') {
      res.status(404).json({ erro: 'lancamento_nao_encontrado', mensagem: 'Lançamento inexistente.' });
      return;
    }

    invalidarLancamentos(familiaId, resultado.competencias, req.get(CABECALHO_ORIGEM_CLIENTE) ?? null);

    res.status(204).end();
  } catch (erro) {
    next(erro);
  }
});
