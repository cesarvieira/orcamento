/**
 * O TEMPO REAL, do lado do cliente.
 *
 * Quatro regras da EF-00 vivem aqui, e cada uma existe porque a alternativa já
 * custou caro em algum lugar:
 *
 * R2 · A room é do servidor. Este arquivo NÃO manda `subscribe(familiaId)`,
 *      não escolhe sala e não conhece o id da família. O handshake resolve
 *      tudo a partir do cookie. Se você precisar mudar de família aqui, a
 *      resposta é fazer login de novo.
 *
 * R3 · O que chega é INVALIDAÇÃO, não estado. Nenhum número do evento vai para
 *      a tela: o cliente refaz a leitura pela API. Aplicar diff exigiria
 *      reimplementar a fórmula do lastro no front — duas fontes da verdade
 *      para a regra que define o produto.
 *
 * R4 · Ao RECONECTAR, o cliente refaz a leitura da competência ativa,
 *      incondicionalmente. Um socket que cai e volta deixa a página perfeita,
 *      o console limpo e o número velho — e nenhum gate da fábrica cobre isso.
 *
 * R5 · O cliente DESCARTA o próprio eco. Quem agiu já recebeu o estado
 *      recomputado na resposta HTTP; refazer a leitura por causa do próprio
 *      evento é trabalho dobrado e pisca a tela.
 *
 * E o socket conecta SÓ NO CLIENTE, depois da hidratação: SSR não abre socket.
 */
import { io, type Socket } from 'socket.io-client';
import type { Ref } from 'vue';
import type { Invalidacao } from '@orcamento/contrato';

const CAMINHO_REALTIME = '/realtime';
const EVENTO_INVALIDACAO = 'recurso.alterado';

/** O que o assinante recebe. É o evento do contrato, sem enfeite. */
export type OuvinteDeInvalidacao = (evento: Invalidacao) => void | Promise<void>;

export interface OpcoesDeRealtime {
  /**
   * A competência que a tela está mostrando (`AAAA-MM`). É ela que o cliente
   * ressincroniza ao reconectar (R4). Passe um `ref`/`computed` para que a
   * troca de mês seja acompanhada.
   */
  competenciaAtiva?: Ref<string | null> | (() => string | null);
  /**
   * Chamada quando é preciso reler. Recebe o evento que a provocou, ou `null`
   * quando a causa foi uma reconexão.
   */
  aoInvalidar: (evento: Invalidacao | null) => void | Promise<void>;
  /** Filtra por recurso. Sem isto, a tela ouve tudo da família. */
  recursos?: string[];
}

/**
 * O id DESTE cliente. Um por aba, gerado uma vez. Vai no cabeçalho
 * `x-origem-cliente` de toda mutação e volta no evento — é assim que o eco se
 * reconhece.
 */
export function useOrigemClienteId(): string {
  const id = useState<string>('origem-cliente-id', () => {
    if (import.meta.server) return '';
    return globalThis.crypto?.randomUUID?.() ?? `cliente-${Date.now()}-${Math.random()}`;
  });

  // No SSR o valor nasce vazio de propósito: ele identifica uma ABA, e o
  // servidor não tem uma. É preenchido na hidratação.
  if (import.meta.client && !id.value) {
    id.value = globalThis.crypto?.randomUUID?.() ?? `cliente-${Date.now()}-${Math.random()}`;
  }

  return id.value;
}

export function useRealtime(opcoes: OpcoesDeRealtime) {
  const conectado = ref(false);
  const socket = shallowRef<Socket | null>(null);
  const origemClienteId = useOrigemClienteId();
  const base = useApiBasePublica();

  function competencia(): string | null {
    const alvo = opcoes.competenciaAtiva;
    if (!alvo) return null;
    return typeof alvo === 'function' ? alvo() : alvo.value;
  }

  function interessa(evento: Invalidacao): boolean {
    if (!opcoes.recursos || opcoes.recursos.length === 0) return true;
    return opcoes.recursos.includes(evento.recurso);
  }

  onMounted(() => {
    // SSR não abre socket. `onMounted` só roda no cliente, e é o ponto exato
    // depois da hidratação.
    const s = io(base, {
      path: CAMINHO_REALTIME,
      // O cookie httpOnly é o que autentica no handshake. Sem isto o navegador
      // não o manda para outra origem, e o servidor recusa a conexão.
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socket.value = s;

    s.on('connect', () => {
      conectado.value = true;

      // R4 — RESSINCRONIZAÇÃO, incondicional, em toda conexão estabelecida.
      //
      // Inclusive a primeira: o intervalo entre o render do servidor e a
      // hidratação já é tempo suficiente para outra pessoa da família ter
      // lançado alguma coisa. E, no reconectar, é o único jeito de saber o que
      // se perdeu — os eventos que passaram enquanto o socket estava fora não
      // voltam. Relê a competência ativa e pronto.
      void opcoes.aoInvalidar(null);
    });

    s.on('disconnect', () => {
      conectado.value = false;
    });

    s.on(EVENTO_INVALIDACAO, (evento: Invalidacao) => {
      // R5 — descarta o próprio eco.
      if (evento.origemClienteId && evento.origemClienteId === origemClienteId) return;

      if (!interessa(evento)) return;

      // A competência do evento pode ser de outro mês: quem está olhando
      // agosto não relê por causa de um lançamento de julho.
      const ativa = competencia();
      if (evento.competencia && ativa && evento.competencia !== ativa) return;

      // R3 — nada do evento vira estado. O que se faz com ele é RELER.
      void opcoes.aoInvalidar(evento);
    });
  });

  onBeforeUnmount(() => {
    socket.value?.close();
    socket.value = null;
    conectado.value = false;
  });

  return { conectado, origemClienteId };
}
