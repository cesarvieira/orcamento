/**
 * A porta. Neste produto TUDO é área logada: a única rota pública é `/entrar`.
 *
 * Roda no SSR e no cliente. No SSR a leitura da sessão usa o cookie que chegou
 * na requisição (ver `useApi`), então o servidor já entrega a página certa —
 * ninguém vê o app piscar antes de ser redirecionado.
 */
import { ROTA_DE_ENTRADA } from '../config/navegacao';

export default defineNuxtRouteMiddleware(async (para) => {
  const { sessao, carregar } = useSessao();

  if (!sessao.value) await carregar();

  const ehEntrada = para.path === ROTA_DE_ENTRADA;

  if (!sessao.value && !ehEntrada) {
    return navigateTo(ROTA_DE_ENTRADA);
  }

  if (sessao.value && ehEntrada) {
    return navigateTo('/');
  }

  return undefined;
});
