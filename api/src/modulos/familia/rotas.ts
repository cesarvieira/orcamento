/**
 * O MÍNIMO PARA AUTENTICAR — e nada além disso.
 *
 * A EF-00 entrega a plataforma: sessão em cookie `httpOnly`, o middleware que
 * deriva o tenant dela, e uma leitura da família que prova o isolamento.
 *
 * O que é da EF-01 e NÃO está aqui: Google OAuth, envio de convite, aceite de
 * convite, vinculação de identidade entre provedores. As tabelas já existem no
 * schema; os fluxos são de lá.
 */
import { eq } from 'drizzle-orm';
import type { Router as RouterType } from 'express';
import { Router } from 'express';
import type { z } from 'zod';

import { db } from '../../db';
import { identidades, membros } from '../../db/schema';
import { registrarRota } from '../../openapi/registro';
import { EsquemaCredenciais } from '../../openapi/esquemas';
import {
  contextoDaRequisicao,
  exigirSessao,
  familiaDaRequisicao,
} from '../../http/middleware/tenant';
import { conferirSenha } from './senha';
import {
  COOKIE_SESSAO,
  abrirSessao,
  encerrarSessao,
  opcoesDoCookie,
} from './sessao-servico';

export const rotasDeFamilia: RouterType = Router();

// ---------------------------------------------------------------------------
// POST /sessoes — entrar com email + senha
// ---------------------------------------------------------------------------

registrarRota({
  metodo: 'post',
  caminho: '/sessoes',
  resumo: 'Abre uma sessão com email e senha',
  etiquetas: ['acesso'],
  exigeSessao: false,
  corpo: 'Credenciais',
  respostas: [
    { status: 201, descricao: 'Sessão aberta; cookie httpOnly definido', esquema: 'SessaoAtual' },
    { status: 401, descricao: 'Email ou senha não conferem', esquema: 'Erro' },
    { status: 422, descricao: 'Corpo inválido', esquema: 'Erro' },
  ],
});

rotasDeFamilia.post('/sessoes', async (req, res, next) => {
  try {
    const analise = EsquemaCredenciais.safeParse(req.body);
    if (!analise.success) {
      res.status(422).json({ erro: 'corpo_invalido', mensagem: 'Informe email e senha.' });
      return;
    }

    const email = analise.data.email.trim().toLowerCase();

    const [credencial] = await db
      .select({ membroId: identidades.membroId, segredo: identidades.segredo })
      .from(identidades)
      .where(eq(identidades.email, email))
      .limit(1);

    // Resposta idêntica para email inexistente e senha errada: distinguir os
    // dois entrega ao atacante a lista de quem tem conta.
    const confere = await conferirSenha(analise.data.senha, credencial?.segredo ?? null);
    if (!credencial || !confere) {
      res.status(401).json({ erro: 'credenciais_invalidas', mensagem: 'Email ou senha não conferem.' });
      return;
    }

    const sessao = await abrirSessao(db, credencial.membroId);
    res.cookie(COOKIE_SESSAO, sessao.token, opcoesDoCookie(sessao.expiraEm));
    res.status(201).json({
      membroId: sessao.contexto.membroId,
      membroNome: sessao.contexto.membroNome,
      membroEmail: sessao.contexto.membroEmail,
      familiaId: sessao.contexto.familiaId,
      familiaNome: sessao.contexto.familiaNome,
    });
  } catch (erro) {
    next(erro);
  }
});

// ---------------------------------------------------------------------------
// GET /sessoes/atual — quem sou eu, segundo o TOKEN
// ---------------------------------------------------------------------------

registrarRota({
  metodo: 'get',
  caminho: '/sessoes/atual',
  resumo: 'A sessão corrente, derivada do cookie',
  etiquetas: ['acesso'],
  exigeSessao: true,
  respostas: [
    { status: 200, descricao: 'A sessão corrente', esquema: 'SessaoAtual' },
    { status: 401, descricao: 'Sem sessão', esquema: 'Erro' },
  ],
});

rotasDeFamilia.get('/sessoes/atual', exigirSessao, (req, res) => {
  const contexto = contextoDaRequisicao(req);
  res.json({
    membroId: contexto.membroId,
    membroNome: contexto.membroNome,
    membroEmail: contexto.membroEmail,
    familiaId: contexto.familiaId,
    familiaNome: contexto.familiaNome,
  });
});

// ---------------------------------------------------------------------------
// DELETE /sessoes/atual — sair
// ---------------------------------------------------------------------------

registrarRota({
  metodo: 'delete',
  caminho: '/sessoes/atual',
  resumo: 'Encerra a sessão corrente',
  etiquetas: ['acesso'],
  exigeSessao: true,
  respostas: [
    { status: 204, descricao: 'Sessão encerrada' },
    { status: 401, descricao: 'Sem sessão', esquema: 'Erro' },
  ],
});

rotasDeFamilia.delete('/sessoes/atual', exigirSessao, async (req, res, next) => {
  try {
    await encerrarSessao(db, contextoDaRequisicao(req).sessaoId);
    res.clearCookie(COOKIE_SESSAO, { path: '/' });
    res.status(204).end();
  } catch (erro) {
    next(erro);
  }
});

// ---------------------------------------------------------------------------
// GET /familia — a família da SESSÃO
// ---------------------------------------------------------------------------
//
// Repare no que esta rota não tem: parâmetro de família. Não é omissão — é a
// regra R1. `familiaDaRequisicao` lê do contexto montado pelo cookie, e o
// middleware de tenant já removeu qualquer `familiaId` que o cliente tenha
// mandado. Toda rota de dado da família se escreve assim.

registrarRota({
  metodo: 'get',
  caminho: '/familia',
  resumo: 'A família da sessão, com seus membros',
  etiquetas: ['acesso'],
  exigeSessao: true,
  respostas: [
    { status: 200, descricao: 'A família da sessão', esquema: 'FamiliaAtual' },
    { status: 401, descricao: 'Sem sessão', esquema: 'Erro' },
  ],
});

rotasDeFamilia.get('/familia', exigirSessao, async (req, res, next) => {
  try {
    const familiaId = familiaDaRequisicao(req);

    const lista = await db
      .select({ id: membros.id, nome: membros.nome, email: membros.email })
      .from(membros)
      .where(eq(membros.familiaId, familiaId));

    res.json({
      id: familiaId,
      nome: contextoDaRequisicao(req).familiaNome,
      membros: lista,
    });
  } catch (erro) {
    next(erro);
  }
});

/** Reexportado só para manter o `z` usado nas anotações desta camada. */
export type CorpoDeCredenciais = z.infer<typeof EsquemaCredenciais>;
