/**
 * A configuração vem do AMBIENTE — nunca de arquivo versionado (D-07).
 *
 * Este módulo valida o que chegou e falha alto quando falta o essencial: um
 * processo que sobe com metade da config e quebra na primeira requisição custa
 * mais caro que um que não sobe.
 */
import { z } from 'zod';

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),

  API_PORT: z.coerce.number().int().positive().default(3000),

  /**
   * Assina o cookie de sessão. Em produção é obrigatório; em dev e teste há um
   * default explícito para não travar o loop local.
   */
  SESSAO_SEGREDO: z.string().default('segredo-de-desenvolvimento'),
  SESSAO_TTL_HORAS: z.coerce.number().int().positive().default(720),

  /** Origem do front autorizada a mandar cookie (CORS com credenciais). */
  ORIGEM_WEB: z.string().default('http://localhost:3001'),

  MAIL_DRIVER: z.enum(['log', 'smtp', 'resend', 'ses']).default('log'),
  MAIL_FROM: z.string().default(''),
  CONVITE_TTL_HORAS: z.coerce.number().int().positive().default(72),
});

const analise = esquema.safeParse(process.env);

if (!analise.success) {
  const problemas = analise.error.issues
    .map((i) => `  · ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`Configuração de ambiente inválida:\n${problemas}`);
}

export const ambiente = analise.data;

if (
  ambiente.NODE_ENV === 'production' &&
  ambiente.SESSAO_SEGREDO === 'segredo-de-desenvolvimento'
) {
  // eslint-disable-next-line no-console
  console.warn(
    '[ambiente] SESSAO_SEGREDO não foi definido em produção — defina-o no ambiente.',
  );
}

export type Ambiente = typeof ambiente;
