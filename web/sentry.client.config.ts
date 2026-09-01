/**
 * O SDK do Sentry no NAVEGADOR (D-08).
 *
 * Arquivo de raiz por exigência do `@sentry/nuxt`: ele o carrega antes do app,
 * que é o único momento em que dá para instrumentar `fetch`, navegação e o
 * tratador de erro do Vue. Não é uma exceção à regra de que o front vive em
 * `app/` — é o contrato do módulo.
 *
 * ⛔ Não existe `web/server/`, e isto não abre um: é configuração, não rota.
 *
 * DSN vazio (o default) = SDK inerte. É o que mantém o gate de navegação com
 * ZERO erro de rede: um coletor inalcançável viraria requisição falhada no
 * console de toda tela provada.
 */
import * as Sentry from '@sentry/nuxt';

import { limparEvento } from './app/utils/limpeza-de-evento';

const config = useRuntimeConfig();
const dsn = (config.public.sentryDsn as string) || '';
const release = (config.public.sentryRelease as string) || '';

if (dsn) {
  Sentry.init({
    dsn,
    environment: (config.public.sentryAmbiente as string) || 'development',
    ...(release ? { release } : {}),
    tracesSampleRate: Number(config.public.sentryTracesSampleRate ?? 0),
    // O default do SDK manda IP e cabeçalho de identificação. Aqui não: o que
    // se quer saber é O QUE quebrou, não quem estava logado.
    sendDefaultPii: false,
    beforeSend: evento => limparEvento(evento),
    beforeSendTransaction: evento => limparEvento(evento),
  });
}
