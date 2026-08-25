/**
 * R1 — o `familiaId` vem do token, NUNCA do request.
 *
 * Estes são os testes que existem por causa de um vazamento de dado financeiro
 * entre famílias. Cada um deles falha se alguém "otimizar" o middleware de
 * tenant para aceitar o id do cliente.
 */
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { fecharBanco } from '../src/db';
import { descartarTenantDoCliente } from '../src/http/middleware/tenant';
import { registrarRota } from '../src/openapi/registro';
import {
  abrirApp,
  cookieDeSessao,
  criarFamiliaComMembro,
  limparBanco,
  type FamiliaDeTeste,
} from './apoio';

const app = abrirApp();

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

  it('`familiaId` na QUERY é ignorado: a resposta continua sendo a da sessão', async () => {
    const resposta = await request(app)
      .get(`/familia?familiaId=${familiaB.familiaId}`)
      .set('Cookie', cookieA);

    expect(resposta.status).toBe(200);
    expect(resposta.body.id).toBe(familiaA.familiaId);
    expect(resposta.body.id).not.toBe(familiaB.familiaId);
  });

  it('`familia_id` na query, na forma snake_case, também é ignorado', async () => {
    const resposta = await request(app)
      .get(`/familia?familia_id=${familiaB.familiaId}`)
      .set('Cookie', cookieA);

    expect(resposta.status).toBe(200);
    expect(resposta.body.id).toBe(familiaA.familiaId);
  });

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

  it('o handler NÃO enxerga o `familiaId` do cliente, nem na query nem no corpo', async () => {
    // Este é o teste que existe por causa de um defeito medido: `req.query` no
    // Express 5 é um getter preguiçoso, e a primeira versão do middleware fazia
    // `delete` no objeto devolvido — o campo voltava na leitura seguinte, e o
    // "descarte" era só a mensagem de log.
    //
    // O middleware aqui é o REAL, num Express REAL, por HTTP REAL. Só o handler
    // é sonda: ele existe para dizer o que chegou até ele.
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
      // O resto da query continua intacto: o middleware descarta o tenant, não
      // a requisição.
      outros: '2',
    });
  });

  it('o registro RECUSA rota com familiaId no caminho', () => {
    // O caminho é a terceira porta, e o middleware não alcança `req.params`.
    // Ela fecha no registro do contrato, não em runtime.
    expect(() =>
      registrarRota({
        metodo: 'get',
        caminho: '/familias/:familiaId/contas',
        resumo: 'rota que não pode existir',
        etiquetas: ['teste'],
        exigeSessao: true,
        respostas: [{ status: 200, descricao: 'nunca' }],
      }),
    ).toThrow(/familiaId vem do token/);
  });

  it('a família A não enxerga membro da família B', async () => {
    const resposta = await request(app).get('/familia').set('Cookie', cookieA);

    const emails = (resposta.body.membros as { email: string }[]).map(m => m.email);
    expect(emails).toContain(familiaA.email);
    expect(emails).not.toContain(familiaB.email);
  });
});
