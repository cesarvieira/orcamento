/**
 * O Google Identity Services (GIS), carregado sob demanda.
 *
 * Só entra em cena quando `googleClientId` está configurado — ver o
 * `runtimeConfig.public` em `nuxt.config.ts`. Onde ele estiver vazio, é o
 * CHAMADOR quem confere `disponivel` antes de pedir o código: sem client id
 * não há o que inicializar, e tentar mesmo assim seria carregar um script
 * para nada.
 *
 * ## Por que o fluxo de CÓDIGO, e não One Tap
 *
 * A primeira versão usava `google.accounts.id.prompt()` — One Tap. Ele só
 * aparece para quem JÁ tem sessão Google aberta no navegador; quem não tem
 * recebe "not signed in with the identity provider" e fica sem caminho
 * nenhum. E não há forma suportada de abrir o seletor de conta a partir de um
 * botão nosso naquele fluxo: quem abre é o botão que o próprio Google
 * renderiza, e adotá-lo custaria o padrão visual da tela.
 *
 * `google.accounts.oauth2.initCodeClient` pode ser disparado do NOSSO botão e
 * funciona sem sessão prévia — abre o popup de escolha de conta. O que ele
 * devolve não é um ID token: é um código de autorização de uso único, que
 * sozinho não prova nada. Quem o troca por um ID token é a API, porque a
 * troca exige o client secret — que não pode viver no navegador.
 *
 * O client id NÃO é segredo: viaja no próprio fluxo e sai no HTML por
 * definição. O client SECRET é, e por isso está só na API.
 */

interface RespostaDeCodigoGoogle {
  code?: string;
  error?: string;
}

interface ClienteDeCodigoGoogle {
  requestCode(): void;
}

interface GoogleOAuth2 {
  initCodeClient(config: {
    client_id: string;
    scope: string;
    ux_mode: 'popup';
    callback: (resposta: RespostaDeCodigoGoogle) => void;
    // Nome cravado pela API do Google — renomear para camelCase faria o campo
    // ser ignorado e o erro passar silencioso.
    // eslint-disable-next-line @typescript-eslint/naming-convention
    error_callback?: (erro: { type?: string }) => void;
  }): ClienteDeCodigoGoogle;
}

declare global {
  interface Window {
    google?: { accounts: { oauth2: GoogleOAuth2 } };
  }
}

const URL_DO_SCRIPT = 'https://accounts.google.com/gsi/client';

/**
 * O mínimo para saber QUEM entrou. `openid` é o que faz o Google devolver um
 * ID token na troca; sem ele voltaria só um access token, e a API não teria o
 * `email_verified` que RN-02 exige.
 */
const ESCOPO = 'openid email profile';

let carregamento: Promise<void> | null = null;

function carregarScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (carregamento) return carregamento;

  carregamento = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = URL_DO_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Não consegui carregar o Google Identity Services.'));
    document.head.appendChild(script);
  });

  return carregamento;
}

export function useGoogle() {
  const clientId = useRuntimeConfig().public.googleClientId as string;
  const disponivel = clientId.length > 0;

  /**
   * Abre o popup do Google e devolve o código de autorização. Só chame quando
   * `disponivel`.
   *
   * O cliente é criado a cada chamada de propósito: `initCodeClient` devolve
   * um objeto descartável amarrado a ESTE callback, e é ele que resolve esta
   * promessa. Guardar um cliente entre cliques foi o que, no fluxo antigo,
   * produzia o aviso de "initialize() chamado várias vezes".
   */
  async function obterCodigoDeAutorizacao(): Promise<string> {
    if (!disponivel) {
      throw new Error('Google não está configurado neste ambiente.');
    }

    await carregarScript();

    const google = window.google;
    if (!google) {
      throw new Error('Não consegui carregar o Google Identity Services.');
    }

    return new Promise<string>((resolve, reject) => {
      const cliente = google.accounts.oauth2.initCodeClient({
        client_id: clientId,
        scope: ESCOPO,
        ux_mode: 'popup',
        callback: (resposta) => {
          if (resposta.code) {
            resolve(resposta.code);
            return;
          }
          // Fechar o popup ou recusar o consentimento cai aqui. Não é falha do
          // app, e a mensagem não deve soar como se fosse.
          reject(new Error('Entrada com Google cancelada.'));
        },
        // eslint-disable-next-line @typescript-eslint/naming-convention
        error_callback: () => {
          reject(new Error('Não consegui abrir a entrada com Google. Tente de novo.'));
        },
      });

      cliente.requestCode();
    });
  }

  return { disponivel, obterCodigoDeAutorizacao };
}
