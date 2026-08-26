/**
 * A porta. Neste produto TUDO é área logada: as únicas rotas públicas são
 * `/entrar` e `/convite/:token` — quem chega por um link de convite ainda não
 * tem sessão nenhuma (EF-01, §3).
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
  const ehConvite = para.path.startsWith('/convite/');
  // Criar conta e confirmar email sao anteriores a sessao por definicao
  // (RN-06): quem chega neles ainda nao pode entrar.
  const ehCadastro = para.path === '/criar-conta' || para.path.startsWith('/confirmar/');
  const ehPublica = ehEntrada || ehConvite || ehCadastro;

  if (!sessao.value && !ehPublica) {
    return navigateTo(ROTA_DE_ENTRADA);
  }

  if (sessao.value && ehEntrada) {
    return navigateTo('/');
  }

  return undefined;
});
