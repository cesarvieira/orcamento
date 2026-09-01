/**
 * A porta. Neste produto TUDO é área logada: as únicas rotas públicas são
 * `/entrar`, `/convite`, `/criar-conta`, `/confirmar` e `/recuperar` — quem chega por um
 * email de convite ou de confirmação ainda não tem sessão nenhuma (EF-01, §3).
 *
 * Roda no SSR e no cliente. No SSR a leitura da sessão usa o cookie que chegou
 * na requisição (ver `useApi`), então o servidor já entrega a página certa —
 * ninguém vê o app piscar antes de ser redirecionado.
 *
 * ⚠️ Há TRÊS estados, não dois: há sessão, não há sessão, e **não deu para
 * perguntar**. Tratar o terceiro como o segundo foi o defeito que fazia o F5
 * não sobreviver à sessão — ver `ApiInalcancavel` em `useSessao.ts`.
 */
import { ROTA_DE_ENTRADA } from '../config/navegacao';
import { ApiInalcancavel } from '../composables/useSessao';

export default defineNuxtRouteMiddleware(async (para) => {
  const { sessao, carregar } = useSessao();

  const ehEntrada = para.path === ROTA_DE_ENTRADA;
  const ehConvite = para.path === '/convite';
  // Criar conta e confirmar email sao anteriores a sessao por definicao
  // (RN-06): quem chega neles ainda nao pode entrar.
  const ehCadastro = para.path === '/criar-conta' || para.path === '/confirmar';
  // Recuperar senha e, por definicao, coisa de quem NAO consegue entrar.
  const ehRecuperacao = para.path === '/recuperar';
  const ehPublica = ehEntrada || ehConvite || ehCadastro || ehRecuperacao;

  if (!sessao.value) {
    try {
      await carregar();
    } catch (erro: unknown) {
      if (!(erro instanceof ApiInalcancavel)) throw erro;

      // O endereço que não respondeu vai para o LOG do servidor, sempre — em
      // produção o Nuxt esconde a mensagem do erro de quem acessa (e faz
      // bem), então sem esta linha o diagnóstico não chega a ninguém. Mesma
      // divisão do `tratarErro` da API: detalhe para o log, tela genérica
      // para quem usa. Com o Sentry ligado (D-08), isto também vira evento.

      console.error(`[sessao] ${erro.message}`);

      // Rota pública: renderiza. Não há decisão de sessão a tomar aqui, e
      // negar a tela de login a quem quer entrar porque a API piscou seria
      // trocar um problema por outro.
      if (ehPublica) return undefined;

      // Rota privada: pare, com o motivo REAL. Mandar para `/entrar` seria
      // AFIRMAR "você não está logado" — exatamente o que não se sabe — e é
      // isso que transforma uma porta errada num redirect misterioso.
      throw createError({
        statusCode: 503,
        // ASCII puro: `statusMessage` vira o reason-phrase da linha de status
        // HTTP, que por RFC 9110 não é lugar para acento — proxy no caminho
        // engasga, e o texto chega picotado de qualquer jeito.
        statusMessage: 'API indisponivel',
        // O detalhe COM o endereço. Aparece na tela em desenvolvimento; em
        // produção o Nuxt o esconde de quem acessa, e é o `console.error`
        // acima que o entrega a quem opera.
        message: erro.message,
        fatal: true,
      });
    }
  }

  if (!sessao.value && !ehPublica) {
    return navigateTo(ROTA_DE_ENTRADA);
  }

  if (sessao.value && ehEntrada) {
    return navigateTo('/');
  }

  return undefined;
});
