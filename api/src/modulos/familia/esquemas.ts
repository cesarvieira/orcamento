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
 * Aceite por senha: o email vem do CORPO porque, ao contrário do login, não
 * há sessão ainda para derivá-lo — é o próprio `email` que RN-02 confere
 * contra `convite.email`. Aceite por Google ignora este campo por completo:
 * o email que conta é o VERIFICADO do token, nunca o digitado (RN-02).
 *
 * As duas variantes ficam privadas ao módulo — só a união combinada
 * (`AceitarConvite`) entra no contrato.
 */
const EsquemaAceitarConvitePorSenha = z.object({
  metodo: z.literal('senha'),
  nome: z.string().min(1),
  email: z.string().min(3),
  senha: z.string().min(8),
});

const EsquemaAceitarConvitePorGoogle = z.object({
  metodo: z.literal('google'),
  idToken: z.string().min(1),
});

export const EsquemaAceitarConvite = registrarEsquema(
  'AceitarConvite',
  z.discriminatedUnion('metodo', [EsquemaAceitarConvitePorSenha, EsquemaAceitarConvitePorGoogle]),
);
