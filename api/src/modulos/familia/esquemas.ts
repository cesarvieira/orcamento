/**
 * Os esquemas desta EF (Google, convite). Módulos de domínio registram os
 * próprios esquemas nos próprios arquivos — só os da fundação vivem em
 * `openapi/esquemas.ts` (ver comentário lá).
 */
import { z } from 'zod';

import { registrarEsquema } from '../../openapi/registro';

export const EsquemaLoginGoogle = registrarEsquema(
  'LoginGoogle',
  z.object({
    idToken: z.string().min(1).meta({ description: 'O ID token que o Google Identity Services devolveu ao cliente.' }),
  }),
);

export const EsquemaCriarConvite = registrarEsquema(
  'CriarConvite',
  z.object({
    email: z.string().min(3),
  }),
);

/** Criar a própria família (RN-06). Quem preenche isto vira o primeiro membro. */
export const EsquemaCriarConta = registrarEsquema(
  'CriarConta',
  z.object({
    familiaNome: z.string().trim().min(2).meta({ description: 'Como a família se chama no app.' }),
    nome: z.string().trim().min(2),
    email: z.string().trim().min(3),
    senha: z.string().min(8).meta({ description: 'Mínimo de 8 caracteres.' }),
  }),
);

/** Confirmar o cadastro: email + código digitado (RN-10). */
export const EsquemaConfirmarConta = registrarEsquema(
  'ConfirmarConta',
  z.object({
    email: z.string().trim().min(3),
    codigo: z.string().trim().regex(/^\d{6}$/, 'O código tem 6 dígitos.'),
  }),
);

/** Pedir recuperação de senha (RN-12). Só o email — o resto vem depois do código. */
export const EsquemaPedirRecuperacao = registrarEsquema(
  'PedirRecuperacao',
  z.object({
    email: z.string().trim().min(3),
  }),
);

/** Concluir a recuperação: email + código + a senha nova (RN-12). */
export const EsquemaConcluirRecuperacao = registrarEsquema(
  'ConcluirRecuperacao',
  z.object({
    email: z.string().trim().min(3),
    codigo: z.string().trim().regex(/^\d{6}$/, 'O código tem 6 dígitos.'),
    senha: z.string().min(8).meta({ description: 'Mínimo de 8 caracteres.' }),
  }),
);

/**
 * A resposta do PEDIDO de recuperação. Não leva dado nenhum de propósito
 * (RN-13): qualquer campo que variasse com a existência da conta seria o
 * oráculo que a regra existe para fechar.
 *
 * @fundacao consumido pelo contrato gerado (front), não por import dentro deste repo.
 */
export const EsquemaRecuperacaoPedida = registrarEsquema(
  'RecuperacaoPedida',
  z.object({
    mensagem: z.string().meta({ description: 'Texto idêntico exista ou não a conta.' }),
  }),
);

/** Recusar um convite: mesma dupla email + código (RN-08/RN-10). */
export const EsquemaRecusarConvite = registrarEsquema(
  'RecusarConvite',
  z.object({
    email: z.string().trim().min(3),
    codigo: z.string().trim().regex(/^\d{6}$/, 'O código tem 6 dígitos.'),
  }),
);

/**
 * @fundacao consumido pelo contrato gerado (front). O cadastro NÃO abre sessão:
 * a resposta só confirma que o email saiu, porque o login segue bloqueado até
 * a confirmação (RN-06).
 */
export const EsquemaContaCriada = registrarEsquema(
  'ContaCriada',
  z.object({
    email: z.string().meta({ description: 'Para onde o email de confirmação foi enviado.' }),
  }),
);

/** @fundacao consumido pelo contrato gerado (front), não por import dentro deste repo. */
export const EsquemaConviteCriado = registrarEsquema(
  'ConviteCriado',
  z.object({
    id: z.string(),
    email: z.string(),
    expiraEm: z.string().meta({ description: 'ISO 8601 — quando o convite deixa de valer (RN-03).' }),
  }),
);

/**
 * Um item da listagem de pendentes (EF01-MC-001) — mesma forma de
 * `ConviteCriado`, nome próprio porque semanticamente é outra coisa: um
 * convite já existente, não o resultado de criar um.
 *
 * @fundacao consumido pelo contrato gerado (front), não por import dentro deste repo.
 */
export const EsquemaConvitePendente = registrarEsquema(
  'ConvitePendente',
  z.object({
    id: z.string(),
    email: z.string(),
    expiraEm: z.string().meta({ description: 'ISO 8601 — quando o convite deixa de valer (RN-03).' }),
  }),
);

/**
 * A resposta de `GET /convites` — lista embutida, mesmo padrão de
 * `FamiliaAtual` (`openapi/esquemas.ts`).
 *
 * @fundacao consumido pelo contrato gerado (front), não por import dentro deste repo.
 */
export const EsquemaConvitesPendentes = registrarEsquema(
  'ConvitesPendentes',
  z.object({
    convites: z.array(EsquemaConvitePendente),
  }),
);

/** O código de 6 dígitos que chegou por email (RN-10). */
const EsquemaCodigo = z.string().trim().regex(/^\d{6}$/, 'O código tem 6 dígitos.');

/**
 * Aceite por senha: o email vem do CORPO porque, ao contrário do login, não há
 * sessão ainda para derivá-lo — e agora ele é também a CHAVE DE BUSCA do
 * convite (RN-10: o código de 6 dígitos não é único sozinho). Com isso RN-02
 * deixa de ser uma comparação depois do fato: procura-se o convite DAQUELE
 * email, então não há como aceitar o de outra pessoa.
 *
 * As duas variantes ficam privadas ao módulo — só a união combinada
 * (`AceitarConvite`) entra no contrato.
 */
const EsquemaAceitarConvitePorSenha = z.object({
  metodo: z.literal('senha'),
  codigo: EsquemaCodigo,
  nome: z.string().min(1),
  email: z.string().min(3),
  senha: z.string().min(8),
});

// No Google o email não vem do corpo: vem VERIFICADO do provedor (RN-02), e é
// com ele que o convite é procurado.
const EsquemaAceitarConvitePorGoogle = z.object({
  metodo: z.literal('google'),
  codigo: EsquemaCodigo,
  idToken: z.string().min(1),
});

export const EsquemaAceitarConvite = registrarEsquema(
  'AceitarConvite',
  z.discriminatedUnion('metodo', [EsquemaAceitarConvitePorSenha, EsquemaAceitarConvitePorGoogle]),
);
