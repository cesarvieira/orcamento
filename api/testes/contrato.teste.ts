/**
 * O contrato — as invariantes que o gate cobra, provadas antes de o gate rodar.
 *
 * O gate `contrato` precisa da API no ar para verificar. Estes testes verificam
 * o mesmo documento offline: quando quebra, quebra aqui, com nome de teste, em
 * vez de num curl no fim da fila.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

import { abrirApp } from './apoio';
import { fecharBanco } from '../src/db';

const app = abrirApp();

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(AQUI, '..', 'src');

afterAll(async () => {
  await fecharBanco();
});

interface Documento {
  components: { schemas: Record<string, Record<string, unknown>> };
  paths: Record<string, Record<string, unknown>>;
}

async function documento(): Promise<Documento> {
  const resposta = await request(app).get('/openapi.json');
  expect(resposta.status).toBe(200);
  return resposta.body as Documento;
}

/** Percorre o esquema e o de dentro das suas propriedades. */
function percorrer(
  nome: string,
  esquema: Record<string, unknown>,
  visitar: (nome: string, esquema: Record<string, unknown>) => void,
): void {
  visitar(nome, esquema);
  const propriedades = esquema.properties as Record<string, Record<string, unknown>> | undefined;
  for (const [chave, filho] of Object.entries(propriedades ?? {})) {
    if (filho && typeof filho === 'object') percorrer(`${nome}.${chave}`, filho, visitar);
  }
}

// ---------------------------------------------------------------------------
// O gate de #60: o handler não pode ler `req.query.X` sem que `X` esteja
// declarado no registro. Esta checagem é GERAL — não hardcoda os três
// parâmetros do defeito original — porque escaneia TODA rota registrada
// (não só as de `lancamentos`) contra o documento realmente servido.
//
// Como funciona: acha os arquivos que registram rotas Express (convenção do
// projeto: `rotas.ts` de cada módulo, e tudo dentro de `http/rotas/`), acha
// nesses arquivos toda chamada `algumRouter.<metodo>('<caminho>', ...)` e todo
// `req.query.<nome>`, associa cada uso ao registro de rota mais próximo
// ANTES dele no arquivo (o handler em que ele está — o padrão deste código é
// um handler por bloco, sequencial), e confere no `/openapi.json` servido se
// aquele `<metodo> <caminho>` declara um parâmetro de query com aquele nome.
//
// ⚠️ GERAL É SOBRE A COBERTURA (toda rota, não só as três desta issue), NÃO
// SOBRE A TÉCNICA. É um gate HEURÍSTICO com limite declarado — não prova
// completa. Ele é regex sobre texto-fonte, não parser de AST, e assume a
// convenção deste código ("um registro, um handler, sequencial, um por
// bloco"). Isto é LIDO do texto, nunca TIPADO — nada impede alguém de
// escrever fora do padrão amanhã. Hoje (checado na revisão desta tarefa) os 5
// arquivos de rota reais — `contas`, `familia`, `lancamentos`, `orcamento`,
// `http/rotas/saude.ts` — seguem 100% esse padrão, então o gate segura. Mas
// nada o impede de escapar em silêncio (`if (!rota) continue` no passo
// seguinte não falha o teste, só não registra o uso — um handler fora do
// padrão simplesmente não é visto):
//
//   · `req.query['x']` (colchete), desestruturação (`const { x } = req.query`)
//     ou spread do objeto `req.query` inteiro — só casa `req.query.<nome>`
//     literal, com ponto.
//   · leitura indireta: um helper que RECEBA `req.query` (ou `req`) como
//     parâmetro e leia `X` dentro dele — o regex só olha o corpo textual do
//     próprio arquivo de rota, não segue chamada de função.
//   · encadeamento `router.route('/x').get(h1).post(h2)` — a associação
//     "registro → handler" assume UM handler por chamada de método; um
//     segundo verbo encadeado na mesma `.route()` não gera um novo `REGISTRO_
//     DE_ROTA` antes dele, então `h2` herda (ou perde) o contexto errado.
//
// O que este teste GARANTE de fato, hoje: nenhum dos 5 arquivos de rota reais
// lê `req.query.<nome>` (na forma direta, ponto) sem que `<nome>` apareça
// como parâmetro de query no OpenAPI servido para aquele método+caminho. Se
// algum dos escapes acima passar a valer (colchete, desestruturação, helper
// indireto, `.route()` encadeado), feche a fuga aqui — não amplie o regex às
// cegas; declare o novo limite do mesmo jeito que este comentário declara os
// de hoje.
// ---------------------------------------------------------------------------

interface UsoDeQuery {
  arquivo: string;
  metodo: string;
  caminho: string;
  parametro: string;
}

const REGISTRO_DE_ROTA = /\.(get|post|put|patch|delete)\(\s*(['"])([^'"]+)\2/g;
const USO_DE_QUERY = /req\.query\.([A-Za-z_][A-Za-z0-9_]*)/g;

/** Os arquivos onde este projeto registra rotas Express — nunca outro lugar. */
function arquivosDeRotas(dir: string): string[] {
  const encontrados: string[] = [];
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      encontrados.push(...arquivosDeRotas(caminho));
      continue;
    }
    if (!entrada.name.endsWith('.ts')) continue;
    const dentroDePastaDeRotas = path.basename(dir) === 'rotas';
    if (entrada.name === 'rotas.ts' || dentroDePastaDeRotas) {
      encontrados.push(caminho);
    }
  }
  return encontrados;
}

/** Todo `req.query.X` do arquivo, associado ao registro de rota que o precede. */
function usosDeQuery(arquivo: string): UsoDeQuery[] {
  const codigo = readFileSync(arquivo, 'utf8');

  const registros = [...codigo.matchAll(REGISTRO_DE_ROTA)]
    .map(m => ({ metodo: m[1] as string, caminho: m[3] as string, inicio: m.index ?? 0 }))
    .sort((a, b) => a.inicio - b.inicio);

  const usos: UsoDeQuery[] = [];
  for (const m of codigo.matchAll(USO_DE_QUERY)) {
    const posicao = m.index ?? 0;
    // O último registro ANTES do uso é o handler em que ele vive.
    const rota = [...registros].reverse().find(r => r.inicio < posicao);
    if (!rota) continue;
    usos.push({
      arquivo: path.relative(SRC_DIR, arquivo),
      metodo: rota.metodo,
      caminho: rota.caminho,
      parametro: m[1] as string,
    });
  }
  return usos;
}

describe('contrato OpenAPI', () => {
  it('GERAL: nenhum handler lê req.query.X sem declarar X no registro da rota', async () => {
    const doc = await documento();
    const problemas = new Set<string>();

    for (const arquivo of arquivosDeRotas(SRC_DIR)) {
      for (const uso of usosDeQuery(arquivo)) {
        const caminhoOpenApi = uso.caminho.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
        const operacao = (doc.paths[caminhoOpenApi] as Record<string, unknown> | undefined)?.[
          uso.metodo
        ] as { parameters?: { name: string; in: string }[] } | undefined;

        const declarado = operacao?.parameters?.some(p => p.in === 'query' && p.name === uso.parametro);
        if (!declarado) {
          problemas.add(
            `${uso.arquivo}: ${uso.metodo.toUpperCase()} ${uso.caminho} lê req.query.${uso.parametro} ` +
            'sem declará-lo no registro (registrarRota → query)',
          );
        }
      }
    }

    expect([...problemas]).toEqual([]);
  });


  it('a API publica o documento em /openapi.json', async () => {
    const doc = await documento();
    expect(Object.keys(doc.paths).length).toBeGreaterThan(0);
    expect(Object.keys(doc.components.schemas).length).toBeGreaterThan(0);
  });

  it('nenhum enum sai INTEIRO — enum numérico vira número na tela', async () => {
    const doc = await documento();
    const ruins: string[] = [];

    for (const [nome, esquema] of Object.entries(doc.components.schemas)) {
      percorrer(nome, esquema, (caminho, s) => {
        if ('enum' in s && (s.type === 'integer' || s.type === 'number')) {
          ruins.push(caminho);
        }
      });
    }

    expect(ruins).toEqual([]);
  });

  it('as rotas da família exigem o cookie de sessão no contrato', async () => {
    const doc = await documento();
    const familia = doc.paths['/familia'] as { get: { security: unknown[] } };
    expect(familia.get.security).toEqual([{ cookieDeSessao: [] }]);
  });

  it('o evento de invalidação NÃO declara nenhum campo de estado derivado', async () => {
    const doc = await documento();
    const invalidacao = doc.components.schemas.Invalidacao as {
      properties: Record<string, unknown>;
    };

    expect(Object.keys(invalidacao.properties).sort()).toEqual([
      'competencia',
      'origemClienteId',
      'recurso',
    ]);
  });

  it('nenhum esquema publica `familiaId` como ENTRADA de uma mutação', async () => {
    // O cliente nunca escolhe família. Se um corpo de requisição passar a
    // aceitar `familiaId`, o contrato vira convite ao vazamento — e este teste
    // é onde isso aparece.
    const doc = await documento();
    const corpos = new Set<string>();

    for (const caminho of Object.values(doc.paths)) {
      for (const operacao of Object.values(caminho)) {
        const corpo = (operacao as { requestBody?: { content: Record<string, { schema: { $ref?: string } }> } })
          .requestBody;
        const ref = corpo?.content?.['application/json']?.schema?.$ref;
        if (ref) corpos.add(ref.split('/').pop() as string);
      }
    }

    for (const nome of corpos) {
      const esquema = doc.components.schemas[nome] as { properties?: Record<string, unknown> };
      expect(Object.keys(esquema.properties ?? {})).not.toContain('familiaId');
    }
  });
});
