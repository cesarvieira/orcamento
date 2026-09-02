/**
 * O SDK do Sentry no SSR (D-08) — o processo Node que renderiza as telas.
 *
 * É aqui que a limpeza morde de verdade: o evento do servidor carrega o
 * cabeçalho da requisição que chegou ao Nuxt, e nele vem o cookie de sessão
 * inteiro. Ver `app/utils/limpeza-de-evento.ts`.
 *
 * Lê `process.env` direto, e não o `runtimeConfig`: este arquivo é carregado
 * pelo Nitro antes de o app existir. `NUXT_PUBLIC_SENTRY_DSN` é a MESMA
 * variável que alimenta o navegador — uma instância, um DSN.
 */
import * as Sentry from '@sentry/nuxt';

import { limparEvento } from './app/utils/limpeza-de-evento';

const dsn = process.env.NUXT_PUBLIC_SENTRY_DSN || '';
const release = process.env.NUXT_PUBLIC_SENTRY_RELEASE || '';

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NUXT_PUBLIC_SENTRY_AMBIENTE || process.env.NODE_ENV || 'development',
    ...(release ? { release } : {}),
    tracesSampleRate: Number(process.env.NUXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0),
    sendDefaultPii: false,
    beforeSend: evento => limparEvento(evento),
    beforeSendTransaction: evento => limparEvento(evento),
  });
}
