/**
 * O mínimo de acesso da plataforma: abrir sessão, ler sessão, encerrar sessão.
 *
 * O cookie `httpOnly` não é detalhe: é o que faz o SSR funcionar (D-01) e o que
 * o handshake do socket lê (R2).
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { fecharBanco } from '../src/db';
import {
  abrirApp,
  criarFamiliaComMembro,
  limparBanco,
  type FamiliaDeTeste,
} from './apoio';

const app = abrirApp();

let familia: FamiliaDeTeste;

beforeAll(async () => {
  await limparBanco();
  familia = await criarFamiliaComMembro('Família do acesso');
});

afterAll(async () => {
  await fecharBanco();
});

function cookieDaResposta(cabecalho: string[] | undefined): string {
  const bruto = cabecalho?.find((c) => c.startsWith('orcamento_sessao='));
  if (!bruto) throw new Error('a resposta não trouxe o cookie de sessão');
  return bruto;
}

describe('acesso', () => {
  it('entra com email e senha e recebe o cookie httpOnly', async () => {
    const resposta = await request(app)
      .post('/sessoes')
      .send({ email: familia.email, senha: familia.senha });

    expect(resposta.status).toBe(201);
    expect(resposta.body.familiaId).toBe(familia.familiaId);

    const cookie = cookieDaResposta(resposta.headers['set-cookie'] as unknown as string[]);
    expect(cookie).toMatch(/HttpOnly/i);
  });

  it('senha errada e email inexistente respondem a MESMA coisa', async () => {
    const senhaErrada = await request(app)
      .post('/sessoes')
      .send({ email: familia.email, senha: 'não é essa' });

    const emailInexistente = await request(app)
      .post('/sessoes')
      .send({ email: 'ninguem@exemplo.test', senha: familia.senha });

    expect(senhaErrada.status).toBe(401);
    expect(emailInexistente.status).toBe(401);
    // Distinguir os dois entregaria ao atacante a lista de quem tem conta.
    expect(senhaErrada.body).toEqual(emailInexistente.body);
  });

  it('a sessão encerrada deixa de valer', async () => {
    const entrada = await request(app)
      .post('/sessoes')
      .send({ email: familia.email, senha: familia.senha });
    const cookie = cookieDaResposta(entrada.headers['set-cookie'] as unknown as string[]);

    const antes = await request(app).get('/sessoes/atual').set('Cookie', cookie);
    expect(antes.status).toBe(200);

    const saida = await request(app).delete('/sessoes/atual').set('Cookie', cookie);
    expect(saida.status).toBe(204);

    const depois = await request(app).get('/sessoes/atual').set('Cookie', cookie);
    expect(depois.status).toBe(401);
  });

  it('token inventado não abre sessão', async () => {
    const resposta = await request(app)
      .get('/sessoes/atual')
      .set('Cookie', 'orcamento_sessao=isto-nao-e-um-token');

    expect(resposta.status).toBe(401);
  });

  it('/health responde e diz que o banco está de pé', async () => {
    const resposta = await request(app).get('/health');
    expect(resposta.status).toBe(200);
    expect(resposta.body.banco).toBe('ok');
  });
});
