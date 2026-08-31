/**
 * R1 — o `familiaId` vem do token, NUNCA do request.
 *
 * Estes são os testes que existem por causa de um vazamento de dado financeiro
 * entre famílias. Cada um deles falha se alguém "otimizar" o middleware de
 * tenant para aceitar o id do cliente.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { fecharBanco } from '../src/db';
import { descartarTenantDoCliente, ehNomeDeFamiliaId } from '../src/http/middleware/tenant';
import { registrarRota } from '../src/openapi/registro';
import {
  abrirApp,
  cookieDeSessao,
  criarFamiliaComMembro,
  limparBanco,
  type FamiliaDeTeste,
} from './apoio';

const app = abrirApp();

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(AQUI, '..', 'src');

/**
 * As quatro variantes que a issue #102 exige barradas nos três pontos de
 * consumo: caixa mista/baixa e com/sem sufixo `Id`/`id`.
 */
const VARIANTES_DE_FAMILIA_ID = ['familiaId', 'familia_id', 'FamiliaId', 'familia'] as const;

let familiaA: FamiliaDeTeste;
let familiaB: FamiliaDeTeste;
let cookieA: string;

beforeAll(async () => {
  await limparBanco();
  familiaA = await criarFamiliaComMembro('Família A');
  familiaB = await criarFamiliaComMembro('Família B');
  cookieA = await cookieDeSessao(familiaA.membroId);
});

afterAll(async () => {
  await fecharBanco();
});

describe('middleware de tenant', () => {
  it('sem sessão, a rota da família responde 401', async () => {
    const resposta = await request(app).get('/familia');
    expect(resposta.status).toBe(401);
    expect(resposta.body.erro).toBe('sessao_ausente');
  });

  it('com sessão, devolve a família do TOKEN', async () => {
    const resposta = await request(app).get('/familia').set('Cookie', cookieA);

    expect(resposta.status).toBe(200);
    expect(resposta.body.id).toBe(familiaA.familiaId);
    expect(resposta.body.nome).toBe('Família A');
  });

  it.each(VARIANTES_DE_FAMILIA_ID)(
    '`%s` na query é ignorado: a resposta continua sendo a da sessão',
    async (variante) => {
      const resposta = await request(app)
        .get(`/familia?${variante}=${familiaB.familiaId}`)
        .set('Cookie', cookieA);

      expect(resposta.status).toBe(200);
      expect(resposta.body.id).toBe(familiaA.familiaId);
      expect(resposta.body.id).not.toBe(familiaB.familiaId);
    },
  );

  it('`familiaId` no CORPO é removido antes de qualquer handler', async () => {
    // A rota de sessão é a que aceita corpo. Se o middleware deixasse passar,
    // o campo chegaria ao handler — e um handler futuro poderia usá-lo.
    const resposta = await request(app)
      .post('/sessoes')
      .send({
        email: familiaA.email,
        senha: familiaA.senha,
        familiaId: familiaB.familiaId,
      });

    expect(resposta.status).toBe(201);
    // A sessão aberta é a da identidade, não a da família que veio no corpo.
    expect(resposta.body.familiaId).toBe(familiaA.familiaId);
  });

  it.each(VARIANTES_DE_FAMILIA_ID)(
    'o handler NÃO enxerga `%s` do cliente, nem na query nem no corpo',
    async (variante) => {
      // Este é o teste que existe por causa de um defeito medido: `req.query`
      // no Express 5 é um getter preguiçoso, e a primeira versão do
      // middleware fazia `delete` no objeto devolvido — o campo voltava na
      // leitura seguinte, e o "descarte" era só a mensagem de log.
      //
      // O middleware aqui é o REAL, num Express REAL, por HTTP REAL. Só o
      // handler é sonda: ele existe para dizer o que chegou até ele.
      const sonda = express();
      sonda.use(express.json());
      sonda.use(descartarTenantDoCliente);
      sonda.post('/sonda', (req, res) => {
        res.json({
          query: (req.query as Record<string, unknown>)[variante] ?? null,
          corpo: (req.body as Record<string, unknown>)[variante] ?? null,
          outros: (req.query as Record<string, unknown>).pagina ?? null,
        });
      });

      const resposta = await request(sonda)
        .post(`/sonda?${variante}=B&pagina=2`)
        .send({ [variante]: 'B', descricao: 'feira' });

      expect(resposta.body).toEqual({
        query: null,
        corpo: null,
        // O resto da query continua intacto: o middleware descarta o
        // tenant, não a requisição.
        outros: '2',
      });
    },
  );

  it('duas variantes ao mesmo tempo (`familiaId` E `familia_id`) são ambas removidas', async () => {
    // O teste original desta suíte, mantido: prova que o descarte não é
    // "um campo por vez" — todo nome que o predicado reconhece some junto.
    const sonda = express();
    sonda.use(express.json());
    sonda.use(descartarTenantDoCliente);
    sonda.post('/sonda', (req, res) => {
      res.json({
        query: (req.query as Record<string, unknown>).familiaId ?? null,
        querySnake: (req.query as Record<string, unknown>).familia_id ?? null,
        corpo: (req.body as Record<string, unknown>).familiaId ?? null,
        outros: (req.query as Record<string, unknown>).pagina ?? null,
      });
    });

    const resposta = await request(sonda)
      .post('/sonda?familiaId=B&familia_id=B&pagina=2')
      .send({ familiaId: 'B', descricao: 'feira' });

    expect(resposta.body).toEqual({
      query: null,
      querySnake: null,
      corpo: null,
      outros: '2',
    });
  });

  it.each(VARIANTES_DE_FAMILIA_ID)('o registro RECUSA rota com `%s` no caminho', (variante) => {
    // O caminho é a terceira porta, e o middleware não alcança `req.params`.
    // Ela fecha no registro do contrato, não em runtime.
    expect(() =>
      registrarRota({
        metodo: 'get',
        caminho: `/familias-teste-caminho-${variante}/:${variante}/contas`,
        resumo: 'rota que não pode existir',
        etiquetas: ['teste'],
        exigeSessao: true,
        respostas: [{ status: 200, descricao: 'nunca' }],
      }),
    ).toThrow(/familiaId vem do token/);
  });

  it.each(VARIANTES_DE_FAMILIA_ID)(
    'o registro RECUSA rota com `%s` declarado como parâmetro de query',
    (variante) => {
      // #60 deu à rota um jeito novo de declarar parâmetro de query. O
      // middleware já descarta as variantes de familiaId de req.query em
      // runtime (defesa em profundidade, provada no teste acima), mas a
      // guarda do CONTRATO só olhava o caminho — e um contrato que ANUNCIA
      // familiaId como query é imprecisão que convida ao mesmo erro amanhã,
      // independente de o middleware barrar hoje. Fecha as duas portas no
      // mesmo lugar.
      expect(() =>
        registrarRota({
          metodo: 'get',
          caminho: `/rota-de-teste-query-${variante}`,
          resumo: 'rota que não pode existir',
          etiquetas: ['teste'],
          exigeSessao: true,
          query: [{ nome: variante, esquema: { type: 'string' } }],
          respostas: [{ status: 200, descricao: 'nunca' }],
        }),
      ).toThrow(/familiaId vem do token/);
    },
  );

  it('a família A não enxerga membro da família B', async () => {
    const resposta = await request(app).get('/familia').set('Cookie', cookieA);

    const emails = (resposta.body.membros as { email: string }[]).map(m => m.email);
    expect(emails).toContain(familiaA.email);
    expect(emails).not.toContain(familiaB.email);
  });
});

describe('ehNomeDeFamiliaId — o predicado único (issue #102)', () => {
  it.each(VARIANTES_DE_FAMILIA_ID)('reconhece `%s`', (variante) => {
    expect(ehNomeDeFamiliaId(variante)).toBe(true);
  });

  it('reconhece caixa alta e mista fora das quatro variantes canônicas', () => {
    expect(ehNomeDeFamiliaId('FAMILIA_ID')).toBe(true);
    expect(ehNomeDeFamiliaId('FAMILIA')).toBe(true);
    expect(ehNomeDeFamiliaId('Familia_Id')).toBe(true);
  });

  it('NÃO reconhece o nome como substring de um identificador maior', () => {
    // Limite deliberado (ver comentário do predicado em tenant.ts): "é ESTE
    // o nome inteiro", não "contém a palavra familia".
    expect(ehNomeDeFamiliaId('outraFamiliaReferencia')).toBe(false);
    expect(ehNomeDeFamiliaId('familiaAntigaId')).toBe(false);
  });

  it('NÃO reconhece identificadores legítimos do domínio', () => {
    expect(ehNomeDeFamiliaId('membroId')).toBe(false);
    expect(ehNomeDeFamiliaId('competencia')).toBe(false);
    expect(ehNomeDeFamiliaId('id')).toBe(false);
    expect(ehNomeDeFamiliaId('categoriaId')).toBe(false);
  });
});

/**
 * O teste ESTRUTURAL: prova que nenhum arquivo fora do dono (`http/middleware/
 * tenant.ts`) reimplementa uma checagem de nome `familia*` — a issue #102
 * nasceu exatamente de três regexes divergentes fazendo essa mesma pergunta.
 *
 * Mesmo estilo de gate que `contrato.teste.ts` já usa para outra invariante:
 * regex sobre TEXTO-FONTE, não parser de AST — heurístico, com limite
 * declarado, não prova completa.
 *
 * A varredura ignora comentário e conteúdo de string/template ANTES de
 * procurar um regex literal — sem isso, um import comum como
 * `'../modulos/familia/rotas'` (que tem "/familia/" entre barras) dispararia
 * falso positivo. Medido: sem essa etapa, a varredura acusava os próprios
 * imports do projeto.
 */
describe('um predicado só — sem regex de familia solta fora do dono', () => {
  const DONO = path.join(SRC_DIR, 'http', 'middleware', 'tenant.ts');
  const REGEX_LITERAL = /(?<![\w$])\/(?:\\.|[^/\\\n])+\/[a-z]*/g;

  /** Remove comentário e conteúdo de string/template — não regex literal. */
  function apenasCodigo(fonte: string): string {
    let saida = '';
    let i = 0;
    while (i < fonte.length) {
      const dois = fonte.slice(i, i + 2);
      if (dois === '//') {
        const fim = fonte.indexOf('\n', i);
        i = fim === -1 ? fonte.length : fim;
        continue;
      }
      if (dois === '/*') {
        const fim = fonte.indexOf('*/', i + 2);
        i = fim === -1 ? fonte.length : fim + 2;
        continue;
      }
      const c = fonte[i];
      if (c === '"' || c === '\'' || c === '`') {
        let j = i + 1;
        while (j < fonte.length) {
          if (fonte[j] === '\\') {
            j += 2;
            continue;
          }
          if (fonte[j] === c) {
            j += 1;
            break;
          }
          j += 1;
        }
        i = j;
        continue;
      }
      saida += c;
      i += 1;
    }
    return saida;
  }

  /** Todo regex literal, em qualquer arquivo do mapa, cujo texto casa "familia". */
  function regexesDeFamiliaForaDoDono(arquivos: Record<string, string>): string[] {
    const problemas: string[] = [];
    for (const [nome, codigo] of Object.entries(arquivos)) {
      for (const m of apenasCodigo(codigo).matchAll(REGEX_LITERAL)) {
        if (/familia/i.test(m[0])) {
          problemas.push(`${nome}: ${m[0]}`);
        }
      }
    }
    return problemas;
  }

  function arquivosTs(dir: string): string[] {
    const encontrados: string[] = [];
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const caminho = path.join(dir, entrada.name);
      if (entrada.isDirectory()) {
        encontrados.push(...arquivosTs(caminho));
        continue;
      }
      if (entrada.name.endsWith('.ts')) encontrados.push(caminho);
    }
    return encontrados;
  }

  it('AUTOTESTE: a varredura pega um regex de familia sintético', () => {
    // Prova que o mecanismo de detecção funciona, sem precisar reintroduzir
    // o bug no código real: se um quarto ponto de checagem nascer amanhã
    // como `/familia_?[Ii]d/.test(nome)`, é isto que o pega.
    const problemas = regexesDeFamiliaForaDoDono({
      'sintetico.ts': 'if (/familia_?[Ii]d/i.test(nome)) throw new Error(\'nao pode\');',
    });
    expect(problemas.length).toBeGreaterThan(0);
  });

  it('AUTOTESTE: a varredura NÃO confunde import de caminho com regex literal', () => {
    // `'../modulos/familia/rotas'` tem "/familia/" entre barras — sem a
    // etapa de remover string antes de procurar regex, isto seria um falso
    // positivo. Este é o caso medido que motivou `apenasCodigo`.
    const problemas = regexesDeFamiliaForaDoDono({
      'sintetico.ts': 'import { rotasDeFamilia } from \'../modulos/familia/rotas\';',
    });
    expect(problemas).toEqual([]);
  });

  it('ESTRUTURAL: nenhum arquivo-fonte fora do dono tem regex literal com "familia"', () => {
    const arquivos: Record<string, string> = {};
    for (const arquivo of arquivosTs(SRC_DIR)) {
      if (arquivo === DONO) continue;
      arquivos[path.relative(SRC_DIR, arquivo)] = readFileSync(arquivo, 'utf8');
    }

    expect(regexesDeFamiliaForaDoDono(arquivos)).toEqual([]);
  });
});
