/**
 * Lançamentos (EF-04) — o CAMINHO DE ESCRITA: registrar, listar, detalhar e
 * excluir. Tarefa #53 (issue #53 da história #18).
 *
 * Os tipos vêm do CONTRATO GERADO — não redeclarados aqui (regra inviolável
 * #4 do projeto / D-03): importar de `@orcamento/contrato` é o que garante
 * que este arquivo nunca diverge do modelo que a API de fato aceita e
 * devolve. `gastoCentavos`/`disponivelCentavos` (lidos via `useOrcamento`)
 * são DERIVADOS pelo servidor a partir dos lançamentos — este módulo nunca
 * reproduz esse cálculo, só lê e manda a intenção de escrita.
 *
 * ⛔ Regra #0: RN-15..RN-22/RN-39 vêm de
 * `.preator/skills/negocio/lancamentos-e-parcelamento/SKILL.md`, citando
 * `docs/especificacoes/EF-04-lancamentos.md` §1/§2 como fonte primária. Nada
 * aqui foi preenchido de memória.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * A COSTURA PARA A TAREFA #54 (visão do mês · extrato) — CONTRATO DESTE
 * ARQUIVO, não invenção de quem consome:
 * ═══════════════════════════════════════════════════════════════════════
 *
 * A folha de lançamento (`sheetLanc`) e o modal de detalhe são COMPONENTES
 * GLOBAIS, montados uma única vez em `layouts/default.vue`
 * (`<FolhaLancamento />` e `<ModalDetalheLancamento />`). Nenhuma outra tela
 * precisa montá-los de novo — só ABRI-LOS, através do estado compartilhado
 * abaixo (mesmo mecanismo de `useCompetencia`/`useSessao`: `useState`,
 * seguro em SSR, sobrevive à navegação entre rotas).
 *
 * 1. Abrir a folha de novo lançamento — de QUALQUER tela:
 *
 *      const { abrir } = useFolhaLancamento();
 *      abrir();                          // sem categoria pré-selecionada (FAB / sidebar)
 *      abrir({ categoriaId: c.id });     // cartão de categoria da home (porta 2, recorte §1)
 *
 * 2. Abrir o modal de detalhe — do extrato (`e.abrir` no recorte §5):
 *
 *      const { abrir: abrirDetalhe } = useDetalheLancamento();
 *      abrirDetalhe(lancamento);         // o `Lancamento` que a tela já tem em mãos
 *
 * 3. Reler a lista ao vivo — a leitura em si (`listarLancamentos`) é sua;
 *    esta função só ativa a assinatura do recurso `lancamentos`
 *    (`useRealtime`, EF-00 R2-R5) pelo tempo de vida do componente que a
 *    chamar, incluindo a ressincronização ao reconectar (R4). Mesmo padrão
 *    de `orcamento.vue`/`contas.vue`, só que embutido aqui para a #54 não
 *    reescrever a fiação:
 *
 *      const { listarLancamentos } = useLancamentos({
 *        competenciaAtiva: computed(() => competencia.value),
 *        aoInvalidar: async () => { await carregar(); },
 *      });
 *
 *    Sem `aoInvalidar`, `useLancamentos()` continua um wrapper puro de API
 *    (nenhum socket é aberto) — é o que a folha e o modal desta tarefa usam.
 */
import type { Ref } from 'vue';
import type {
  Categoria,
  CategoriasListadas,
  FamiliaAtual,
  Invalidacao,
  Lancamento,
  LancamentosListados,
  ModoDeExclusao,
  NovoLancamento,
  operations,
} from '@orcamento/contrato';

/**
 * O filtro de `GET /lancamentos` — a MESMA forma que o OpenAPI declara
 * (issue #60: `api/src/modulos/lancamentos/rotas.ts` registra `competencia`
 * e `contaId` como parâmetros de query). Derivado de `operations`, não
 * redeclarado à mão — antes da #60 o contrato gerado dizia `query?: never`
 * para esta rota, e não havia como fazer diferente.
 */
type FiltroDeLancamentos = NonNullable<operations['get_lancamentos']['parameters']['query']>;

/**
 * Mesmo cabeçalho que `useContas.ts`/`useOrcamento.ts` usam — vai em toda
 * mutação para que o emissor da API devolva este id no evento de
 * invalidação, e o `useRealtime` descarte o próprio eco (R5). Mesmo nome
 * literal de `api/src/realtime/emissor.ts#CABECALHO_ORIGEM_CLIENTE`.
 */
const CABECALHO_ORIGEM_CLIENTE = 'x-origem-cliente';

/**
 * TIPO É CAMPO EXPLÍCITO (EF-04 §1/§4) — o mockup não tem esse seletor (ele
 * representava receita como valor negativo, e transferência nem existia:
 * exatamente as duas armadilhas que a EF-04 §4 manda NÃO copiar). Este trio
 * não sai do recorte — sai da própria EF-04 e do esquema do contrato
 * (`NovoLancamento` é `z.discriminatedUnion('tipo', ...)`). Visual construído
 * por analogia com `TIPOS_CONTA` (`useContas.ts`): mesma anatomia de seletor
 * em pílula que o resto do app já usa.
 */
export const TIPOS_LANCAMENTO = [
  { valor: 'DESPESA', rotulo: 'Despesa', icone: 'ti-arrow-down', cor: 'var(--alerta)' },
  { valor: 'RECEITA', rotulo: 'Receita', icone: 'ti-arrow-up', cor: 'var(--sucesso)' },
  { valor: 'TRANSFERENCIA', rotulo: 'Transferência', icone: 'ti-arrows-left-right', cor: 'var(--tinta)' },
] as const satisfies readonly { valor: Lancamento['tipo']; rotulo: string; icone: string; cor: string }[];

/** A cor semântica de um lançamento pelo tipo — mesmo mapa usado na folha e no modal de detalhe. */
export function corDoTipo(tipo: Lancamento['tipo']): string {
  return TIPOS_LANCAMENTO.find(t => t.valor === tipo)?.cor ?? 'var(--tinta)';
}

export function useLancamentos(opcoes: {
  /** Se informado, assina o recurso `lancamentos` pelo tempo de vida do componente chamador (ver cabeçalho). */
  aoInvalidar?: (evento: Invalidacao | null) => void | Promise<void>;
  /** A competência que a tela mostra — usada só para o filtro de mês do `useRealtime` (R4/R5). */
  competenciaAtiva?: Ref<string | null> | (() => string | null);
} = {}) {
  const api = useApi();
  const origemClienteId = useOrigemClienteId();
  const cabecalhoDeOrigem = { [CABECALHO_ORIGEM_CLIENTE]: origemClienteId };

  if (opcoes.aoInvalidar) {
    useRealtime({
      recursos: ['lancamentos'],
      competenciaAtiva: opcoes.competenciaAtiva,
      aoInvalidar: opcoes.aoInvalidar,
    });
  }

  /**
   * AVISA AS TELAS DESTA ABA que os lançamentos mudaram.
   *
   * ⚠️ Existe porque quem MUTA lançamento não é quem MOSTRA: a folha
   * (`FolhaLancamento.vue`) e o modal de detalhe são componentes GLOBAIS que
   * postam e fecham; a lista está em `pages/index.vue` e `pages/extrato.vue`.
   *
   * Sem isto, o único aviso seria o eco do socket — que a própria aba descarta
   * por R5. Defeito medido em 2026-08-28: o lançamento aparecia em todas as
   * OUTRAS abas e não na que o criou.
   *
   * Não afrouxa R5. O eco do socket continua descartado, e a releitura desta
   * aba acontece UMA vez, por este caminho.
   *
   * `competencia: null` de propósito: uma DESPESA parcelada atinge várias
   * competências (RN-20), e a exclusão não devolve quais foram. `null` é
   * tratado como "interessa a quem estiver olhando" — errar para o lado de uma
   * leitura a mais é barato; não avisar é o defeito que isto conserta.
   */
  function avisarAsTelasDestaAba(): void {
    notificarInvalidacaoLocal({ recurso: 'lancamentos', competencia: null, origemClienteId });
  }

  /** O extrato: lançamentos da família da sessão, com filtro opcional de competência e conta (EF-04 §3). */
  async function listarLancamentos(filtro: FiltroDeLancamentos = {}): Promise<LancamentosListados> {
    return api<LancamentosListados>('/lancamentos', { query: filtro });
  }

  /** O detalhe de um único lançamento (modal `detalhe`, recorte §3). */
  async function buscarLancamento(id: string): Promise<Lancamento> {
    return api<Lancamento>(`/lancamentos/${id}`);
  }

  /**
   * Registra um lançamento. DESPESA com `quantidadeParcelas` > 1 gera a
   * série inteira no servidor (RN-20/RN-21) — a resposta já traz todos os N
   * lançamentos; esta função NUNCA calcula a divisão das parcelas, só manda
   * a intenção (regra inviolável #4).
   */
  async function criarLancamento(dados: NovoLancamento): Promise<LancamentosListados> {
    const resposta = await api<LancamentosListados>('/lancamentos', {
      method: 'POST',
      body: dados,
      headers: cabecalhoDeOrigem,
    });
    avisarAsTelasDestaAba();
    return resposta;
  }

  /** Fork 1/#52 — `modo` escolhe o alcance quando o lançamento é parcela de uma série. */
  async function excluirLancamento(id: string, modo: ModoDeExclusao = 'esta'): Promise<void> {
    await api(`/lancamentos/${id}`, {
      method: 'DELETE',
      query: { modo },
      headers: cabecalhoDeOrigem,
    });
    avisarAsTelasDestaAba();
  }

  /**
   * As categorias da família — só IDENTIDADE (nome/ícone/cor), sem teto nem
   * disponível: é o que o modal de detalhe precisa para nomear a categoria
   * de um lançamento já lançado, sem carregar leitura de competência para
   * isso. Endpoint já existe (`orcamento/rotas.ts`, EF-03) — chamado, não
   * recriado.
   */
  async function listarCategorias(): Promise<Categoria[]> {
    const resposta = await api<CategoriasListadas>('/categorias');
    return resposta.categorias;
  }

  /**
   * Os membros da família da sessão — só para resolver `criadoPorMembroId`
   * em nome no modal de detalhe (`quem`, EF-04 §3, RN-16). Endpoint já
   * existe (`familia/rotas.ts`, EF-01) — chamado, não recriado.
   */
  async function listarMembrosDaFamilia(): Promise<FamiliaAtual['membros']> {
    const familia = await api<FamiliaAtual>('/familia');
    return familia.membros;
  }

  return {
    listarLancamentos,
    buscarLancamento,
    criarLancamento,
    excluirLancamento,
    listarCategorias,
    listarMembrosDaFamilia,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// ABERTURA DA FOLHA (`sheetLanc`) — estado global, ver cabeçalho do arquivo.
// ─────────────────────────────────────────────────────────────────────────

export function useFolhaLancamento() {
  const aberta = useState<boolean>('folha-lancamento-aberta', () => false);
  /** A categoria pré-escolhida quando a folha abre pela porta 2 (cartão de categoria da home, recorte §1). */
  const categoriaPreSelecionada = useState<string | null>('folha-lancamento-categoria-pre-selecionada', () => null);

  function abrir(opcoes: { categoriaId?: string } = {}): void {
    categoriaPreSelecionada.value = opcoes.categoriaId ?? null;
    aberta.value = true;
  }
  function fechar(): void {
    aberta.value = false;
  }

  return { aberta, categoriaPreSelecionada, abrir, fechar };
}

// ─────────────────────────────────────────────────────────────────────────
// ABERTURA DO MODAL DE DETALHE — estado global, ver cabeçalho do arquivo.
// ─────────────────────────────────────────────────────────────────────────

export function useDetalheLancamento() {
  /** O lançamento em detalhe — `null` é "fechado". A tela que abre já tem o objeto em mãos (extrato). */
  const lancamento = useState<Lancamento | null>('detalhe-lancamento-atual', () => null);

  function abrir(item: Lancamento): void {
    lancamento.value = item;
  }
  function fechar(): void {
    lancamento.value = null;
  }

  return { lancamento, abrir, fechar };
}
