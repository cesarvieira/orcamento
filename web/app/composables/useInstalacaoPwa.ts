/**
 * O BOTÃO INSTALAR — estado compartilhado do evento `beforeinstallprompt`
 * (D-10, `docs/decisoes/D-10-pwa-instalavel.md`, §4).
 *
 * ⚠️ POR QUE NÃO HÁ `localStorage`, NEM USER AGENT, NEM `display-mode:
 * standalone` AQUI — e não é esquecimento. Quem sabe se este navegador está
 * OFERECENDO instalação agora é o navegador: ele só dispara
 * `beforeinstallprompt` quando manifesto, ícones e service worker passaram
 * na checagem dele **e** o app ainda não está instalado. Guardar esse fato
 * em estado nosso duplicaria uma resposta que o navegador já dá de graça — e
 * estado duplicado diverge (o app "acha" que pode instalar depois que já foi
 * instalado, ou o contrário). `podeInstalar` é `computed` do evento: sem
 * evento guardado, não tem o que mostrar; por construção, não por heurística.
 *
 * Estado em ESCOPO DE MÓDULO, não `useState`: o evento `BeforeInstallPromptEvent`
 * carrega um método (`prompt()`) e não é serializável — `useState` existe
 * para estado que hidrata do payload do SSR, e isto nunca existe no
 * servidor (nem o evento, nem a API que o dispara).
 *
 * Quem COMEÇA a escutar é `web/app/plugins/pwa.client.ts`, não o
 * `onMounted` de um componente: o navegador pode disparar
 * `beforeinstallprompt` antes de qualquer tela montar, e um listener que só
 * nasce quando o menu *Mais* é aberto perde o evento — ele não é reenviado.
 */

/** O shape mínimo do evento que este arquivo usa — a lib DOM do TypeScript ainda não o declara. */
interface EventoDeInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/** O evento adiado (`preventDefault()`), guardado até `instalar()` consumi-lo. */
const eventoDeInstalacao = shallowRef<EventoDeInstalacao | null>(null);

/** `true` só depois que `iniciarEscutaDeInstalacao()` rodou — evita registrar o listener duas vezes. */
let escutaIniciada = false;

/**
 * Começa a escutar `beforeinstallprompt`/`appinstalled`. Chamada uma vez, do
 * plugin `pwa.client.ts` — nunca de um componente (ver o cabeçalho acima).
 */
export function iniciarEscutaDeInstalacao(): void {
  if (escutaIniciada || import.meta.server) return;
  escutaIniciada = true;

  window.addEventListener('beforeinstallprompt', (evento) => {
    // Sem isto o Chrome mostra o próprio mini-infobar dele; o produto quer o
    // botão da casa (menu Mais / sidebar), não o banner do navegador.
    evento.preventDefault();
    eventoDeInstalacao.value = evento as EventoDeInstalacao;
  });

  // O navegador confirma que instalou — inclusive quando a instalação
  // aconteceu por um caminho que não passou pelo NOSSO botão (ex.: o menu
  // do próprio navegador). Zera o estado nos dois casos: o evento consumido
  // não pode ser reusado (ver `instalar()` abaixo), e agora não há mais o
  // que oferecer.
  window.addEventListener('appinstalled', () => {
    eventoDeInstalacao.value = null;
  });
}

export function useInstalacaoPwa() {
  const podeInstalar = computed(() => eventoDeInstalacao.value !== null);

  /**
   * Dispara o prompt nativo do navegador. `prompt()` só pode ser chamado
   * dentro de um gesto do usuário (o `@click` do botão) — chamar de outro
   * lugar é rejeitado pelo navegador, silenciosamente.
   */
  async function instalar(): Promise<void> {
    const evento = eventoDeInstalacao.value;
    if (!evento) return;

    // Descarta ANTES de aguardar: o navegador não permite reusar o mesmo
    // evento em nenhum desfecho (aceito, recusado, ou erro), e um usuário
    // que clique de novo antes do `userChoice` resolver não pode achar que
    // ainda há um prompt disponível.
    eventoDeInstalacao.value = null;

    await evento.prompt();
    await evento.userChoice;
  }

  return { podeInstalar, instalar };
}
