/**
 * RN-06 a RN-09 (EF-01) — criar a própria família, com confirmação de email.
 *
 * O que estes testes protegem não é a tela: é a fronteira entre o cadastro
 * livre e o convite. Sem RN-07 e RN-08, criar conta viraria um atalho para
 * duplicar pessoa (o furo que RN-04 fecha) ou para escapar do convite.
 */
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { db, fecharBanco } from '../src/db';
import { convites, identidades, membros } from '../src/db/schema';
import { abrirApp, criarFamiliaComMembro, limparBanco, cookieDeSessao } from './apoio';

const app = abrirApp();

/** Fixture de teste, não segredo — montada em partes como em `apoio.ts`,
 *  para o scanner de segredos do pre-commit não a confundir com uma real. */
const CREDENCIAL = ['fixture', 'cadastro', 'longa'].join('-');

const CADASTRO = {
  familiaNome: 'Família Nova',
  nome: 'Dona da Casa',
  email: 'dona@exemplo.test',
  senha: CREDENCIAL,
};

async function tokenDeConfirmacao(email: string): Promise<string> {
  const [i] = await db
    .select({ token: identidades.tokenConfirmacao })
    .from(identidades)
    .where(eq(identidades.email, email))
    .limit(1);
  return i?.token ?? '';
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

describe('criar a própria família', () => {
  it('cria família e membro, mas NÃO abre sessão (RN-06)', async () => {
    const resposta = await request(app).post('/contas').send(CADASTRO);

    expect(resposta.status).toBe(201);
    expect(resposta.body.email).toBe(CADASTRO.email);
    // Nada de cookie: a identidade ainda não foi confirmada.
    expect(resposta.headers['set-cookie']).toBeUndefined();

    const [membro] = await db.select().from(membros).where(eq(membros.email, CADASTRO.email));
    expect(membro).toBeDefined();
    expect(membro?.nome).toBe(CADASTRO.nome);
  });

  it('RN-06: o login é RECUSADO enquanto o email não for confirmado', async () => {
    await request(app).post('/contas').send(CADASTRO).expect(201);

    const login = await request(app)
      .post('/sessoes')
      .send({ email: CADASTRO.email, senha: CADASTRO.senha });

    expect(login.status).toBe(403);
    expect(login.body.erro).toBe('email_nao_confirmado');
  });

  it('RN-06: confirmado o email, o login passa a funcionar', async () => {
    await request(app).post('/contas').send(CADASTRO).expect(201);
    const token = await tokenDeConfirmacao(CADASTRO.email);

    const confirmacao = await request(app).post(`/contas/${token}/confirmar`).send();
    expect(confirmacao.status).toBe(201);
    expect(confirmacao.body.familiaNome).toBe(CADASTRO.familiaNome);

    await request(app)
      .post('/sessoes')
      .send({ email: CADASTRO.email, senha: CADASTRO.senha })
      .expect(201);
  });

  it('RN-09: o link de confirmação é de uso único', async () => {
    await request(app).post('/contas').send(CADASTRO).expect(201);
    const token = await tokenDeConfirmacao(CADASTRO.email);

    await request(app).post(`/contas/${token}/confirmar`).send().expect(201);
    const segunda = await request(app).post(`/contas/${token}/confirmar`).send();

    expect(segunda.status).toBe(409);
  });

  it('RN-07: email que já é de um Membro não cadastra de novo', async () => {
    const familia = await criarFamiliaComMembro('Família que já existe');

    const resposta = await request(app)
      .post('/contas')
      .send({ ...CADASTRO, email: familia.email });

    expect(resposta.status).toBe(409);
    expect(resposta.body.erro).toBe('email_ja_cadastrado');
  });

  it('RN-08: email com convite PENDENTE não cadastra — o caminho é o convite', async () => {
    const a = await criarFamiliaComMembro('Família A do cadastro');
    const cookie = await cookieDeSessao(a.membroId);
    await request(app)
      .post('/convites')
      .set('Cookie', cookie)
      .send({ email: 'convidada@exemplo.test' })
      .expect(201);

    const resposta = await request(app)
      .post('/contas')
      .send({ ...CADASTRO, email: 'convidada@exemplo.test' });

    expect(resposta.status).toBe(409);
    expect(resposta.body.erro).toBe('convite_pendente');
  });

  it('RN-08: RECUSADO o convite, o mesmo email passa a poder criar a própria família', async () => {
    const a = await criarFamiliaComMembro('Família B do cadastro');
    const cookie = await cookieDeSessao(a.membroId);
    await request(app)
      .post('/convites')
      .set('Cookie', cookie)
      .send({ email: 'nao-quero@exemplo.test' })
      .expect(201);

    const [convite] = await db
      .select()
      .from(convites)
      .where(eq(convites.email, 'nao-quero@exemplo.test'));

    await request(app).post(`/convites/${convite?.token}/recusar`).send().expect(204);

    const resposta = await request(app)
      .post('/contas')
      .send({ ...CADASTRO, email: 'nao-quero@exemplo.test' });

    expect(resposta.status).toBe(201);
  });

  it('convite recusado não pode mais ser aceito, nem aparece como pendente', async () => {
    const a = await criarFamiliaComMembro('Família C do cadastro');
    const cookie = await cookieDeSessao(a.membroId);
    await request(app)
      .post('/convites')
      .set('Cookie', cookie)
      .send({ email: 'recusou@exemplo.test' })
      .expect(201);

    const [convite] = await db
      .select()
      .from(convites)
      .where(eq(convites.email, 'recusou@exemplo.test'));

    await request(app).post(`/convites/${convite?.token}/recusar`).send().expect(204);

    const aceite = await request(app)
      .post(`/convites/${convite?.token}/aceitar`)
      .send({ metodo: 'senha', nome: 'Quem', email: 'recusou@exemplo.test', senha: CREDENCIAL });
    expect(aceite.status).toBe(409);

    const lista = await request(app).get('/convites').set('Cookie', cookie).expect(200);
    expect(lista.body.convites.some((c: { email: string }) => c.email === 'recusou@exemplo.test')).toBe(false);
  });

  it('recusa a senha curta demais, sem criar nada', async () => {
    const resposta = await request(app).post('/contas').send({ ...CADASTRO, senha: 'ab' });

    expect(resposta.status).toBe(422);
    const linhas = await db.select().from(membros).where(eq(membros.email, CADASTRO.email));
    expect(linhas).toHaveLength(0);
  });
});
