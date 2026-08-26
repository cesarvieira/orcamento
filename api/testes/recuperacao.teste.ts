/**
 * RN-12 a RN-16 (EF-01) — recuperar a senha esquecida.
 *
 * Dois destes testes provam coisas que só existem porque a decisão do humano
 * as pediu, e que seriam fáceis de perder numa refatoração distraída:
 *
 *   RN-13  o pedido responde IGUAL para email que existe e email que não
 *          existe. Um `if` a mais no handler transforma a rota num oráculo de
 *          quem tem conta.
 *   RN-14  trocar a senha derruba as sessões antigas. Sem isto, quem invadiu
 *          continua dentro depois da troca — a recuperação vira teatro.
 */
import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { db, fecharBanco } from '../src/db';
import { familias, identidades, membros } from '../src/db/schema';
import { abrirApp, criarFamiliaComMembro, cookieDeSessao, limparBanco } from './apoio';

const app = abrirApp();

/** Fixtures de teste, não segredos — montadas em partes como em `apoio.ts`,
 *  para o scanner de segredos do pre-commit não as confundir com reais. */
const SENHA_ANTIGA = ['fixture', 'recuperacao', 'antiga'].join('-');
const SENHA_NOVA = ['fixture', 'recuperacao', 'nova'].join('-');

/** O código sorteado, lido do banco — é o que o email teria levado. */
async function codigoDeRecuperacao(email: string): Promise<string> {
  const [i] = await db
    .select({ codigo: identidades.tokenRecuperacao })
    .from(identidades)
    .where(and(eq(identidades.email, email), eq(identidades.provedor, 'senha')))
    .limit(1);
  return i?.codigo ?? '';
}

/** Um código que garantidamente NÃO é o sorteado. */
function outroCodigo(certo: string): string {
  return certo === '000000' ? '111111' : '000000';
}

/** Cria uma pessoa que só entra por Google — sem identidade de senha (RN-15). */
async function criarPessoaSoComGoogle(email: string): Promise<string> {
  const [familia] = await db
    .insert(familias)
    .values({ nome: 'Família do Google' })
    .returning({ id: familias.id });
  if (!familia) throw new Error('setup: não criou a família');

  const [membro] = await db
    .insert(membros)
    .values({ familiaId: familia.id, nome: 'Só Google', email })
    .returning({ id: membros.id });
  if (!membro) throw new Error('setup: não criou o membro');

  await db.insert(identidades).values({
    membroId: membro.id,
    provedor: 'google',
    email,
    emailVerificado: new Date(),
    segredo: null,
  });

  return membro.id;
}

beforeAll(async () => {
  await limparBanco();
});

afterEach(async () => {
  await limparBanco();
});

afterAll(async () => {
  await fecharBanco();
});

describe('pedir recuperação', () => {
  it('RN-12: guarda um código de 6 dígitos para quem tem conta', async () => {
    const familia = await criarFamiliaComMembro('Família que esqueceu', SENHA_ANTIGA);

    const resposta = await request(app).post('/recuperacoes').send({ email: familia.email });

    expect(resposta.status).toBe(202);
    expect(await codigoDeRecuperacao(familia.email)).toMatch(/^\d{6}$/);
  });

  it('RN-13: email inexistente responde EXATAMENTE o mesmo, e não cria nada', async () => {
    const familia = await criarFamiliaComMembro('Família que existe', SENHA_ANTIGA);

    const comConta = await request(app).post('/recuperacoes').send({ email: familia.email });
    const semConta = await request(app)
      .post('/recuperacoes')
      .send({ email: 'nunca-existiu@exemplo.test' });

    // Status e corpo idênticos: é isso que fecha o oráculo.
    expect(semConta.status).toBe(comConta.status);
    expect(semConta.body).toEqual(comConta.body);

    const linhas = await db
      .select()
      .from(identidades)
      .where(eq(identidades.email, 'nunca-existiu@exemplo.test'));
    expect(linhas).toHaveLength(0);
  });

  it('pedir de novo troca o código e zera as tentativas gastas', async () => {
    const familia = await criarFamiliaComMembro('Família insistente', SENHA_ANTIGA);
    await request(app).post('/recuperacoes').send({ email: familia.email }).expect(202);
    const primeiro = await codigoDeRecuperacao(familia.email);

    // Gasta uma tentativa errando.
    await request(app)
      .post('/recuperacoes/concluir')
      .send({ email: familia.email, codigo: outroCodigo(primeiro), senha: SENHA_NOVA })
      .expect(401);

    await request(app).post('/recuperacoes').send({ email: familia.email }).expect(202);

    const [i] = await db
      .select({ tentativas: identidades.tentativasRecuperacao })
      .from(identidades)
      .where(eq(identidades.email, familia.email))
      .limit(1);
    expect(i?.tentativas).toBe(0);
  });
});

describe('concluir recuperação', () => {
  it('feliz: troca a senha, abre sessão, e a senha antiga deixa de valer', async () => {
    const familia = await criarFamiliaComMembro('Família que trocou', SENHA_ANTIGA);
    await request(app).post('/recuperacoes').send({ email: familia.email }).expect(202);
    const codigo = await codigoDeRecuperacao(familia.email);

    const troca = await request(app)
      .post('/recuperacoes/concluir')
      .send({ email: familia.email, codigo, senha: SENHA_NOVA });

    expect(troca.status).toBe(201);
    expect(troca.body.membroEmail).toBe(familia.email);
    expect(troca.headers['set-cookie']).toBeDefined();

    await request(app)
      .post('/sessoes')
      .send({ email: familia.email, senha: SENHA_NOVA })
      .expect(201);

    const comAAntiga = await request(app)
      .post('/sessoes')
      .send({ email: familia.email, senha: SENHA_ANTIGA });
    expect(comAAntiga.status).toBe(401);
  });

  it('RN-14: as sessões abertas ANTES da troca morrem', async () => {
    const familia = await criarFamiliaComMembro('Família invadida', SENHA_ANTIGA);
    const cookieAntigo = await cookieDeSessao(familia.membroId);

    // A sessão antiga funciona antes da troca.
    await request(app).get('/familia').set('Cookie', cookieAntigo).expect(200);

    await request(app).post('/recuperacoes').send({ email: familia.email }).expect(202);
    const codigo = await codigoDeRecuperacao(familia.email);
    await request(app)
      .post('/recuperacoes/concluir')
      .send({ email: familia.email, codigo, senha: SENHA_NOVA })
      .expect(201);

    const depois = await request(app).get('/familia').set('Cookie', cookieAntigo);
    expect(depois.status).toBe(401);
  });

  it('RN-15: quem só tinha Google ganha senha, e passa a entrar pelos dois caminhos', async () => {
    const email = 'so-google@exemplo.test';
    await criarPessoaSoComGoogle(email);

    await request(app).post('/recuperacoes').send({ email }).expect(202);
    const codigo = await codigoDeRecuperacao(email);
    expect(codigo).toMatch(/^\d{6}$/);

    await request(app)
      .post('/recuperacoes/concluir')
      .send({ email, codigo, senha: SENHA_NOVA })
      .expect(201);

    // A identidade do Google continua lá — não foi substituída, RN-04.
    const todas = await db.select().from(identidades).where(eq(identidades.email, email));
    expect(todas.map(i => i.provedor).sort()).toEqual(['google', 'senha']);

    await request(app).post('/sessoes').send({ email, senha: SENHA_NOVA }).expect(201);
  });

  it('RN-16: conta ainda não confirmada sai confirmada e entra', async () => {
    const cadastro = {
      familiaNome: 'Família sem confirmar',
      nome: 'Quem perdeu o email',
      email: 'perdeu@exemplo.test',
      senha: SENHA_ANTIGA,
    };
    await request(app).post('/contas').send(cadastro).expect(201);

    // RN-06 em pé: o login está bloqueado antes da recuperação.
    const antes = await request(app)
      .post('/sessoes')
      .send({ email: cadastro.email, senha: cadastro.senha });
    expect(antes.status).toBe(403);

    await request(app).post('/recuperacoes').send({ email: cadastro.email }).expect(202);
    const codigo = await codigoDeRecuperacao(cadastro.email);
    await request(app)
      .post('/recuperacoes/concluir')
      .send({ email: cadastro.email, codigo, senha: SENHA_NOVA })
      .expect(201);

    await request(app)
      .post('/sessoes')
      .send({ email: cadastro.email, senha: SENHA_NOVA })
      .expect(201);
  });

  it('RN-12: código errado é 401 e não troca a senha', async () => {
    const familia = await criarFamiliaComMembro('Família chutada', SENHA_ANTIGA);
    await request(app).post('/recuperacoes').send({ email: familia.email }).expect(202);
    const codigo = await codigoDeRecuperacao(familia.email);

    const resposta = await request(app)
      .post('/recuperacoes/concluir')
      .send({ email: familia.email, codigo: outroCodigo(codigo), senha: SENHA_NOVA });

    expect(resposta.status).toBe(401);
    expect(resposta.body.erro).toBe('codigo_invalido');

    // A senha antiga continua valendo — errar não trocou nada.
    await request(app)
      .post('/sessoes')
      .send({ email: familia.email, senha: SENHA_ANTIGA })
      .expect(201);
  });

  it('RN-11: na quinta tentativa errada a recuperação é bloqueada, e o código certo já não vale', async () => {
    const familia = await criarFamiliaComMembro('Família sob força bruta', SENHA_ANTIGA);
    await request(app).post('/recuperacoes').send({ email: familia.email }).expect(202);
    const codigo = await codigoDeRecuperacao(familia.email);
    const errado = outroCodigo(codigo);

    const tentar = (c: string) =>
      request(app)
        .post('/recuperacoes/concluir')
        .send({ email: familia.email, codigo: c, senha: SENHA_NOVA });

    for (let i = 0; i < 4; i += 1) {
      expect((await tentar(errado)).status).toBe(401);
    }

    const quinta = await tentar(errado);
    expect(quinta.status).toBe(429);
    expect(quinta.body.erro).toBe('recuperacao_bloqueada');

    const comOCerto = await tentar(codigo);
    expect(comOCerto.status).toBe(429);
  });

  it('sem pedido nenhum, concluir responde 404', async () => {
    const familia = await criarFamiliaComMembro('Família que não pediu', SENHA_ANTIGA);

    const resposta = await request(app)
      .post('/recuperacoes/concluir')
      .send({ email: familia.email, codigo: '123456', senha: SENHA_NOVA });

    expect(resposta.status).toBe(404);
    expect(resposta.body.erro).toBe('recuperacao_nao_encontrada');
  });

  it('senha curta demais é 422, sem gastar o código', async () => {
    const familia = await criarFamiliaComMembro('Família apressada', SENHA_ANTIGA);
    await request(app).post('/recuperacoes').send({ email: familia.email }).expect(202);
    const codigo = await codigoDeRecuperacao(familia.email);

    await request(app)
      .post('/recuperacoes/concluir')
      .send({ email: familia.email, codigo, senha: 'ab' })
      .expect(422);

    // O código sobreviveu: recusa de forma não é tentativa errada.
    await request(app)
      .post('/recuperacoes/concluir')
      .send({ email: familia.email, codigo, senha: SENHA_NOVA })
      .expect(201);
  });
});
