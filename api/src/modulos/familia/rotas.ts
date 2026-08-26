/**
 * O ACESSO DA FAMÍLIA — sessão, Google OAuth, convite e aceite (EF-01).
 *
 * A EF-00 entregou a plataforma: sessão em cookie `httpOnly`, o middleware
 * que deriva o tenant dela, e uma leitura da família que prova o isolamento.
 * Este arquivo completa a EF-01 por cima dela: login por Google, envio de
 * convite e aceite — que é onde RN-02/RN-03/RN-04 se encontram.
 */
import { and, eq } from 'drizzle-orm';
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
  marcarConviteRecusado,
  marcarConviteUsado,
} from './convites';
import {
  enviarConfirmacaoPorEmail,
  enviarConvitePorEmail,
  enviarRecuperacaoPorEmail,
} from './email';
import {
  ErroDeCadastro,
  confirmarCadastro,
  criarFamiliaComDono,
} from './cadastro-servico';
import {
  ErroDeRecuperacao,
  concluirRecuperacao,
  pedirRecuperacao,
} from './recuperacao-servico';
import {
  EsquemaAceitarConvite,
  EsquemaConcluirRecuperacao,
  EsquemaConfirmarConta,
  EsquemaCriarConta,
  EsquemaCriarConvite,
  EsquemaPedirRecuperacao,
  EsquemaRecusarConvite,
  EsquemaLoginGoogle,
} from './esquemas';
import { perfilDoGoogle } from './google';
import { ErroDeIdentidade, resolverMembroExistente, resolverOuCriarMembroDaFamilia } from './identidade-servico';
import { gerarHashDeSenha, conferirSenha } from './senha';
import {
  COOKIE_SESSAO,
  abrirSessao,
  encerrarSessao,
  encerrarSessoesDoMembro,
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
    { status: 403, descricao: 'Email ainda não confirmado (RN-06)', esquema: 'Erro' },
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
      .select({
        membroId: identidades.membroId,
        segredo: identidades.segredo,
        emailVerificado: identidades.emailVerificado,
      })
      .from(identidades)
      // Filtrar o provedor não é zelo: desde RN-15 o mesmo email pode ter DUAS
      // identidades (google e senha). Sem isto o `.limit(1)` viraria loteria —
      // pegaria a do Google, cujo `segredo` é nulo, e recusaria a senha certa.
      .where(and(eq(identidades.email, email), eq(identidades.provedor, 'senha')))
      .limit(1);

    // Resposta idêntica para email inexistente e senha errada: distinguir os
    // dois entrega ao atacante a lista de quem tem conta.
    const confere = await conferirSenha(analise.data.senha, credencial?.segredo ?? null);
    if (!credencial || !confere) {
      res.status(401).json({ erro: 'credenciais_invalidas', mensagem: 'Email ou senha não conferem.' });
      return;
    }

    // RN-06 — a senha confere, mas o email ainda não foi provado. Só depois da
    // senha correta é que dizemos isto: antes, seria um oráculo revelando quais
    // emails têm conta pendente.
    if (!credencial.emailVerificado) {
      res.status(403).json({
        erro: 'email_nao_confirmado',
        mensagem: 'Confirme seu email para entrar — o código foi enviado quando você criou a família.',
      });
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
// POST /sessoes/google — entrar com um código de autorização do Google
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
  resumo: 'Abre uma sessão com um código de autorização do Google',
  etiquetas: ['acesso'],
  exigeSessao: false,
  corpo: 'LoginGoogle',
  respostas: [
    { status: 201, descricao: 'Sessão aberta; cookie httpOnly definido', esquema: 'SessaoAtual' },
    { status: 401, descricao: 'Código inválido, email não verificado ou sem conta', esquema: 'Erro' },
    { status: 422, descricao: 'Corpo inválido', esquema: 'Erro' },
  ],
});

rotasDeFamilia.post('/sessoes/google', async (req, res, next) => {
  try {
    const analise = EsquemaLoginGoogle.safeParse(req.body);
    if (!analise.success) {
      res.status(422).json({
        erro: 'corpo_invalido',
        mensagem: 'Informe o código de autorização do Google.',
      });
      return;
    }

    let perfil;
    try {
      perfil = await perfilDoGoogle(analise.data.codigoAutorizacao);
    } catch {
      res.status(401).json({
        erro: 'codigo_google_invalido',
        mensagem: 'Não consegui validar sua conta do Google. Tente de novo.',
      });
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
      codigo: convite.token,
      // O link não leva mais segredo (RN-10): abre a tela, e é lá que a pessoa
      // digita email + código. Um link vazado não aceita convite nenhum.
      link: `${ambiente.ORIGEM_WEB}/convite`,
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
// POST /convites/aceitar — aceitar o convite e entrar
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
  caminho: '/convites/aceitar',
  resumo: 'Aceita um convite e abre sessão na família dele',
  etiquetas: ['acesso'],
  exigeSessao: false,
  corpo: 'AceitarConvite',
  respostas: [
    { status: 201, descricao: 'Convite aceito; sessão aberta', esquema: 'SessaoAtual' },
    { status: 401, descricao: 'Código do convite incorreto (RN-10), código do Google inválido ou email não verificado', esquema: 'Erro' },
    { status: 404, descricao: 'Nenhum convite pendente para este email', esquema: 'Erro' },
    { status: 409, descricao: 'Convite já usado, recusado, ou email de outra família', esquema: 'Erro' },
    { status: 410, descricao: 'Convite expirado (RN-03)', esquema: 'Erro' },
    { status: 422, descricao: 'Corpo inválido', esquema: 'Erro' },
    { status: 429, descricao: 'Código invalidado por excesso de tentativas (RN-11)', esquema: 'Erro' },
  ],
});

const STATUS_DO_ERRO_DE_CONVITE: Record<string, number> = {
  convite_nao_encontrado: 404,
  convite_usado: 409,
  // Recusado é irmão de usado, não de expirado: o convite foi RESOLVIDO por
  // quem o recebeu (RN-08). Expirou é o tempo que decidiu, e por isso é 410.
  convite_recusado: 409,
  convite_expirado: 410,
  // RN-10/RN-11 — o código errado é 401 (não provou ser o convidado), e o
  // esgotamento das tentativas é 429: não é o convite que está errado, é o
  // ritmo de quem tenta.
  codigo_invalido: 401,
  convite_bloqueado: 429,
};

/** Os erros de `confirmarCadastro`, mesma lógica de status (RN-09/RN-11). */
const STATUS_DO_ERRO_DE_CADASTRO: Record<string, number> = {
  confirmacao_nao_encontrada: 404,
  confirmacao_expirada: 410,
  codigo_invalido: 401,
  confirmacao_bloqueada: 429,
};

rotasDeFamilia.post('/convites/aceitar', async (req, res, next) => {
  try {
    const analise = EsquemaAceitarConvite.safeParse(req.body);
    if (!analise.success) {
      res.status(422).json({ erro: 'corpo_invalido', mensagem: 'Corpo do aceite inválido.' });
      return;
    }

    let emailCandidato: string;
    let nome: string;
    let segredo: string | null = null;

    if (analise.data.metodo === 'google') {
      let perfil;
      try {
        perfil = await perfilDoGoogle(analise.data.codigoAutorizacao);
      } catch {
        res.status(401).json({
          erro: 'codigo_google_invalido',
          mensagem: 'Não consegui validar sua conta do Google. Tente de novo.',
        });
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

    // RN-02 + RN-10 — o convite é procurado PELO email de quem aceita, junto
    // do código. Não há mais comparação depois do fato: quem não é o convidado
    // simplesmente não acha convite nenhum.
    let convite;
    try {
      convite = await convitePendente(db, emailCandidato, analise.data.codigo);
    } catch (erro) {
      if (erro instanceof ErroDeConvite) {
        const status = STATUS_DO_ERRO_DE_CONVITE[erro.codigo] ?? 400;
        res.status(status).json({ erro: erro.codigo, mensagem: erro.message });
        return;
      }
      throw erro;
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

// ---------------------------------------------------------------------------
// POST /contas — criar a PRÓPRIA família (RN-06 a RN-09)
// ---------------------------------------------------------------------------
//
// Não abre sessão de propósito: a identidade nasce não confirmada, e o login a
// recusa até o email ser provado. Devolver um cookie aqui contradiria RN-06.

registrarRota({
  metodo: 'post',
  caminho: '/contas',
  resumo: 'Cria uma família nova e envia a confirmação de email',
  etiquetas: ['acesso'],
  exigeSessao: false,
  corpo: 'CriarConta',
  respostas: [
    { status: 201, descricao: 'Família criada; confirmação enviada', esquema: 'ContaCriada' },
    { status: 409, descricao: 'Email já cadastrado (RN-07) ou com convite pendente (RN-08)', esquema: 'Erro' },
    { status: 422, descricao: 'Corpo inválido', esquema: 'Erro' },
  ],
});

rotasDeFamilia.post('/contas', async (req, res, next) => {
  try {
    const analise = EsquemaCriarConta.safeParse(req.body);
    if (!analise.success) {
      res.status(422).json({
        erro: 'corpo_invalido',
        mensagem: 'Informe o nome da família, seu nome, email e uma senha de 8 caracteres ou mais.',
      });
      return;
    }

    let criado;
    try {
      criado = await criarFamiliaComDono(db, analise.data);
    } catch (erro) {
      if (erro instanceof ErroDeCadastro) {
        res.status(409).json({ erro: erro.codigo, mensagem: erro.message });
        return;
      }
      throw erro;
    }

    await enviarConfirmacaoPorEmail({
      para: criado.email,
      familiaNome: analise.data.familiaNome.trim(),
      codigo: criado.token,
      link: `${ambiente.ORIGEM_WEB}/confirmar`,
    });

    res.status(201).json({ email: criado.email });
  } catch (erro) {
    next(erro);
  }
});

// ---------------------------------------------------------------------------
// POST /contas/confirmar — prova o email e entra (RN-06/RN-09)
// ---------------------------------------------------------------------------

registrarRota({
  metodo: 'post',
  caminho: '/contas/confirmar',
  resumo: 'Confirma o email do cadastro e abre a sessão',
  etiquetas: ['acesso'],
  exigeSessao: false,
  corpo: 'ConfirmarConta',
  respostas: [
    { status: 201, descricao: 'Email confirmado; sessão aberta', esquema: 'SessaoAtual' },
    { status: 401, descricao: 'Código incorreto (RN-10)', esquema: 'Erro' },
    { status: 404, descricao: 'Nenhuma confirmação pendente para este email', esquema: 'Erro' },
    { status: 410, descricao: 'Código expirado (RN-09)', esquema: 'Erro' },
    { status: 422, descricao: 'Corpo inválido', esquema: 'Erro' },
    { status: 429, descricao: 'Código invalidado por excesso de tentativas (RN-11)', esquema: 'Erro' },
  ],
});

rotasDeFamilia.post('/contas/confirmar', async (req, res, next) => {
  try {
    const analise = EsquemaConfirmarConta.safeParse(req.body);
    if (!analise.success) {
      res.status(422).json({ erro: 'corpo_invalido', mensagem: 'Informe o email e o código de 6 dígitos.' });
      return;
    }

    let membroId;
    try {
      membroId = await confirmarCadastro(db, analise.data.email, analise.data.codigo);
    } catch (erro) {
      if (erro instanceof ErroDeCadastro) {
        const status = STATUS_DO_ERRO_DE_CADASTRO[erro.codigo] ?? 409;
        res.status(status).json({ erro: erro.codigo, mensagem: erro.message });
        return;
      }
      throw erro;
    }

    const sessao = await abrirSessao(db, membroId);
    res.cookie(COOKIE_SESSAO, sessao.token, opcoesDoCookie(sessao.expiraEm));
    res.status(201).json(corpoDaSessao(sessao.contexto));
  } catch (erro) {
    next(erro);
  }
});

// ---------------------------------------------------------------------------
// POST /convites/recusar — não quero entrar nesta família (RN-08)
// ---------------------------------------------------------------------------
//
// Recusar não é só cortesia: é o que LIBERA aquele email para criar a própria
// família. Sem esta porta, quem recebe um convite indesejado fica preso — o
// cadastro recusa por RN-08 e o convite fica pendente até expirar.

registrarRota({
  metodo: 'post',
  caminho: '/convites/recusar',
  resumo: 'Recusa um convite pendente',
  etiquetas: ['acesso'],
  exigeSessao: false,
  corpo: 'RecusarConvite',
  respostas: [
    { status: 204, descricao: 'Convite recusado' },
    { status: 401, descricao: 'Código incorreto (RN-10)', esquema: 'Erro' },
    { status: 404, descricao: 'Nenhum convite pendente para este email', esquema: 'Erro' },
    { status: 409, descricao: 'Convite já usado ou já recusado', esquema: 'Erro' },
    { status: 410, descricao: 'Convite expirado (RN-03)', esquema: 'Erro' },
    { status: 422, descricao: 'Corpo inválido', esquema: 'Erro' },
    { status: 429, descricao: 'Código invalidado por excesso de tentativas (RN-11)', esquema: 'Erro' },
  ],
});

rotasDeFamilia.post('/convites/recusar', async (req, res, next) => {
  try {
    const analise = EsquemaRecusarConvite.safeParse(req.body);
    if (!analise.success) {
      res.status(422).json({ erro: 'corpo_invalido', mensagem: 'Informe o email e o código de 6 dígitos.' });
      return;
    }

    let convite;
    try {
      convite = await convitePendente(db, analise.data.email, analise.data.codigo);
    } catch (erro) {
      if (erro instanceof ErroDeConvite) {
        const status = STATUS_DO_ERRO_DE_CONVITE[erro.codigo] ?? 400;
        res.status(status).json({ erro: erro.codigo, mensagem: erro.message });
        return;
      }
      throw erro;
    }

    await marcarConviteRecusado(db, convite.id);
    res.status(204).end();
  } catch (erro) {
    next(erro);
  }
});

// ---------------------------------------------------------------------------
// POST /recuperacoes — esqueci minha senha (RN-12/RN-13)
// ---------------------------------------------------------------------------
//
// RN-13: a resposta é a MESMA exista ou não a conta. Por isso o handler não
// olha o resultado do serviço para decidir o que responder — ele responde
// primeiro, no mesmo lugar, para os dois casos. Qualquer `if` que ramificasse
// aqui seria o oráculo que a regra existe para fechar.

registrarRota({
  metodo: 'post',
  caminho: '/recuperacoes',
  resumo: 'Pede o código que troca a senha esquecida',
  etiquetas: ['acesso'],
  exigeSessao: false,
  corpo: 'PedirRecuperacao',
  respostas: [
    { status: 202, descricao: 'Pedido aceito — resposta idêntica exista ou não a conta (RN-13)', esquema: 'RecuperacaoPedida' },
    { status: 422, descricao: 'Corpo inválido', esquema: 'Erro' },
  ],
});

/** O texto de RN-13. Um lugar só: duas cópias divergem e viram o oráculo. */
const RESPOSTA_DA_RECUPERACAO = {
  mensagem: 'Se existir uma conta com este email, o código de recuperação foi enviado para ela.',
};

rotasDeFamilia.post('/recuperacoes', async (req, res, next) => {
  try {
    const analise = EsquemaPedirRecuperacao.safeParse(req.body);
    if (!analise.success) {
      res.status(422).json({ erro: 'corpo_invalido', mensagem: 'Informe o email da conta.' });
      return;
    }

    const pedido = await pedirRecuperacao(db, analise.data.email);

    // Sem conta, `pedido` é null e nenhum email sai — mas a resposta é a mesma.
    if (pedido) {
      await enviarRecuperacaoPorEmail({
        para: pedido.email,
        familiaNome: pedido.familiaNome,
        codigo: pedido.codigo,
        link: `${ambiente.ORIGEM_WEB}/recuperar`,
      });
    }

    res.status(202).json(RESPOSTA_DA_RECUPERACAO);
  } catch (erro) {
    next(erro);
  }
});

// ---------------------------------------------------------------------------
// POST /recuperacoes/concluir — troca a senha e entra (RN-12/RN-14/RN-16)
// ---------------------------------------------------------------------------

/** Os erros de `concluirRecuperacao`, no mesmo critério de status dos outros códigos. */
const STATUS_DO_ERRO_DE_RECUPERACAO: Record<string, number> = {
  recuperacao_nao_encontrada: 404,
  recuperacao_expirada: 410,
  codigo_invalido: 401,
  recuperacao_bloqueada: 429,
};

registrarRota({
  metodo: 'post',
  caminho: '/recuperacoes/concluir',
  resumo: 'Troca a senha com o código recebido e abre a sessão',
  etiquetas: ['acesso'],
  exigeSessao: false,
  corpo: 'ConcluirRecuperacao',
  respostas: [
    { status: 201, descricao: 'Senha trocada; sessões antigas encerradas e nova sessão aberta', esquema: 'SessaoAtual' },
    { status: 401, descricao: 'Código incorreto (RN-12)', esquema: 'Erro' },
    { status: 404, descricao: 'Nenhuma recuperação pendente para este email', esquema: 'Erro' },
    { status: 410, descricao: 'Código expirado', esquema: 'Erro' },
    { status: 422, descricao: 'Corpo inválido', esquema: 'Erro' },
    { status: 429, descricao: 'Código invalidado por excesso de tentativas (RN-11)', esquema: 'Erro' },
  ],
});

rotasDeFamilia.post('/recuperacoes/concluir', async (req, res, next) => {
  try {
    const analise = EsquemaConcluirRecuperacao.safeParse(req.body);
    if (!analise.success) {
      res.status(422).json({
        erro: 'corpo_invalido',
        mensagem: 'Informe o email, o código de 6 dígitos e uma senha de 8 caracteres ou mais.',
      });
      return;
    }

    let membroId;
    try {
      membroId = await concluirRecuperacao(
        db,
        analise.data.email,
        analise.data.codigo,
        analise.data.senha,
      );
    } catch (erro) {
      if (erro instanceof ErroDeRecuperacao) {
        const status = STATUS_DO_ERRO_DE_RECUPERACAO[erro.codigo] ?? 400;
        res.status(status).json({ erro: erro.codigo, mensagem: erro.message });
        return;
      }
      throw erro;
    }

    // RN-14 — as antigas morrem ANTES de a nova nascer. Na ordem inversa, a
    // sessão recém-aberta seria encerrada junto e a pessoa trocaria a senha
    // para continuar de fora.
    await encerrarSessoesDoMembro(db, membroId);

    const sessao = await abrirSessao(db, membroId);
    res.cookie(COOKIE_SESSAO, sessao.token, opcoesDoCookie(sessao.expiraEm));
    res.status(201).json(corpoDaSessao(sessao.contexto));
  } catch (erro) {
    next(erro);
  }
});
