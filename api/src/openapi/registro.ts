/**
 * O REGISTRO DO CONTRATO.
 *
 * "Modela-se uma vez, gera-se o resto" (D-03). O modelo é o Zod que a rota já
 * usa para validar; o OpenAPI sai dele, e de `packages/contrato` sai o tipo que
 * o front importa. Uma declaração, três consumidores.
 *
 *   api (zod → OpenAPI)  →  packages/contrato (gerado)  →  web (importa)
 *
 * Toda rota nova se registra aqui. Rota que não se registra não existe no
 * contrato, o front não tem o tipo dela, e o gate de contrato não a cobre.
 *
 * ⚠️ Nenhum enum pode sair INTEIRO no contrato: o gate reprova, porque enum
 * numérico serializado vira número na tela. Use `z.enum([...])` com strings.
 */
import { z } from 'zod';

type Metodo = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface Resposta {
  status: number;
  descricao: string;
  esquema?: string;
}

/** O esquema de UM parâmetro de query — sempre string na URL; `enum` para os de valor fechado. */
interface EsquemaDeParametro {
  type: 'string';
  enum?: readonly string[];
}

interface ParametroDeQuery {
  nome: string;
  /** @default false */
  obrigatorio?: boolean;
  descricao?: string;
  esquema: EsquemaDeParametro;
}

interface Rota {
  metodo: Metodo;
  caminho: string;
  resumo: string;
  etiquetas: string[];
  exigeSessao: boolean;
  corpo?: string;
  /** Parâmetros de QUERY declarados — os de CAMINHO se derivam sozinhos de `:nome`. */
  query?: ParametroDeQuery[];
  respostas: Resposta[];
}

const esquemas = new Map<string, z.ZodType>();
const rotas: Rota[] = [];

/**
 * Registra um esquema nomeado. O nome vira o tipo que o front importa —
 * escolha-o como se fosse público, porque é.
 */
export function registrarEsquema<T extends z.ZodType>(nome: string, esquema: T): T {
  if (esquemas.has(nome) && esquemas.get(nome) !== esquema) {
    throw new Error(`esquema duplicado no contrato: ${nome}`);
  }
  esquemas.set(nome, esquema);
  return esquema;
}

export function registrarRota(rota: Rota): void {
  const chave = `${rota.metodo} ${rota.caminho}`;
  if (rotas.some(r => `${r.metodo} ${r.caminho}` === chave)) {
    throw new Error(`rota duplicada no contrato: ${chave}`);
  }

  // R1, imposta no momento do registro. Parâmetro de caminho é atribuído pelo
  // roteador DEPOIS dos middlewares de aplicação — o middleware de tenant não
  // teria como limpá-lo. Então a rota simplesmente não pode existir: quem
  // precisa do id da família o pega do token.
  if (/[:{]familia_?[Ii]d\b/.test(rota.caminho)) {
    throw new Error(
      `rota com familiaId no caminho: ${chave} — o familiaId vem do token, nunca do request (R1 · D-05)`,
    );
  }

  // R1 também cobre QUERY, não só caminho. #60 abriu esta superfície ao dar
  // à rota um jeito de declarar parâmetro de query — o middleware de tenant
  // já descarta `familiaId`/`familia_id` de `req.query` em runtime (defesa em
  // profundidade), mas a guarda do CONTRATO só olhava o caminho, e um
  // contrato que anuncia `familiaId` como query é imprecisão que convida ao
  // mesmo erro amanhã, independente de o middleware barrar hoje.
  const paramDeFamiliaNaQuery = (rota.query ?? []).find(p => /^familia_?[Ii]d$/.test(p.nome));
  if (paramDeFamiliaNaQuery) {
    throw new Error(
      `rota com familiaId na query: ${chave} — o familiaId vem do token, nunca do request (R1 · D-05)`,
    );
  }

  rotas.push(rota);
}

function referencia(nome: string) {
  if (!esquemas.has(nome)) {
    throw new Error(`o contrato referencia um esquema não registrado: ${nome}`);
  }
  return { $ref: `#/components/schemas/${nome}` };
}

/** Converte `/contas/:id` (Express) em `/contas/{id}` (OpenAPI). */
function caminhoOpenApi(caminho: string): string {
  return caminho.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function parametrosDeCaminho(caminho: string) {
  const nomes = [...caminho.matchAll(/:([A-Za-z0-9_]+)/g)].map(m => m[1]);
  return nomes.map(nome => ({
    name: nome as string,
    in: 'path' as const,
    required: true,
    schema: { type: 'string' as const },
  }));
}

function parametrosDeQuery(query: ParametroDeQuery[]) {
  return query.map(p => ({
    name: p.nome,
    in: 'query' as const,
    required: p.obrigatorio ?? false,
    ...(p.descricao ? { description: p.descricao } : {}),
    schema: p.esquema,
  }));
}

export function construirDocumento(): Record<string, unknown> {
  const componentes: Record<string, unknown> = {};
  for (const [nome, esquema] of esquemas) {
    componentes[nome] = z.toJSONSchema(esquema, {
      target: 'openapi-3.0',
      io: 'output',
      unrepresentable: 'any',
    });
  }

  const caminhos: Record<string, Record<string, unknown>> = {};

  for (const rota of rotas) {
    const caminho = caminhoOpenApi(rota.caminho);
    caminhos[caminho] ??= {};

    const respostas: Record<string, unknown> = {};
    for (const r of rota.respostas) {
      respostas[String(r.status)] = {
        description: r.descricao,
        ...(r.esquema
          ? { content: { 'application/json': { schema: referencia(r.esquema) } } }
          : {}),
      };
    }

    const parametros = [...parametrosDeCaminho(rota.caminho), ...parametrosDeQuery(rota.query ?? [])];

    caminhos[caminho][rota.metodo] = {
      summary: rota.resumo,
      tags: rota.etiquetas,
      operationId: `${rota.metodo}${caminho.replace(/[^A-Za-z0-9]/g, '_')}`,
      ...(parametros.length > 0 ? { parameters: parametros } : {}),
      ...(rota.corpo
        ? {
            requestBody: {
              required: true,
              content: { 'application/json': { schema: referencia(rota.corpo) } },
            },
          }
        : {}),
      ...(rota.exigeSessao ? { security: [{ cookieDeSessao: [] }] } : { security: [] }),
      responses: respostas,
    };
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'Orçamento Familiar — API',
      version: '0.0.0',
      description:
        'Contrato gerado do Zod da API. É SAÍDA, não fonte: não se edita à mão. ' +
        'Todo valor monetário é INTEIRO EM CENTAVOS (D-06).',
    },
    servers: [{ url: '/' }],
    components: {
      schemas: componentes,
      securitySchemes: {
        cookieDeSessao: {
          type: 'apiKey',
          in: 'cookie',
          name: 'orcamento_sessao',
          description: 'Cookie httpOnly de sessão. O familiaId sai daqui, nunca do request.',
        },
      },
    },
    paths: caminhos,
  };
}

/**
 * Só para os testes: garante que o registro está limpo entre execuções.
 * @fundacao nenhuma suíte usa ainda.
 */
export function rotasRegistradas(): readonly Rota[] {
  return rotas;
}
