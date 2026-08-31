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
 *      ⚠️ E R5 TEM UM OUTRO LADO, que faltava e custou um defeito visível:
 *      a premissa "quem agiu já tem o estado" só vale quando quem AGE é quem
 *      MOSTRA. Em `contas.vue` vale — a mesma tela posta e relê. Na folha de
 *      lançamento NÃO vale: ela posta, descarta a resposta e fecha; quem
 *      mostra a lista é outro componente (`pages/index.vue`, `extrato.vue`),
 *      que nunca fica sabendo. Resultado medido: o lançamento aparecia nas
 *      OUTRAS abas e não na que o criou — porque só ela descartava o eco.
 *
 *      Por isso existe `notificarInvalidacaoLocal` abaixo. Ela é o eco que a
 *      própria aba emite para si mesma quando o ator não é o exibidor. Não
 *      afrouxa R5: o eco do socket continua descartado, e a leitura acontece
 *      UMA vez.
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

/**
 * OS ASSINANTES DESTA ABA — o outro lado do R5 (ver o cabeçalho).
 *
 * Registro de módulo, não `useState`: isto não é estado que hidrata nem que
 * viaja no payload do SSR, são callbacks vivos de componentes montados. Cada
 * `useRealtime` entra aqui ao montar e sai ao desmontar.
 */
const assinantesLocais = new Set<(evento: Invalidacao) => void>();

/**
 * Avisa as telas DESTA ABA que um recurso mudou — sem passar pelo socket.
 *
 * Use quando quem MUTA não é quem MOSTRA. Quem muta e mostra (o padrão de
 * `contas.vue`/`orcamento.vue`) continua fazendo o mais simples: chama a
 * própria releitura depois do POST, e não precisa disto.
 *
 * ⚠️ Passe `competencia: null` a menos que você tenha certeza de UMA
 * competência afetada: o filtro de mês trata `null` como "interessa a quem
 * estiver olhando", que é o comportamento seguro. Errar para o lado de uma
 * leitura a mais é barato; errar para o lado de não avisar é o defeito que
 * esta função existe para fechar.
 */
export function notificarInvalidacaoLocal(evento: Invalidacao): void {
  for (const assinante of assinantesLocais) assinante(evento);
}

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

/**
 * O SOCKET FÍSICO — UM por aba, não um por chamada de `useRealtime`.
 *
 * A rodada anterior desta correção supôs que duas chamadas de
 * `useRealtime()` com a mesma URL/path compartilhassem o `Manager` do
 * `socket.io-client` por multiplexação implícita. Medido com a biblioteca
 * REAL (não o mock): `s1.io === s2.io` deu `false` para duas chamadas do
 * mesmo componente — a premissa era falsa. E mesmo que fosse verdadeira, duas
 * conexões físicas independentes reconectam com jitter aleatório cada uma; os
 * dois `connect` não cairiam de forma confiável no mesmo microtask.
 *
 * A correção não depende de nenhuma garantia da biblioteca: existe UM único
 * `Socket` por `base` nesta aba, criado na primeira chamada e reaproveitado
 * por TODA chamada seguinte de `useRealtime`. Com um socket físico só, existe
 * fisicamente UM `connect` por reconexão — não dois disputando jitter
 * separado.
 *
 * Fecha só quando o ÚLTIMO assinante desmontar (contagem de referências
 * abaixo): se a primeira tela a montar o socket for também a primeira a
 * desmontar, ela não pode derrubar a conexão que uma segunda tela ainda usa.
 */
interface EntradaDeSocket {
  socket: Socket;
  assinantes: number;
}

const socketsPorBase = new Map<string, EntradaDeSocket>();

/** Reaproveita o socket físico desta `base` se já existir; cria um novo (e o registra) se não. */
function obterOuCriarSocket(base: string): Socket {
  let entrada = socketsPorBase.get(base);
  if (!entrada) {
    const s = io(base, {
      path: CAMINHO_REALTIME,
      // O cookie httpOnly é o que autentica no handshake. Sem isto o navegador
      // não o manda para outra origem, e o servidor recusa a conexão.
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
    entrada = { socket: s, assinantes: 0 };
    socketsPorBase.set(base, entrada);
  }
  entrada.assinantes += 1;
  return entrada.socket;
}

/** Desconta um assinante desta `base`; fecha o socket físico só quando o último sair. */
function liberarSocket(base: string): void {
  const entrada = socketsPorBase.get(base);
  if (!entrada) return;
  entrada.assinantes -= 1;
  if (entrada.assinantes > 0) return;
  entrada.socket.close();
  socketsPorBase.delete(base);
}

/**
 * COALESCÊNCIA DE RECONEXÃO POR INSTÂNCIA DE COMPONENTE — fork já decidido
 * pelo humano na issue #104 (história #63). Com o socket já singleton por
 * aba (acima), uma reconexão física dispara UM `connect` só — mas cada
 * chamada de `useRealtime` registra seu PRÓPRIO listener nesse mesmo socket.
 * Um componente que chama `useRealtime`/`useLancamentos` mais de uma vez
 * (ex.: `pages/index.vue`, que ouve `lancamentos` via `useLancamentos` e
 * `orcamento`/`contas` via `useRealtime` direto) ainda receberia um resync
 * POR CHAMADA nessa única reconexão física.
 *
 * A chave é a INSTÂNCIA DO COMPONENTE (`getCurrentInstance()`), não o socket
 * físico e não uma dedupe global: quando duas ou mais chamadas de
 * `useRealtime` pertencem ao MESMO componente, o `connect` físico dispara só
 * UM dos resyncs registrados, não os N. Componentes diferentes continuam
 * cada um com seu próprio resync.
 */
interface GrupoDeReconexao {
  /** `true` enquanto o resync desta rodada de reconexão já foi disparado. */
  resyncEmAndamento: boolean;
}

const gruposPorInstancia = new WeakMap<object, GrupoDeReconexao>();

/**
 * O grupo de coalescência desta chamada. Fora de um componente (sem
 * instância — não é o uso real, mas é o caminho de teste direto do
 * composable) cada chamada vira seu próprio grupo: sem instância não há
 * "mesmo componente" para coalescer.
 */
function grupoDeReconexaoAtual(): GrupoDeReconexao {
  const chave: object = getCurrentInstance() ?? {};
  let grupo = gruposPorInstancia.get(chave);
  if (!grupo) {
    grupo = { resyncEmAndamento: false };
    gruposPorInstancia.set(chave, grupo);
  }
  return grupo;
}

/**
 * Roda `resync` no máximo UMA vez por grupo, por rodada de reconexão. A
 * segunda (e demais) chamada dentro da MESMA rodada síncrona é descartada —
 * é exatamente o "N assinaturas, 1 resync" que a issue #104 exige. A janela
 * fecha numa microtarefa: a PRÓXIMA reconexão (nova queda de socket) já
 * libera de novo.
 */
function resincronizarUmaVezPorGrupo(grupo: GrupoDeReconexao, resync: () => void | Promise<void>): void {
  if (grupo.resyncEmAndamento) return;
  grupo.resyncEmAndamento = true;
  queueMicrotask(() => {
    grupo.resyncEmAndamento = false;
  });
  void resync();
}

export function useRealtime(opcoes: OpcoesDeRealtime) {
  const conectado = ref(false);
  const socket = shallowRef<Socket | null>(null);
  const origemClienteId = useOrigemClienteId();
  const base = useApiBasePublica();
  // Capturado AQUI (síncrono, durante o `setup()` de quem chamou) — é o
  // único ponto em que `getCurrentInstance()` é garantidamente válido.
  const grupoDeReconexao = grupoDeReconexaoAtual();

  function competencia(): string | null {
    const alvo = opcoes.competenciaAtiva;
    if (!alvo) return null;
    return typeof alvo === 'function' ? alvo() : alvo.value;
  }

  function interessa(evento: Invalidacao): boolean {
    if (!opcoes.recursos || opcoes.recursos.length === 0) return true;
    return opcoes.recursos.includes(evento.recurso);
  }

  /**
   * O filtro e a releitura, num lugar só — usado pelo evento do socket E pela
   * notificação local. Duas cópias deste trecho divergiriam na primeira vez
   * que alguém ajustasse o filtro de competência de um lado só.
   *
   * ⚠️ O descarte do próprio eco (R5) NÃO está aqui de propósito: ele é do
   * caminho do socket. A notificação local é, por definição, do próprio
   * cliente — passá-la pelo descarte a anularia, que é exatamente o defeito
   * que ela conserta.
   */
  function tratarInvalidacao(evento: Invalidacao): void {
    if (!interessa(evento)) return;

    // A competência do evento pode ser de outro mês: quem está olhando
    // agosto não relê por causa de um lançamento de julho.
    const ativa = competencia();
    if (evento.competencia && ativa && evento.competencia !== ativa) return;

    // R3 — nada do evento vira estado. O que se faz com ele é RELER.
    void opcoes.aoInvalidar(evento);
  }

  // R4 — RESSINCRONIZAÇÃO, incondicional, em toda conexão estabelecida.
  //
  // Inclusive a primeira: o intervalo entre o render do servidor e a
  // hidratação já é tempo suficiente para outra pessoa da família ter
  // lançado alguma coisa. E, no reconectar, é o único jeito de saber o que se
  // perdeu — os eventos que passaram enquanto o socket estava fora não
  // voltam. Relê a competência ativa e pronto.
  //
  // Coalescida por COMPONENTE (issue #104): se este `useRealtime` é uma de
  // várias chamadas do mesmo componente, só a primeira desta rodada de
  // reconexão efetivamente relê — ver `resincronizarUmaVezPorGrupo`.
  function aoConectar(): void {
    conectado.value = true;
    resincronizarUmaVezPorGrupo(grupoDeReconexao, () => opcoes.aoInvalidar(null));
  }

  function aoDesconectar(): void {
    conectado.value = false;
  }

  function aoReceberEventoDeInvalidacao(evento: Invalidacao): void {
    // R5 — descarta o próprio eco. Quem agiu já se avisou localmente
    // (`notificarInvalidacaoLocal`) ou já releu por conta própria.
    if (evento.origemClienteId && evento.origemClienteId === origemClienteId) return;

    tratarInvalidacao(evento);
  }

  onMounted(() => {
    // SSR não abre socket. `onMounted` só roda no cliente, e é o ponto exato
    // depois da hidratação. `obterOuCriarSocket` reaproveita o socket físico
    // desta aba se outra assinatura já o abriu (ver comentário acima).
    const s = obterOuCriarSocket(base);
    socket.value = s;
    // O socket pode já estar conectado — reaproveitado de outra assinatura
    // desta aba — então reflete o estado real dele, não assume `false`.
    conectado.value = s.connected;

    s.on('connect', aoConectar);
    s.on('disconnect', aoDesconectar);
    s.on(EVENTO_INVALIDACAO, aoReceberEventoDeInvalidacao);

    assinantesLocais.add(tratarInvalidacao);
  });

  onBeforeUnmount(() => {
    assinantesLocais.delete(tratarInvalidacao);

    const s = socket.value;
    if (s) {
      // Remove SÓ os listeners desta chamada — o socket é compartilhado, e
      // `close()` incondicional aqui derrubaria a conexão de outra
      // assinatura ainda montada. `liberarSocket` decide se fecha de verdade.
      s.off('connect', aoConectar);
      s.off('disconnect', aoDesconectar);
      s.off(EVENTO_INVALIDACAO, aoReceberEventoDeInvalidacao);
      liberarSocket(base);
    }
    socket.value = null;
    conectado.value = false;
  });

  return { conectado, origemClienteId };
}
