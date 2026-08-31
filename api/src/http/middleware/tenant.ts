/**
 * MIDDLEWARE DE TENANT — onde a regra R1 é imposta, antes de qualquer handler.
 *
 *   "O `familiaId` vem do token, nunca do request."  (D-05)
 *
 * Isto NÃO é conveniência: um endpoint que aceite `familiaId` do cliente vaza
 * dado financeiro de uma família para outra. Por isso aqui há três camadas:
 *
 *   1. o contexto é montado a partir do cookie de sessão, e só dele;
 *   2. `familiaId` vindo em body ou query é REMOVIDO da requisição — um handler
 *      descuidado não consegue nem por acidente lê-lo do cliente;
 *   3. `familiaDaRequisicao(req)` é o único acessor, e ele lê do contexto.
 *
 * A camada 2 existe porque a 1 e a 3 dependem de disciplina, e disciplina não
 * é gate. Remover o campo transforma um vazamento silencioso em um `undefined`
 * barulhento no primeiro teste que tentar usá-lo.
 *
 * O terceiro lugar por onde o cliente poderia escolher tenant — um `:familiaId`
 * no CAMINHO — não é tratado aqui, e não por esquecimento: o roteador atribui
 * `req.params` depois dos middlewares de aplicação, então limpá-lo aqui seria
 * teatro. Essa porta é fechada em `openapi/registro.ts`, que RECUSA registrar
 * uma rota com `familiaId` no caminho — usando `ehNomeDeFamiliaId`, exportado
 * ABAIXO, o mesmo predicado que esta camada 2 usa.
 *
 * `ehNomeDeFamiliaId` é o ÚNICO dono da pergunta "este nome é um familiaId?"
 * (issue #102 — a pergunta já foi respondida três vezes, com regexes que
 * podiam divergir). `openapi/registro.ts` REFERENCIA esta função para os
 * seus dois guardas (caminho e query); não a reimplementa.
 */
import type { NextFunction, Request, Response } from 'express';

import { db } from '../../db';
import type { ContextoDaSessao } from '../../modulos/familia/sessao-servico';
import {
  COOKIE_SESSAO,
  resolverSessaoPorToken,
} from '../../modulos/familia/sessao-servico';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Preenchido pelo middleware de tenant. Nunca escreva nisto à mão. */
      contexto?: ContextoDaSessao;
    }
  }
}

/**
 * O PREDICADO — a única resposta a "este nome é um familiaId vindo do
 * cliente?". Compara por forma normalizada (minúsculo, sem `_`), então
 * `familiaId`, `familia_id`, `FamiliaId`, `FAMILIA_ID` e `familia` caem
 * todas na mesma comparação.
 *
 * Cobre `familia` sozinho (sem sufixo `Id`/`id`) de propósito: medido antes
 * de fechar a issue #102 (grep por `familia` como identificador de rota,
 * query ou campo em `api/src`) — nenhum parâmetro de caminho, parâmetro de
 * query ou campo de corpo LEGÍTIMO deste projeto se chama só `familia` hoje
 * (o `db/schema.ts` usa `familia:` como nome de RELAÇÃO do Drizzle, não como
 * nome de campo vindo do cliente — fora do alcance deste predicado). Se um
 * dia isso deixar de valer, é este comentário — e a medição que ele descreve
 * — que precisa mudar, não o predicado às cegas.
 *
 * NÃO cobre o nome aparecer como SUBSTRING de um identificador maior (ex.:
 * `outraFamiliaReferencia`) — o predicado responde "é ESTE o nome inteiro",
 * não "contém a palavra familia". Isso é limite deliberado, não fresta: um
 * campo assim não é um jeito de escolher tenant, é coincidência de nome.
 */
function normalizarNomeDeIdentificador(nome: string): string {
  return nome.toLowerCase().replace(/_/g, '');
}

const NOMES_DE_FAMILIA_ID = new Set(['familiaid', 'familia']);

/**
 * O ÚNICO lugar que decide se um NOME — de parâmetro de caminho, de query ou
 * de campo de corpo — é candidato a `familiaId` vindo do cliente.
 * `openapi/registro.ts` importa e usa esta função nos seus dois guardas
 * (caminho e query); não reimplementa a comparação.
 */
export function ehNomeDeFamiliaId(nome: string): boolean {
  return NOMES_DE_FAMILIA_ID.has(normalizarNomeDeIdentificador(nome));
}

function temProibido(alvo: unknown): string[] {
  if (!alvo || typeof alvo !== 'object') return [];
  return Object.keys(alvo as Record<string, unknown>).filter(ehNomeDeFamiliaId);
}

function semProibidos(alvo: Record<string, unknown>): Record<string, unknown> {
  const limpo: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(alvo)) {
    if (ehNomeDeFamiliaId(chave)) continue;
    limpo[chave] = valor;
  }
  return limpo;
}

/**
 * Remove `familiaId` de tudo que veio do cliente. Roda em TODA requisição,
 * autenticada ou não — inclusive nas rotas públicas.
 *
 * ⚠️ `req.query` no Express 5 é um GETTER PREGUIÇOSO: ele reparsa a query
 * string a cada leitura, e um `delete` no objeto devolvido não sobrevive à
 * leitura seguinte. Foi medido, não suposto — a primeira versão deste
 * middleware "limpava" a query e o handler continuava enxergando o valor.
 *
 * Por isso a query é SUBSTITUÍDA por uma cópia limpa, definida na própria
 * requisição: a nova propriedade sombreia o getter do protótipo, e aí sim o
 * campo some para todo mundo que vier depois.
 */
export function descartarTenantDoCliente(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const removidos: string[] = [];

  const noCorpo = temProibido(req.body);
  if (noCorpo.length > 0) {
    removidos.push(...noCorpo);
    req.body = semProibidos(req.body as Record<string, unknown>);
  }

  const naQuery = temProibido(req.query);
  if (naQuery.length > 0) {
    removidos.push(...naQuery);
    Object.defineProperty(req, 'query', {
      value: semProibidos(req.query as unknown as Record<string, unknown>),
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }

  if (removidos.length > 0) {
    // Não é erro do cliente: é ruído que o servidor ignora. Mas fica no log,
    // porque um cliente que insiste em mandar isto está errado sobre o modelo.
    console.warn(
      `[tenant] ${req.method} ${req.path}: campo(s) ${[...new Set(removidos)].join(', ')} vindos do cliente foram descartados`,
    );
  }

  next();
}

/**
 * Monta `req.contexto` a partir do cookie de sessão. Não bloqueia: rotas
 * públicas continuam funcionando sem sessão.
 */
export async function carregarSessao(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = req.cookies?.[COOKIE_SESSAO] as string | undefined;
    const contexto = await resolverSessaoPorToken(db, token);
    if (contexto) req.contexto = contexto;
    next();
  } catch (erro) {
    next(erro);
  }
}

/** Barra a requisição sem sessão válida. Use em toda rota de dado da família. */
export function exigirSessao(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.contexto) {
    res.status(401).json({ erro: 'sessao_ausente', mensagem: 'Faça login para continuar.' });
    return;
  }
  next();
}

/**
 * O ÚNICO jeito de descobrir de que família é a requisição.
 *
 * Se você está prestes a escrever `req.body.familiaId` ou
 * `req.query.familiaId`, pare: o valor não existe mais lá, e se existisse
 * seria um vazamento.
 */
export function familiaDaRequisicao(req: Request): string {
  const familiaId = req.contexto?.familiaId;
  if (!familiaId) {
    throw new Error(
      'familiaDaRequisicao chamado sem sessão — falta `exigirSessao` nesta rota',
    );
  }
  return familiaId;
}

/**
 * O membro autenticado — autor imutável de tudo que a requisição criar.
 * Em uso desde a EF-04 (tarefa #52) — `modulos/lancamentos/rotas.ts` o usa
 * para gravar `criadoPorMembroId` (RN-16).
 */
export function membroDaRequisicao(req: Request): string {
  const membroId = req.contexto?.membroId;
  if (!membroId) {
    throw new Error(
      'membroDaRequisicao chamado sem sessão — falta `exigirSessao` nesta rota',
    );
  }
  return membroId;
}

/**
 * O contexto inteiro, quando o handler precisa de mais de um campo dele.
 * Mesma garantia de `familiaDaRequisicao`/`membroDaRequisicao` — não é `!`,
 * é uma verificação real que aponta a causa quando falta `exigirSessao`.
 */
export function contextoDaRequisicao(req: Request): ContextoDaSessao {
  if (!req.contexto) {
    throw new Error(
      'contextoDaRequisicao chamado sem sessão — falta `exigirSessao` nesta rota',
    );
  }
  return req.contexto;
}
