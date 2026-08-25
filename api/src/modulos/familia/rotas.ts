/**
 * O ACESSO DA FAMÍLIA — sessão, Google OAuth, convite e aceite (EF-01).
 *
 * A EF-00 entregou a plataforma: sessão em cookie `httpOnly`, o middleware
 * que deriva o tenant dela, e uma leitura da família que prova o isolamento.
 * Este arquivo completa a EF-01 por cima dela: login por Google, envio de
 * convite e aceite — que é onde RN-02/RN-03/RN-04 se encontram.
 */
import { eq } from 'drizzle-orm';
import type { Router as RouterType } from 'express';
import { Router } from 'express';

import { ambiente } from '../../config/ambiente';
import { db } from '../../db';
import { identidades, membros } from '../../db/schema';
import { registrarRota } from '../../openapi/registro';
import { EsquemaCredenciais } from '../../openapi/esquemas';
import {
  contextoDaRequisicao,
  exigirSessao,
  familiaDaRequisicao,
} from '../../http/middleware/tenant';
import { CABECALHO_ORIGEM_CLIENTE, emitirInvalidacao } from '../../realtime/emissor';
import {
  ErroDeConvite,
  convitePendente,
  criarConvite,
  listarConvitesPendentes,
  marcarConviteUsado,
} from './convites';
import { enviarConvitePorEmail } from './email';
import {
  EsquemaAceitarConvite,
  EsquemaCriarConvite,
  EsquemaLoginGoogle,
} from './esquemas';
import { verificarIdTokenGoogle } from './google';
import { ErroDeIdentidade, resolverMembroExistente, resolverOuCriarMembroDaFamilia } from './identidade-servico';
import { gerarHashDeSenha, conferirSenha } from './senha';
import {
  COOKIE_SESSAO,
  abrirSessao,
  encerrarSessao,
  opcoesDoCookie,
  type ContextoDaSessao,
} from './sessao-servico';

export const rotasDeFamilia: RouterType = Router();

/** A forma da sessão que o cliente enxerga — um lugar só, usado pelas quatro rotas que abrem sessão. */
function corpoDaSessao(contexto: ContextoDaSessao) {
  return {
    membroId: contexto.membroId,
    membroNome: contexto.membroNome,
    membroEmail: contexto.membroEmail,
    familiaId: contexto.familiaId,
    familiaNome: contexto.familiaNome,
  };
}

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
    res.status(201).json(corpoDaSessao(sessao.contexto));
  } catch (erro) {
    next(erro);
  }
});

// ---------------------------------------------------------------------------
// POST /sessoes/google — entrar com um ID token do Google
// ---------------------------------------------------------------------------
//
// O que autentica é o email VERIFICADO pelo provedor, nunca o que o token
// alega solto (RN-02/RN-04). Este endpoint NUNCA cria família nem membro: sem
// conta prévia (nem `Identidade` no provedor `google`, nem `Membro` com o
// email por `senha`), a resposta é "conta não encontrada" — D-05 não admite
// autocadastro livre, e login não é convite.

registrarRota({
  metodo: 'post',
  caminho: '/sessoes/google',
  resumo: 'Abre uma sessão com um ID token do Google',
  etiquetas: ['acesso'],
  exigeSessao: false,
  corpo: 'LoginGoogle',
  respostas: [
    { status: 201, descricao: 'Sessão aberta; cookie httpOnly definido', esquema: 'SessaoAtual' },
    { status: 401, descricao: 'Token inválido, email não verificado ou sem conta', esquema: 'Erro' },
    { status: 422, descricao: 'Corpo inválido', esquema: 'Erro' },
  ],
});

rotasDeFamilia.post('/sessoes/google', async (req, res, next) => {
  try {
    const analise = EsquemaLoginGoogle.safeParse(req.body);
    if (!analise.success) {
      res.status(422).json({ erro: 'corpo_invalido', mensagem: 'Informe o idToken do Google.' });
      return;
    }

    let perfil;
    try {
      perfil = await verificarIdTokenGoogle(analise.data.idToken);
    } catch {
      res.status(401).json({ erro: 'token_invalido', mensagem: 'Não consegui validar o token do Google.' });
      return;
    }

    if (!perfil.emailVerificado) {
      res.status(401).json({ erro: 'email_nao_verificado', mensagem: 'O Google não verificou este email.' });
      return;
    }

    const membro = await resolverMembroExistente(db, {
      provedor: 'google',
      email: perfil.email,
      emailVerificado: true,
      nome: perfil.nome,
    });

    if (!membro) {
      res.status(401).json({
        erro: 'conta_nao_encontrada',
        mensagem: 'Nenhuma conta usa este email. Peça um convite a um membro da família.',
      });
      return;
    }

    const sessao = await abrirSessao(db, membro.id);
    res.cookie(COOKIE_SESSAO, sessao.token, opcoesDoCookie(sessao.expiraEm));
    res.status(201).json(corpoDaSessao(sessao.contexto));
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
  res.json(corpoDaSessao(contextoDaRequisicao(req)));
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

// ---------------------------------------------------------------------------
// POST /convites — convidar alguém para a família da SESSÃO
// ---------------------------------------------------------------------------
//
// RN-01: a `familiaId` do convite vem de `familiaDaRequisicao`, nunca do
// corpo. RN-05: qualquer membro pode convidar — não há papel que restrinja
// isto, e a ausência de checagem de papel É a regra (ver identidade-servico
// e o teste que prova que um membro convidado também convida).

registrarRota({
  metodo: 'post',
  caminho: '/convites',
  resumo: 'Convida um novo membro para a família da sessão',
  etiquetas: ['acesso'],
  exigeSessao: true,
  corpo: 'CriarConvite',
  respostas: [
    { status: 201, descricao: 'Convite criado e despachado por email', esquema: 'ConviteCriado' },
    { status: 401, descricao: 'Sem sessão', esquema: 'Erro' },
    { status: 422, descricao: 'Corpo inválido', esquema: 'Erro' },
  ],
});

rotasDeFamilia.post('/convites', exigirSessao, async (req, res, next) => {
  try {
    const analise = EsquemaCriarConvite.safeParse(req.body);
    if (!analise.success) {
      res.status(422).json({ erro: 'corpo_invalido', mensagem: 'Informe o email do convidado.' });
      return;
    }

    const familiaId = familiaDaRequisicao(req);
    const familiaNome = contextoDaRequisicao(req).familiaNome;

    const convite = await criarConvite(db, familiaId, analise.data.email);

    await enviarConvitePorEmail({
      para: convite.email,
      familiaNome,
      link: `${ambiente.ORIGEM_WEB}/convite/${convite.token}`,
    });

    res.status(201).json({
      id: convite.id,
      email: convite.email,
      expiraEm: convite.expiraEm.toISOString(),
    });
  } catch (erro) {
    next(erro);
  }
});

// ---------------------------------------------------------------------------
// GET /convites — os convites pendentes da família da SESSÃO
// ---------------------------------------------------------------------------
//
// EF01-MC-001. RN-01: a familiaId vem de `familiaDaRequisicao`, nunca do
// request — igual a `GET /familia`. Só lista PENDENTES (RN-03): um convite
// já aceito (`usadoEm`) ou já expirado não aparece, porque quem convida quer
// saber "quem eu ainda estou esperando", não o histórico inteiro.

registrarRota({
  metodo: 'get',
  caminho: '/convites',
  resumo: 'Os convites pendentes da família da sessão',
  etiquetas: ['acesso'],
  exigeSessao: true,
  respostas: [
    { status: 200, descricao: 'Os convites pendentes', esquema: 'ConvitesPendentes' },
    { status: 401, descricao: 'Sem sessão', esquema: 'Erro' },
  ],
});

rotasDeFamilia.get('/convites', exigirSessao, async (req, res, next) => {
  try {
    const familiaId = familiaDaRequisicao(req);
    const pendentes = await listarConvitesPendentes(db, familiaId);

    res.json({
      convites: pendentes.map(convite => ({
        id: convite.id,
        email: convite.email,
        expiraEm: convite.expiraEm.toISOString(),
      })),
    });
  } catch (erro) {
    next(erro);
  }
});

// ---------------------------------------------------------------------------
// POST /convites/:token/aceitar — aceitar o convite e entrar
// ---------------------------------------------------------------------------
//
// RN-02: o email que aceita é o convidado — digitado no método `senha`,
// VERIFICADO pelo Google no método `google` (nunca o que o token alega
// solto). RN-03: convite expirado ou já usado é recusado com erro claro.
// RN-04: resolve para o `Membro` já existente quando o email já tem
// identidade (por QUALQUER provedor); só cria um novo quando não havia
// nenhuma.

registrarRota({
  metodo: 'post',
  caminho: '/convites/:token/aceitar',
  resumo: 'Aceita um convite e abre sessão na família dele',
  etiquetas: ['acesso'],
  exigeSessao: false,
  corpo: 'AceitarConvite',
  respostas: [
    { status: 201, descricao: 'Convite aceito; sessão aberta', esquema: 'SessaoAtual' },
    { status: 401, descricao: 'Token do Google inválido ou email não verificado', esquema: 'Erro' },
    { status: 403, descricao: 'Email divergente do convidado (RN-02)', esquema: 'Erro' },
    { status: 404, descricao: 'Convite inexistente', esquema: 'Erro' },
    { status: 409, descricao: 'Convite já usado, ou email de outra família', esquema: 'Erro' },
    { status: 410, descricao: 'Convite expirado (RN-03)', esquema: 'Erro' },
    { status: 422, descricao: 'Corpo inválido', esquema: 'Erro' },
  ],
});

const STATUS_DO_ERRO_DE_CONVITE: Record<string, number> = {
  convite_nao_encontrado: 404,
  convite_usado: 409,
  convite_expirado: 410,
};

rotasDeFamilia.post('/convites/:token/aceitar', async (req, res, next) => {
  try {
    const analise = EsquemaAceitarConvite.safeParse(req.body);
    if (!analise.success) {
      res.status(422).json({ erro: 'corpo_invalido', mensagem: 'Corpo do aceite inválido.' });
      return;
    }

    const token = req.params.token as string;

    let convite;
    try {
      convite = await convitePendente(db, token);
    } catch (erro) {
      if (erro instanceof ErroDeConvite) {
        const status = STATUS_DO_ERRO_DE_CONVITE[erro.codigo] ?? 400;
        res.status(status).json({ erro: erro.codigo, mensagem: erro.message });
        return;
      }
      throw erro;
    }

    let emailCandidato: string;
    let nome: string;
    let segredo: string | null = null;

    if (analise.data.metodo === 'google') {
      let perfil;
      try {
        perfil = await verificarIdTokenGoogle(analise.data.idToken);
      } catch {
        res.status(401).json({ erro: 'token_invalido', mensagem: 'Não consegui validar o token do Google.' });
        return;
      }
      if (!perfil.emailVerificado) {
        res.status(401).json({ erro: 'email_nao_verificado', mensagem: 'O Google não verificou este email.' });
        return;
      }
      emailCandidato = perfil.email;
      nome = perfil.nome;
    } else {
      emailCandidato = analise.data.email.trim().toLowerCase();
      nome = analise.data.nome;
      segredo = await gerarHashDeSenha(analise.data.senha);
    }

    // RN-02 — o email que aceita tem de ser o convidado, sempre.
    if (emailCandidato !== convite.email) {
      res.status(403).json({
        erro: 'email_divergente',
        mensagem: 'Este convite foi enviado para outro email.',
      });
      return;
    }

    let membro;
    try {
      membro = await resolverOuCriarMembroDaFamilia(db, convite.familiaId, {
        provedor: analise.data.metodo,
        email: emailCandidato,
        // A posse do token já prova o email: chegou por ele. No método
        // `google`, o provedor já verificou por conta própria.
        emailVerificado: true,
        nome,
        segredo,
      });
    } catch (erro) {
      if (erro instanceof ErroDeIdentidade) {
        res.status(409).json({ erro: erro.codigo, mensagem: erro.message });
        return;
      }
      throw erro;
    }

    await marcarConviteUsado(db, convite.id);

    const sessao = await abrirSessao(db, membro.id);
    res.cookie(COOKIE_SESSAO, sessao.token, opcoesDoCookie(sessao.expiraEm));

    // Quem já está na tela da família precisa ver o novo membro (@fundacao
    // do emissor — este é o primeiro handler de domínio a chamá-lo).
    const origemClienteId = req.get(CABECALHO_ORIGEM_CLIENTE) ?? null;
    emitirInvalidacao({ familiaId: convite.familiaId, recurso: 'familia', origemClienteId });

    res.status(201).json(corpoDaSessao(sessao.contexto));
  } catch (erro) {
    next(erro);
  }
});
