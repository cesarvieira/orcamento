<script setup lang="ts">
/**
 * FATURAS (EF-05) — a tela `fatura` do mockup. Tarefa #71 (issue #71 da
 * história #19). O recorte `.motor/recorte-desenho-19.md` é FONTE, não
 * ilustração (não commitado, artefato do condutor) — 🟦 é desenho, 🟨 é
 * anotação do condutor. As decisões humanas D1-D4 (2026-08-28) são FONTE
 * também, e acrescentam superfície que o desenho NÃO tem.
 *
 * Esta tela só LÊ e FORMATA `Fatura`/`FaturasDoCartao` — nunca recalcula
 * total, limite livre ou saldo do cartão (regra inviolável #4). O total do
 * cabeçalho é `conta.saldoCentavos` (já DERIVADO pelo servidor, EF-02 §1,
 * mesmo campo que `contas.vue` mostra na lista) — RN-25/D1 já estão
 * implementadas nele; esta tela não soma nada por conta própria para
 * chegar lá.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * O QUE VEM DO DESENHO (recorte §2/§3/§4) E O QUE VEM DE D2/D3/D4:
 * ═══════════════════════════════════════════════════════════════════════
 *
 * 🟦 Do desenho: o cabeçalho azul (nome do cartão, total, `faturaDatas` —
 * "fecha dia X · vence dia Y · limite livre Z", onde X/Y são os dias FIXOS
 * do cartão, `diaFechamento`/`diaVencimento` — não datas de uma fatura
 * específica); o aviso, palavra por palavra; a lista de itens (mesmo
 * `mapLanc` do extrato: ícone/cor da categoria, `desc`, `sub`); o botão de
 * pagar; a diferença desktop (botão sobe para o cabeçalho, fundo
 * branco/texto azul, rótulo curto, lista vira tabela num card só — aqui
 * implementada reaproveitando `.lista`/`.linha` globais, que JÁ SÃO "card
 * único com linhas separadas por filete"); a ausência de breadcrumb no
 * desktop; o breadcrumb `‹ Contas` no mobile.
 *
 * 🟨 Divergência declarada do `sub` do item: o mockup inclui `· crédito`
 * porque `mapLanc` serve uma lista que mistura contas; aqui TODO item já é
 * do cartão em foco — repetir seria ruído. Omitido de propósito. Também não
 * há `quem` no sub: `ItemDeFatura` (o contrato) é a forma REDUZIDA do
 * lançamento (EF-05 `esquemas.ts`) e não carrega `criadoPorMembroId`.
 *
 * D2 · DOIS BLOCOS (decisão humana, não está no desenho): a fatura fechada
 * aguardando pagamento E o ciclo corrente acumulando. Implementado como uma
 * lista de `blocos` — normalmente um `FECHADA` + o `ABERTA` corrente, mas o
 * código não assume isso: se a família pulou mais de um pagamento (a
 * skill de negócio registra esse cenário como caso real de D1), cada
 * fatura `FECHADA` vira seu próprio bloco, com seu próprio botão.
 *
 * D3 · SELETOR DE CONTA PAGADORA: dropdown entre as contas `DEBITO`
 * (mesmo padrão de interação do filtro de conta do extrato — reaproveitado,
 * não outra UI inventada), default na primeira, e o rótulo do botão nomeia
 * a conta escolhida — nunca "conta corrente" fixo como no protótipo.
 *
 * D4 · SELETOR DE CARTÃO: aparece só com 2+ contas `CREDITO`. Ausente com
 * um cartão só (o app tem hoje uma família de teste com um cartão — este
 * seletor então fica invisível até existir um segundo, mas o código já o
 * cobre). O `contaId` da URL (query) é a porta 1 do recorte (`Ver fatura`
 * no cartão de `contas.vue`, EF-02 — fora de escopo desta tarefa, só
 * consumido aqui); sem ele, cai no fallback "primeiro cartão" (mesmo
 * `cartaoFoco` do recorte).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * O FORK, declarado: quando há MAIS DE UMA fatura fechada não paga ao
 * mesmo tempo, o desenho não cobre (D2 fala de "a fatura", singular) — o
 * botão do cabeçalho (desktop) só aparece quando há EXATAMENTE UMA fatura
 * fechada; com duas ou mais, cada bloco ganha seu próprio botão (mobile E
 * desktop), em vez de um botão do cabeçalho ambíguo sobre qual fatura ele
 * pagaria. Ver `faturaParaBotaoNoCabecalho`/`mostrarBotaoDesktopNoBloco`.
 *
 * V5 (recorte §6, "não há estado vazio desenhado"): resolvido sem inventar
 * tela — o único vazio real do desenho é o toast de "Não há fatura em
 * aberto nesse cartão" ao tentar pagar uma fatura sem valor (409
 * `fatura_sem_valor`), e a API já devolve essa MESMA frase; `erroPagamento`
 * só exibe o que o backend mandou (mesmo padrão de `mensagemDoErro`, nunca
 * texto inventado). O único vazio de fato novo — nenhum cartão cadastrado
 * — usa uma frase própria, marcada como tal, no mesmo espírito do vazio de
 * "família nova" que `extrato.vue` já registra como divergência.
 */
import type { Categoria, Conta, Fatura, FaturasDoCartao, ItemDeFatura } from '@orcamento/contrato';
import { classeDoIcone, useContas } from '~/composables/useContas';
import { useFaturas } from '~/composables/useFaturas';
import { useLancamentos } from '~/composables/useLancamentos';
import { classeDoIconeCategoria } from '~/composables/useOrcamento';
import { formatarCentavos } from '~/utils/dinheiro';

const rota = useRoute();
const roteador = useRouter();

const { listarContas } = useContas();
const { listarFaturas, pagarFatura } = useFaturas();
const { listarCategorias } = useLancamentos();

// ── CONTAS DE APOIO — cartões (D4) e contas débito (D3) ──────────────────

const cartoes = ref<Conta[]>([]);
const contasDebito = ref<Conta[]>([]);
const categorias = ref<Categoria[]>([]);

const cartaoSelecionadoId = ref<string | null>(null);
const contaPagadoraId = ref<string | null>(null);

const carregando = ref(true);
const erro = ref<string | null>(null);

const seletorCartaoAberto = ref(false);
const seletorContaPagadoraAberto = ref(false);

const cartaoSelecionado = computed(() => cartoes.value.find(c => c.id === cartaoSelecionadoId.value) ?? null);
const contaPagadoraSelecionada = computed(() => contasDebito.value.find(c => c.id === contaPagadoraId.value) ?? null);
const semCartoes = computed(() => !carregando.value && !erro.value && cartoes.value.length === 0);

function aplicarListasDeContas(todas: Conta[]): void {
  cartoes.value = todas.filter(c => c.tipo === 'CREDITO');
  contasDebito.value = todas.filter(c => c.tipo === 'DEBITO');
}

/**
 * D4 — porta 1 do recorte (`?contaId=`, vinda de `contas.vue`/EF-02, fora
 * de escopo aqui) com fallback pro primeiro cartão.
 */
function cartaoInicial(lista: Conta[]): Conta | null {
  const idDaRota = typeof rota.query.contaId === 'string' ? rota.query.contaId : null;
  if (idDaRota) {
    const encontrado = lista.find(c => c.id === idDaRota);
    if (encontrado) return encontrado;
  }
  return lista[0] ?? null;
}

async function carregarContasInicial(): Promise<void> {
  const resposta = await listarContas();
  aplicarListasDeContas(resposta.contas);
  cartaoSelecionadoId.value = cartaoInicial(cartoes.value)?.id ?? null;
  contaPagadoraId.value = contasDebito.value[0]?.id ?? null; // D3 — default na primeira
}

/** Refresca só as listas de conta (saldo/limite mudam após pagamento) — não mexe na seleção do usuário. */
async function atualizarContas(): Promise<void> {
  const resposta = await listarContas();
  aplicarListasDeContas(resposta.contas);
}

async function carregarCategorias(): Promise<void> {
  categorias.value = await listarCategorias();
}

// ── A FATURA DO CARTÃO SELECIONADO ───────────────────────────────────────

const dadosFatura = ref<FaturasDoCartao | null>(null);
const erroPagamento = ref<string | null>(null);
const pagando = ref<string | null>(null);

const faturas = computed(() => dadosFatura.value?.faturas ?? []);
/**
 * D1 — `status = 'FECHADA'` é a leitura estreita rejeitada; aqui é só o
 * filtro de EXIBIÇÃO por bloco (D2), a soma "em aberto" já veio pronta em
 * `saldoCentavos`.
 */
const faturasFechadas = computed(() => faturas.value.filter(f => f.status === 'FECHADA'));
const faturaAberta = computed(() => faturas.value.find(f => f.status === 'ABERTA') ?? null);

/** Só quando há EXATAMENTE UMA fatura fechada — ver o FORK no cabeçalho do arquivo. */
const faturaParaBotaoNoCabecalho = computed<Fatura | null>(() =>
  faturasFechadas.value.length === 1 ? (faturasFechadas.value[0] ?? null) : null,
);
/** Com 2+ fechadas, cada bloco precisa do próprio botão mesmo no desktop (o cabeçalho não teria como escolher qual). */
const mostrarBotaoDesktopNoBloco = computed(() => faturasFechadas.value.length !== 1);

interface BlocoDeFatura {
  fatura: Fatura;
  titulo: string;
  subtitulo: string;
  /** D2 — só a(s) fatura(s) FECHADA(S) ganham botão; o ciclo ABERTO só acumula. */
  temBotao: boolean;
}

/**
 * `AAAA-MM-DD` → `DD/MM/AAAA`. Fatiamento de string — nunca `new Date()`
 * (mesmo cuidado de `ModalDetalheLancamento.vue#formatarData`).
 */
function formatarDataIso(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split('-');
  return `${dia}/${mes}/${ano}`;
}

/** D2 — a ordem: a(s) fatura(s) a pagar primeiro, o ciclo corrente por último. */
const blocos = computed<BlocoDeFatura[]>(() => {
  const lista: BlocoDeFatura[] = faturasFechadas.value.map(f => ({
    fatura: f,
    titulo: 'Fatura fechada — aguardando pagamento',
    subtitulo: `Fechou em ${formatarDataIso(f.fechaEm)} · vence em ${formatarDataIso(f.venceEm)}`,
    temBotao: true,
  }));
  if (faturaAberta.value) {
    lista.push({
      fatura: faturaAberta.value,
      titulo: 'Ciclo atual — acumulando',
      subtitulo: `Fecha em ${formatarDataIso(faturaAberta.value.fechaEm)}`,
      temBotao: false,
    });
  }
  return lista;
});

/**
 * Só a leitura MAIS RECENTE grava a tela — mesmo padrão de
 * `extrato.vue`/`orcamento.vue` (troca de cartão pode disparar leituras
 * fora de ordem).
 */
let leituraEmOrdem = 0;

async function carregarFatura(): Promise<void> {
  const id = cartaoSelecionadoId.value;
  if (!id) {
    dadosFatura.value = null;
    return;
  }
  const minhaOrdem = ++leituraEmOrdem;
  const resposta = await listarFaturas(id);
  if (minhaOrdem !== leituraEmOrdem) return;
  dadosFatura.value = resposta;
}

async function carregarInicial(): Promise<void> {
  carregando.value = true;
  try {
    await carregarContasInicial();
    await Promise.all([carregarCategorias(), carregarFatura()]);
    erro.value = null;
  } catch (e) {
    erro.value = mensagemDoErro(e, 'Não consegui carregar as faturas.');
  } finally {
    carregando.value = false;
  }
}

onMounted(carregarInicial);

// Tempo real (EF-00 R2-R5, `composables/useRealtime.ts`): a rota de
// pagamento invalida TRÊS recursos (`api/src/modulos/faturas/rotas.ts`) —
// `faturas` (o pagamento em si) e `contas` (o saldo da pagadora E do
// cartão mudaram, RN-24 é transferência real). Esta tela não lê
// `lancamentos`, então não assina esse terceiro. R3 — nada do evento vira
// estado, só dispara releitura.
useRealtime({
  recursos: ['faturas', 'contas'],
  aoInvalidar: async () => {
    try {
      await Promise.all([atualizarContas(), carregarFatura()]);
      erro.value = null;
    } catch (e) {
      erro.value = mensagemDoErro(e, 'Não consegui atualizar as faturas.');
    }
  },
});

// ── D4 · SELETOR DE CARTÃO ────────────────────────────────────────────────

function alternarSeletorCartao(): void {
  seletorCartaoAberto.value = !seletorCartaoAberto.value;
}
function fecharSeletorCartao(): void {
  seletorCartaoAberto.value = false;
}

async function escolherCartao(id: string): Promise<void> {
  seletorCartaoAberto.value = false;
  if (id === cartaoSelecionadoId.value) return;

  cartaoSelecionadoId.value = id;
  void roteador.replace({ query: { ...rota.query, contaId: id } });

  carregando.value = true;
  erro.value = null;
  try {
    await carregarFatura();
  } catch (e) {
    erro.value = mensagemDoErro(e, 'Não consegui carregar a fatura deste cartão.');
  } finally {
    carregando.value = false;
  }
}

// ── D3 · SELETOR DE CONTA PAGADORA ────────────────────────────────────────

function alternarSeletorContaPagadora(): void {
  seletorContaPagadoraAberto.value = !seletorContaPagadoraAberto.value;
}
function fecharSeletorContaPagadora(): void {
  seletorContaPagadoraAberto.value = false;
}
function escolherContaPagadora(id: string): void {
  contaPagadoraId.value = id;
  seletorContaPagadoraAberto.value = false;
}

// ── PAGAR (RN-24/D3) ──────────────────────────────────────────────────────

async function pagar(fatura: Fatura): Promise<void> {
  if (pagando.value) return;
  const conta = contaPagadoraSelecionada.value;
  if (!conta) {
    erroPagamento.value = 'Escolha uma conta para pagar.';
    return;
  }

  pagando.value = fatura.id;
  erroPagamento.value = null;
  try {
    await pagarFatura(fatura.id, { pagaComContaId: conta.id });
    // Sem recalcular nada aqui (regra inviolável #4): refaz a leitura para
    // pegar o saldo/limite derivados e recomputados no servidor.
    await Promise.all([atualizarContas(), carregarFatura()]);
  } catch (e) {
    // 409 `fatura_sem_valor` chega aqui com a MESMA frase do toast do
    // protótipo ("Não há fatura em aberto nesse cartão.") — nunca um texto
    // inventado (V5, ver cabeçalho do arquivo).
    erroPagamento.value = mensagemDoErro(e, 'Não consegui pagar a fatura.');
  } finally {
    pagando.value = null;
  }
}

// ── CABEÇALHO AZUL (recorte §2/§4) ────────────────────────────────────────

const faturaNomeCartao = computed(() => cartaoSelecionado.value?.nome ?? 'Cartão');
/** RN-25/D1 já implementadas em `saldoCentavos` (EF-02, servidor) — só formatado aqui. */
const faturaTotal = computed(() => formatarCentavos(cartaoSelecionado.value?.saldoCentavos ?? 0));
/**
 * `faturaDatas` do recorte: os dias FIXOS do cartão, não de uma fatura — e
 * o limite livre já vem de `FaturasDoCartao` (RN-26/D1).
 */
const faturaDatas = computed(() => {
  const c = cartaoSelecionado.value;
  if (!c) return '';
  const limiteLivre = dadosFatura.value?.limiteLivreCentavos;
  const limiteLivreTexto = limiteLivre != null ? formatarCentavos(limiteLivre) : '—';
  return `Fecha dia ${c.diaFechamento} · vence dia ${c.diaVencimento} · limite livre ${limiteLivreTexto}`;
});

/** D3 — o rótulo nomeia a conta escolhida; nunca "conta corrente" fixo. */
function rotuloBotao(curto: boolean): string {
  const nome = contaPagadoraSelecionada.value?.nome ?? 'conta';
  return curto ? `Pagar pela ${nome}` : `Pagar fatura pela ${nome}`;
}

// ── ITENS (recorte §4 — mesmo `mapLanc`, ver divergência no cabeçalho) ───

function categoriaDoItem(item: ItemDeFatura): Categoria | null {
  return item.categoriaId ? (categorias.value.find(c => c.id === item.categoriaId) ?? null) : null;
}
function iconeDoItem(item: ItemDeFatura): string {
  const categoria = categoriaDoItem(item);
  return categoria ? classeDoIconeCategoria(categoria.icone) : 'ti-receipt';
}
function corDoItem(item: ItemDeFatura): string {
  return categoriaDoItem(item)?.cor ?? 'var(--tinta)';
}
function subDoItem(item: ItemDeFatura): string {
  const partes = [categoriaDoItem(item)?.nome ?? 'Sem categoria'];
  if (item.numeroParcela && item.quantidadeParcelas) {
    partes.push(`parcela ${item.numeroParcela}/${item.quantidadeParcelas}`);
  }
  return partes.join(' · ');
}
function itensOrdenados(fatura: Fatura): ItemDeFatura[] {
  return [...fatura.itens].sort((a, b) => b.data.localeCompare(a.data));
}
</script>

<template>
  <section class="faturas">
    <p v-if="carregando" class="faturas__vazio">Carregando…</p>
    <p v-else-if="erro" class="faturas__vazio faturas__vazio--erro" role="alert">{{ erro }}</p>
    <p v-else-if="semCartoes" class="faturas__vazio">Nenhum cartão de crédito cadastrado ainda.</p>

    <template v-else-if="cartaoSelecionado">
      <!-- ── BREADCRUMB — só mobile (recorte §2: "‹ Contas") ────────────── -->
      <NuxtLink to="/contas" class="faturas__breadcrumb">‹ Contas</NuxtLink>

      <!-- ── D4 · SELETOR DE CARTÃO — só com 2+ cartões ─────────────────── -->
      <div v-if="cartoes.length > 1" class="faturas__seletor-container">
        <button type="button" class="faturas__seletor" @click="alternarSeletorCartao">
          <span class="faturas__seletor-quadrado" :style="{ background: cartaoSelecionado?.cor ?? 'var(--tinta)' }">
            <i class="ti" :class="cartaoSelecionado ? classeDoIcone(cartaoSelecionado.icone) : 'ti-credit-card'"></i>
          </span>
          <span class="faturas__seletor-texto">
            <span class="faturas__seletor-rotulo">CARTÃO</span>
            <span class="faturas__seletor-valor">{{ cartaoSelecionado?.nome ?? '' }}</span>
          </span>
          <i class="ti ti-chevron-down faturas__seletor-seta"></i>
        </button>

        <template v-if="seletorCartaoAberto">
          <div class="faturas__seletor-backdrop" @click="fecharSeletorCartao"></div>
          <div class="faturas__seletor-painel">
            <button
              v-for="c in cartoes"
              :key="c.id"
              type="button"
              class="linha linha--botao"
              @click="escolherCartao(c.id)"
            >
              <span class="linha__icone" :style="{ background: c.cor }">
                <i class="ti" :class="classeDoIcone(c.icone)"></i>
              </span>
              <span class="linha__texto">
                <span class="linha__titulo">{{ c.nome }}</span>
              </span>
              <i v-if="c.id === cartaoSelecionadoId" class="ti ti-check faturas__seletor-check"></i>
            </button>
          </div>
        </template>
      </div>

      <!-- ── CABEÇALHO AZUL (recorte §2/§3) ──────────────────────────────── -->
      <div class="faturas__cabecalho">
        <div class="faturas__cabecalho-texto">
          <span class="faturas__cabecalho-nome">{{ faturaNomeCartao }}</span>
          <span class="faturas__cabecalho-total">{{ faturaTotal }}</span>
          <span class="faturas__cabecalho-datas">{{ faturaDatas }}</span>
        </div>

        <!-- Só desktop, e só quando há UMA fatura fechada — ver o FORK no cabeçalho do arquivo. -->
        <button
          v-if="faturaParaBotaoNoCabecalho"
          type="button"
          class="faturas__botao-cabecalho"
          :disabled="pagando === faturaParaBotaoNoCabecalho.id"
          @click="pagar(faturaParaBotaoNoCabecalho)"
        >
          {{ pagando === faturaParaBotaoNoCabecalho.id ? 'Pagando…' : rotuloBotao(true) }}
        </button>
      </div>

      <!-- ── O AVISO (EF-05 §3 — texto literal) ──────────────────────────── -->
      <p class="faturas__aviso">
        Cada compra no crédito já saiu da categoria. O saldo da conta só muda quando a fatura é paga.
      </p>

      <!-- ── D3 · SELETOR DE CONTA PAGADORA — só quando há algo a pagar ──── -->
      <div v-if="faturasFechadas.length > 0" class="faturas__seletor-container">
        <button type="button" class="faturas__seletor" @click="alternarSeletorContaPagadora">
          <span class="faturas__seletor-quadrado" :style="{ background: contaPagadoraSelecionada?.cor ?? 'var(--tinta)' }">
            <i class="ti" :class="contaPagadoraSelecionada ? classeDoIcone(contaPagadoraSelecionada.icone) : 'ti-wallet'"></i>
          </span>
          <span class="faturas__seletor-texto">
            <span class="faturas__seletor-rotulo">PAGAR COM</span>
            <span class="faturas__seletor-valor">{{ contaPagadoraSelecionada?.nome ?? 'Escolha uma conta' }}</span>
          </span>
          <i class="ti ti-chevron-down faturas__seletor-seta"></i>
        </button>

        <template v-if="seletorContaPagadoraAberto">
          <div class="faturas__seletor-backdrop" @click="fecharSeletorContaPagadora"></div>
          <div class="faturas__seletor-painel">
            <button
              v-for="c in contasDebito"
              :key="c.id"
              type="button"
              class="linha linha--botao"
              @click="escolherContaPagadora(c.id)"
            >
              <span class="linha__icone" :style="{ background: c.cor }">
                <i class="ti" :class="classeDoIcone(c.icone)"></i>
              </span>
              <span class="linha__texto">
                <span class="linha__titulo">{{ c.nome }}</span>
              </span>
              <i v-if="c.id === contaPagadoraId" class="ti ti-check faturas__seletor-check"></i>
            </button>
          </div>
        </template>
      </div>

      <p v-if="erroPagamento" class="faturas__erro-pagamento" role="alert">{{ erroPagamento }}</p>

      <!-- ── D2 · OS DOIS BLOCOS ──────────────────────────────────────────── -->
      <div v-for="bloco in blocos" :key="bloco.fatura.id" class="faturas__bloco">
        <div class="faturas__bloco-cabecalho">
          <span class="faturas__bloco-titulo">{{ bloco.titulo }}</span>
          <span class="faturas__bloco-subtitulo">{{ bloco.subtitulo }}</span>
          <span class="faturas__bloco-total">{{ formatarCentavos(-bloco.fatura.totalCentavos) }}</span>
        </div>

        <p v-if="bloco.fatura.itens.length === 0" class="faturas__vazio">Nenhum lançamento neste ciclo ainda.</p>

        <!-- As duas variantes SEMPRE renderizam juntas; é o CSS quem escolhe
             qual aparece por largura (mesmo padrão SSR-safe da sidebar/tab
             bar do shell, `layouts/default.vue`) — nunca `window.innerWidth`. -->
        <template v-else>
          <!-- MOBILE — cards soltos (recorte §2.4) -->
          <div class="faturas__itens faturas__itens--mobile">
            <div v-for="item in itensOrdenados(bloco.fatura)" :key="item.id" class="faturas__item-cartao">
              <span class="faturas__item-icone" :style="{ background: corDoItem(item) }">
                <i class="ti" :class="iconeDoItem(item)"></i>
              </span>
              <span class="faturas__item-texto">
                <span class="faturas__item-desc">{{ item.descricao }}</span>
                <span class="faturas__item-sub">{{ subDoItem(item) }}</span>
              </span>
              <span class="faturas__item-valor">{{ formatarCentavos(-item.valorCentavos) }}</span>
            </div>
          </div>

          <!-- DESKTOP — tabela num card só (recorte §3: reaproveita `.lista`/`.linha`) -->
          <div class="lista faturas__itens faturas__itens--desktop">
            <div v-for="item in itensOrdenados(bloco.fatura)" :key="item.id" class="linha faturas__item-desktop">
              <span class="linha__icone" :style="{ background: corDoItem(item) }">
                <i class="ti" :class="iconeDoItem(item)"></i>
              </span>
              <span class="linha__texto">
                <span class="linha__titulo">{{ item.descricao }}</span>
                <span class="linha__sub">{{ subDoItem(item) }}</span>
              </span>
              <span class="faturas__item-valor">{{ formatarCentavos(-item.valorCentavos) }}</span>
            </div>
          </div>
        </template>

        <!-- Botão do bloco — mobile sempre (o cabeçalho não tem botão lá);
             desktop só quando o cabeçalho não cobre esta fatura (2+ fechadas, ver o FORK). -->
        <button
          v-if="bloco.temBotao"
          type="button"
          class="botao faturas__botao-bloco faturas__botao-bloco--mobile"
          :disabled="pagando === bloco.fatura.id"
          @click="pagar(bloco.fatura)"
        >
          {{ pagando === bloco.fatura.id ? 'Pagando…' : rotuloBotao(false) }}
        </button>
        <button
          v-if="bloco.temBotao && mostrarBotaoDesktopNoBloco"
          type="button"
          class="botao faturas__botao-bloco faturas__botao-bloco--desktop"
          :disabled="pagando === bloco.fatura.id"
          @click="pagar(bloco.fatura)"
        >
          {{ pagando === bloco.fatura.id ? 'Pagando…' : rotuloBotao(true) }}
        </button>
      </div>
    </template>
  </section>
</template>

<style lang="scss" src="~/assets/scss/pages/faturas.scss" scoped></style>
