/**
 * O Google Identity Services (GIS), carregado sob demanda.
 *
 * Só entra em cena quando `googleClientId` está configurado — ver o
 * `runtimeConfig.public` em `nuxt.config.ts`. Onde ele estiver vazio, é o
 * CHAMADOR quem confere `disponivel` antes de pedir o token: sem client id não
 * há o que inicializar, e tentar mesmo assim seria carregar um script para nada.
 *
 * O client id NÃO é segredo — ele viaja no próprio ID token e sai no HTML por
 * definição. O que é segredo é o client SECRET, que este fluxo não usa: o
 * Identity Services entrega um ID token ao navegador, e quem o valida é a API.
 */

interface RespostaCredencialGoogle {
  credential: string;
}

interface MomentoGoogle {
  isNotDisplayed?: () => boolean;
  isSkippedMoment?: () => boolean;
}

interface GoogleAccountsId {
  initialize(config: {
    client_id: string;
    callback: (resposta: RespostaCredencialGoogle) => void;
  }): void;
  prompt(callback?: (notificacao: MomentoGoogle) => void): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

const URL_DO_SCRIPT = 'https://accounts.google.com/gsi/client';

let carregamento: Promise<void> | null = null;

function carregarScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
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

  /** Abre o fluxo do Google e devolve o ID token. Só chame quando `disponivel`. */
  async function obterIdToken(): Promise<string> {
    if (!disponivel) {
      throw new Error('Google não está configurado neste ambiente.');
    }

    await carregarScript();

    const google = window.google;
    if (!google) {
      throw new Error('Não consegui carregar o Google Identity Services.');
    }

    return new Promise<string>((resolve, reject) => {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: resposta => resolve(resposta.credential),
      });

      google.accounts.id.prompt((notificacao) => {
        if (notificacao?.isNotDisplayed?.() || notificacao?.isSkippedMoment?.()) {
          reject(new Error('O Google não mostrou a tela de entrada. Tente de novo.'));
        }
      });
    });
  }

  return { disponivel, obterIdToken };
}
