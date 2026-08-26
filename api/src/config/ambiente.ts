/**
 * A configuração vem do AMBIENTE — nunca de arquivo versionado (D-07).
 *
 * Este módulo valida o que chegou e falha alto quando falta o essencial: um
 * processo que sobe com metade da config e quebra na primeira requisição custa
 * mais caro que um que não sobe.
 *
 * O dotenv carrega `.env` + `.env.${NODE_ENV}` para `process.env` ANTES da
 * validação — fora do compose (que injeta variável direto), nada mais faz
 * isso. Ver `carregar-dotenv.ts` para a ordem das camadas.
 */
import { z } from 'zod';

import { carregarAmbiente } from './carregar-dotenv';

carregarAmbiente();

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
  /** Credencial do provedor de API (Resend/SES). Vazia quando MAIL_DRIVER=log|smtp. */
  MAIL_API_KEY: z.string().default(''),
  /** Só usados quando MAIL_DRIVER=smtp — qualquer fornecedor que fale o protocolo. */
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  CONVITE_TTL_HORAS: z.coerce.number().int().positive().default(72),
  // Prazo do link que confirma o email de quem criou a família (RN-09).
  // Menor que o do convite de propósito: quem acabou de se cadastrar está com
  // a caixa de entrada aberta; convite espera a agenda de outra pessoa.
  CADASTRO_TTL_HORAS: z.coerce.number().int().positive().default(24),

  /**
   * O client id OAuth do Google — não é segredo (viaja no próprio token), mas
   * é a AUDIÊNCIA que a verificação do ID token exige (EF-01). Vazio desliga
   * o login por Google com um erro claro, em vez de aceitar qualquer token.
   */
  GOOGLE_CLIENT_ID: z.string().default(''),
});

const analise = esquema.safeParse(process.env);

if (!analise.success) {
  const problemas = analise.error.issues
    .map(i => `  · ${i.path.join('.')}: ${i.message}`)
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

/** @fundacao ninguém tipa contra isto ainda — todo mundo importa `ambiente` direto. */
export type Ambiente = typeof ambiente;
