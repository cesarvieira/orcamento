/**
 * RN-04 (EF-01) — mesmo email por Google e por senha resolve para a MESMA
 * pessoa. E o que cerca o login por Google: só o email VERIFICADO conta
 * (RN-02), e não há autocadastro por Google (D-05) — sem conta prévia, sem
 * convite, a resposta é "conta não encontrada".
 *
 * A fronteira mockada é só a rede com o Google (`definirVerificadorDeIdTokenGoogle`
 * — ver comentário em `src/modulos/familia/google.ts`). Rota, banco, sessão e
 * a resolução de identidade (RN-04) são reais.
 */
import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { db, fecharBanco } from '../src/db';
import { convites, identidades, membros } from '../src/db/schema';
import {
  definirVerificadorDeIdTokenGoogle,
  restaurarVerificadorDeIdTokenGoogle,
} from '../src/modulos/familia/google';
import {
  abrirApp,
  cookieDeSessao,
  criarFamiliaComMembro,
  limparBanco,
  type FamiliaDeTeste,
} from './apoio';

const app = abrirApp();

let familia: FamiliaDeTeste;

beforeAll(async () => {
  await limparBanco();
  familia = await criarFamiliaComMembro('Família do login Google');
});

afterAll(async () => {
  await fecharBanco();
});

afterEach(() => {
  restaurarVerificadorDeIdTokenGoogle();
});

describe('login por Google', () => {
  it('RN-04: o mesmo email por senha e por Google resolve para o MESMO Membro', async () => {
    definirVerificadorDeIdTokenGoogle(async () => ({
      email: familia.email,
      emailVerificado: true,
      nome: 'Nome do Google',
    }));

    const resposta = await request(app).post('/sessoes/google').send({ idToken: 'qualquer-coisa' });

    expect(resposta.status).toBe(201);
    expect(resposta.body.membroId).toBe(familia.membroId);
    expect(resposta.body.familiaId).toBe(familia.familiaId);

    // Não duplicou o Membro...
    const contagemDeMembros = await db
      .select({ id: membros.id })
      .from(membros)
      .where(eq(membros.email, familia.email));
    expect(contagemDeMembros).toHaveLength(1);

    // ...e vinculou uma IDENTIDADE nova ao mesmo membro, sem apagar a de senha.
    const identidadeGoogle = await db
      .select()
      .from(identidades)
      .where(and(eq(identidades.provedor, 'google'), eq(identidades.email, familia.email)));
    expect(identidadeGoogle).toHaveLength(1);
    expect(identidadeGoogle[0]?.membroId).toBe(familia.membroId);

    const identidadeSenha = await db
      .select()
      .from(identidades)
      .where(and(eq(identidades.provedor, 'senha'), eq(identidades.email, familia.email)));
    expect(identidadeSenha).toHaveLength(1);
    expect(identidadeSenha[0]?.membroId).toBe(familia.membroId);
  });

  it('logar de novo por Google (identidade já vinculada) continua resolvendo para o mesmo Membro', async () => {
    definirVerificadorDeIdTokenGoogle(async () => ({
      email: familia.email,
      emailVerificado: true,
      nome: 'Nome do Google',
    }));

    const resposta = await request(app).post('/sessoes/google').send({ idToken: 'outro-token-qualquer' });

    expect(resposta.status).toBe(201);
    expect(resposta.body.membroId).toBe(familia.membroId);
  });

  it('recusa quando o Google NÃO verificou o email — nunca confia no que o token alega solto', async () => {
    definirVerificadorDeIdTokenGoogle(async () => ({
      email: familia.email,
      emailVerificado: false,
      nome: 'Nome do Google',
    }));

    const resposta = await request(app).post('/sessoes/google').send({ idToken: 'token-nao-verificado' });

    expect(resposta.status).toBe(401);
    expect(resposta.body.erro).toBe('email_nao_verificado');
  });

  it('sem conta prévia e sem convite, recusa — login por Google não é autocadastro (D-05)', async () => {
    definirVerificadorDeIdTokenGoogle(async () => ({
      email: 'ninguem-com-essa-conta@exemplo.test',
      emailVerificado: true,
      nome: 'Estranho',
    }));

    const resposta = await request(app).post('/sessoes/google').send({ idToken: 'token-de-desconhecido' });

    expect(resposta.status).toBe(401);
    expect(resposta.body.erro).toBe('conta_nao_encontrada');

    const criouAlguem = await db
      .select({ id: membros.id })
      .from(membros)
      .where(eq(membros.email, 'ninguem-com-essa-conta@exemplo.test'));
    expect(criouAlguem).toHaveLength(0);
  });

  it('token do Google que falha na verificação responde 401, não 500', async () => {
    definirVerificadorDeIdTokenGoogle(async () => {
      throw new Error('assinatura inválida');
    });

    const resposta = await request(app).post('/sessoes/google').send({ idToken: 'token-forjado' });

    expect(resposta.status).toBe(401);
    expect(resposta.body.erro).toBe('token_invalido');
  });

  it('corpo sem idToken responde 422', async () => {
    const resposta = await request(app).post('/sessoes/google').send({});
    expect(resposta.status).toBe(422);
  });
});

describe('RN-04 pelo aceite de convite: aceitar por Google vincula à mesma pessoa da senha', () => {
  it('convite aceito por Google, quando o email já tinha conta por senha, entra na conta existente', async () => {
    const outraFamilia = await criarFamiliaComMembro('Família que convida por engano');
    const email = familia.email; // já existe por senha, em OUTRA família

    const cookieDaOutra = await cookieDeSessao(outraFamilia.membroId);
    await request(app).post('/convites').set('Cookie', cookieDaOutra).send({ email });

    const [convite] = await db.select().from(convites).where(eq(convites.email, email)).limit(1);
    if (!convite) throw new Error('setup: convite não persistiu');

    definirVerificadorDeIdTokenGoogle(async () => ({
      email,
      emailVerificado: true,
      nome: 'Nome do Google',
    }));

    const resposta = await request(app)
      .post(`/convites/${convite.token}/aceitar`)
      .send({ metodo: 'google', idToken: 'token-do-google' });

    // A pessoa já pertence à família dela por senha — convite cruzado de
    // outra família é conflito, não um novo Membro fantasma.
    expect(resposta.status).toBe(409);
    expect(resposta.body.erro).toBe('membro_de_outra_familia');
  });
});
