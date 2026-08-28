<script setup lang="ts">
/**
 * EXTRATO (EF-04) — a tela `extrato` do mockup. Recorte em
 * `.motor/recorte-desenho-18.md` §5 (não commitado, artefato do condutor) —
 * é FONTE, não ilustração. 🟦 é desenho; 🟨 é anotação do condutor ou decisão
 * do humano.
 *
 * Esta tela só LÊ e FORMATA `Lancamento` — nunca recalcula gasto, teto ou
 * disponível (regra inviolável #4). O modal de detalhe (`useDetalheLancamento`)
 * e a folha de novo lançamento são globais, montados em `layouts/default.vue`
 * pela tarefa #53; esta tela só os ABRE.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * ONDE ESTA TELA DIVERGE DO RECORTE, E POR QUÊ:
 * ═══════════════════════════════════════════════════════════════════════
 *
 * 1. TÍTULO "Extrato" — não duplicado: já vem do shell (`topo__titulo`, via
 *    `config/navegacao.ts`), mesmo padrão de `contas.vue`/`orcamento.vue`.
 *    O subtítulo (`extratoResumo`, recorte §5.1) reaproveita a MESMA cópia
 *    que `config/navegacao.ts` já usa para descrever esta tela em `/mais`
 *    ("lançamentos por dia, com filtro por conta") quando não há contagem
 *    ainda para mostrar, e vira "N lançamentos em <mês>" quando há.
 *
 * 2. `d.label` (recorte §5.4, o cabeçalho de cada dia) — o mockup não dá o
 *    texto literal, só a anatomia. Construído como "20 de agosto" (fatiado
 *    da string `AAAA-MM-DD`, nunca `new Date()` — mesmo cuidado de
 *    `ModalDetalheLancamento.vue#formatarData`, que evita o desvio de fuso
 *    de interpretar a data como UTC).
 *
 * 3. `e.sub` (recorte §5.5) — o mockup não dá o conteúdo, só que existe.
 *    Aqui é a categoria (DESPESA), "Receita" (RECEITA) ou "Transferência
 *    para X" (TRANSFERENCIA) — resolvidos a partir de `categoriaId`/
 *    `contaDestinoId`, os únicos dados que `Lancamento` de fato carrega.
 *
 * 4. OS DOIS VAZIOS (recorte §5.3, §6.2) — o desenho só cobre "nenhum
 *    lançamento NESSA CONTA em agosto" (vazio por filtro/mês).  O vazio de
 *    FAMÍLIA NOVA (nenhum lançamento em lugar nenhum) não tem texto no
 *    desenho — `textoVazio` abaixo usa uma frase própria para esse caso,
 *    marcada como tal. Para distinguir os dois sem um endpoint dedicado,
 *    quando a leitura filtrada vem vazia esta tela faz UMA segunda chamada
 *    sem filtro (`verificarSeFamiliaTemHistorico`) — só nesse caminho, não
 *    no caminho comum.
 *
 * 5. `{{ c.corBarra }}`/`e.cor`/`e.icone` — para RECEITA/TRANSFERENCIA (sem
 *    categoria) usa a cor/ícone do TIPO (`TIPOS_LANCAMENTO`, mesma fonte
 *    que a folha de lançamento já usa); para DESPESA, a cor/ícone da
 *    categoria.
 */
import type { Categoria, Conta, Lancamento } from '@orcamento/contrato';
import { classeDoIcone, useContas } from '~/composables/useContas';
import { TIPOS_LANCAMENTO, corDoTipo, useDetalheLancamento, useLancamentos } from '~/composables/useLancamentos';
import { classeDoIconeCategoria } from '~/composables/useOrcamento';
import { MESES_DO_ANO, partesDaCompetencia } from '~/utils/competencia';
import { formatarCentavos } from '~/utils/dinheiro';

const { competencia } = useCompetencia();
const { abrir: abrirDetalhe } = useDetalheLancamento();
const { listarContas } = useContas();

const lancamentos = ref<Lancamento[]>([]);
const categorias = ref<Categoria[]>([]);
const contas = ref<Conta[]>([]);

const carregando = ref(true);
const erro = ref<string | null>(null);
/** Distingue o vazio "por filtro/mês" (tem fonte) do vazio "família nova" (não tem) — ver ponto 4 do cabeçalho. */
const familiaSemHistorico = ref(false);

const contaFiltroId = ref<string | null>(null);
const filtroAberto = ref(false);

const { listarLancamentos, listarCategorias } = useLancamentos({
  competenciaAtiva: computed(() => competencia.value),
  aoInvalidar: async () => {
    await carregar();
  },
});

/** Só a leitura MAIS RECENTE grava a tela — mesmo padrão de `orcamento.vue`. */
let leituraEmOrdem = 0;

async function carregar(): Promise<void> {
  const minhaOrdem = ++leituraEmOrdem;
  try {
    const resposta = await listarLancamentos({
      competencia: competencia.value,
      ...(contaFiltroId.value ? { contaId: contaFiltroId.value } : {}),
    });
    if (minhaOrdem !== leituraEmOrdem) return;

    lancamentos.value = resposta.lancamentos;
    erro.value = null;

    if (resposta.lancamentos.length === 0) {
      await verificarSeFamiliaTemHistorico();
    } else {
      familiaSemHistorico.value = false;
    }
  } catch (e) {
    if (minhaOrdem !== leituraEmOrdem) return;
    erro.value = mensagemDoErro(e, 'Não consegui carregar o extrato.');
  } finally {
    if (minhaOrdem === leituraEmOrdem) carregando.value = false;
  }
}

/**
 * Chamada só quando a leitura filtrada (competência + conta) veio vazia —
 * o custo extra de listar SEM filtro fica só no caminho vazio, não no
 * caminho comum. Ver ponto 4 do cabeçalho.
 */
async function verificarSeFamiliaTemHistorico(): Promise<void> {
  try {
    const resposta = await listarLancamentos({});
    familiaSemHistorico.value = resposta.lancamentos.length === 0;
  } catch {
    // Na dúvida, mostra o vazio "por filtro" — tem fonte no desenho, o outro não.
    familiaSemHistorico.value = false;
  }
}

async function carregarApoio(): Promise<void> {
  const [listaCategorias, respostaContas] = await Promise.all([listarCategorias(), listarContas()]);
  categorias.value = listaCategorias;
  contas.value = respostaContas.contas;
}

onMounted(() => {
  void carregar();
  void carregarApoio();
});

watch(competencia, () => {
  carregando.value = true;
  void carregar();
});

// ── FILTRO POR CONTA (recorte §5.2) ──────────────────────────────────────

const contaFiltroSelecionada = computed(() => contas.value.find(c => c.id === contaFiltroId.value) ?? null);
const filtroLabel = computed(() => contaFiltroSelecionada.value?.nome ?? 'Todas as contas');

function alternarFiltro(): void {
  filtroAberto.value = !filtroAberto.value;
}
function fecharFiltro(): void {
  filtroAberto.value = false;
}
function escolherConta(id: string | null): void {
  contaFiltroId.value = id;
  filtroAberto.value = false;
  carregando.value = true;
  void carregar();
}

// ── RESUMO E OS DOIS VAZIOS (ver pontos 1 e 4 do cabeçalho) ──────────────

const mesAtivoMinusculo = computed(() => {
  const { mes } = partesDaCompetencia(competencia.value);
  return (MESES_DO_ANO[mes - 1] ?? '').toLowerCase();
});

const extratoResumo = computed(() => {
  const n = lancamentos.value.length;
  if (n === 0) return 'lançamentos por dia, com filtro por conta';
  return `${n} ${n === 1 ? 'lançamento' : 'lançamentos'} em ${mesAtivoMinusculo.value}`;
});

/** 🟦 fonte quando por filtro/mês (recorte §5.3); 🟨 texto próprio quando família nova (ver ponto 4). */
const textoVazio = computed(() => {
  if (familiaSemHistorico.value) {
    return 'Nenhum lançamento ainda. Toque em "+" para registrar o primeiro.';
  }
  const trechoConta = contaFiltroSelecionada.value ? ' nessa conta' : '';
  return `Nenhum lançamento${trechoConta} em ${mesAtivoMinusculo.value}.`;
});

// ── AGRUPAMENTO POR DIA (recorte §5.4) ───────────────────────────────────

interface GrupoDoDia {
  data: string;
  rotulo: string;
  itens: Lancamento[];
}

/** `AAAA-MM-DD` → "20 de agosto". Fatiamento de string — nunca `new Date()` (ver ponto 2 do cabeçalho). */
function rotuloDoDia(dataIso: string): string {
  const [, mesStr, diaStr] = dataIso.split('-');
  const nomeDoMes = MESES_DO_ANO[Number(mesStr) - 1] ?? mesStr ?? '';
  return `${diaStr ?? ''} de ${nomeDoMes.toLowerCase()}`;
}

const grupos = computed<GrupoDoDia[]>(() => {
  const porDia = new Map<string, Lancamento[]>();
  for (const l of lancamentos.value) {
    const lista = porDia.get(l.data) ?? [];
    lista.push(l);
    porDia.set(l.data, lista);
  }
  return [...porDia.entries()]
    .sort(([dataA], [dataB]) => (dataA < dataB ? 1 : -1)) // dia mais recente primeiro
    .map(([data, itens]) => ({
      data,
      rotulo: rotuloDoDia(data),
      itens: [...itens].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)),
    }));
});

// ── A LINHA DE LANÇAMENTO (recorte §5.5, ver ponto 3/5 do cabeçalho) ─────

function categoriaDoLancamento(l: Lancamento): Categoria | null {
  return l.categoriaId ? (categorias.value.find(c => c.id === l.categoriaId) ?? null) : null;
}
function contaDestinoDoLancamento(l: Lancamento): Conta | null {
  return l.contaDestinoId ? (contas.value.find(c => c.id === l.contaDestinoId) ?? null) : null;
}

function corDoLancamento(l: Lancamento): string {
  if (l.tipo === 'DESPESA') return categoriaDoLancamento(l)?.cor ?? corDoTipo(l.tipo);
  return corDoTipo(l.tipo);
}
function iconeDoLancamento(l: Lancamento): string {
  if (l.tipo === 'DESPESA') {
    const categoria = categoriaDoLancamento(l);
    if (categoria) return classeDoIconeCategoria(categoria.icone);
  }
  return TIPOS_LANCAMENTO.find(t => t.valor === l.tipo)?.icone ?? 'ti-receipt';
}
function subDoLancamento(l: Lancamento): string {
  if (l.tipo === 'DESPESA') return categoriaDoLancamento(l)?.nome ?? 'Despesa';
  if (l.tipo === 'RECEITA') return 'Receita';
  const destino = contaDestinoDoLancamento(l);
  return destino ? `Transferência para ${destino.nome}` : 'Transferência';
}
/** DESPESA aparece negativa, RECEITA positiva; TRANSFERÊNCIA não é gasto nem ganho (RN-17) — sem sinal. */
function valorComSinal(l: Lancamento): number {
  return l.tipo === 'DESPESA' ? -l.valorCentavos : l.valorCentavos;
}
</script>

<template>
  <section class="extrato">
    <p class="extrato__subtitulo">{{ extratoResumo }}</p>

    <!-- ── FILTRO POR CONTA (recorte §5.2) ──────────────────────────────── -->
    <div class="extrato__filtro-container">
      <button type="button" class="extrato__filtro" @click="alternarFiltro">
        <span
          class="extrato__filtro-quadrado"
          :style="{ background: contaFiltroSelecionada?.cor ?? 'var(--tinta)' }"
        >
          <i class="ti" :class="contaFiltroSelecionada ? classeDoIcone(contaFiltroSelecionada.icone) : 'ti-list-details'"></i>
        </span>
        <span class="extrato__filtro-texto">
          <span class="extrato__filtro-rotulo">CONTA</span>
          <span class="extrato__filtro-valor">{{ filtroLabel }}</span>
        </span>
        <i class="ti ti-chevron-down extrato__filtro-seta"></i>
      </button>

      <template v-if="filtroAberto">
        <div class="extrato__filtro-backdrop" @click="fecharFiltro"></div>
        <div class="extrato__filtro-painel">
          <button type="button" class="linha extrato__filtro-item" @click="escolherConta(null)">
            <span class="linha__icone"><i class="ti ti-list-details"></i></span>
            <span class="linha__texto">
              <span class="linha__titulo">Todas as contas</span>
            </span>
            <i v-if="!contaFiltroId" class="ti ti-check extrato__check"></i>
          </button>
          <button
            v-for="c in contas"
            :key="c.id"
            type="button"
            class="linha extrato__filtro-item"
            @click="escolherConta(c.id)"
          >
            <span class="linha__icone" :style="{ background: c.cor }">
              <i class="ti" :class="classeDoIcone(c.icone)"></i>
            </span>
            <span class="linha__texto">
              <span class="linha__titulo">{{ c.nome }}</span>
            </span>
            <i v-if="c.id === contaFiltroId" class="ti ti-check extrato__check"></i>
          </button>
        </div>
      </template>
    </div>

    <!-- ── CORPO — carregando · erro · vazio (dois casos) · dias ─────────── -->
    <p v-if="carregando" class="extrato__vazio">Carregando…</p>
    <p v-else-if="erro" class="extrato__vazio extrato__vazio--erro" role="alert">{{ erro }}</p>
    <p v-else-if="lancamentos.length === 0" class="extrato__vazio">{{ textoVazio }}</p>

    <div v-else class="extrato__dias">
      <div v-for="grupo in grupos" :key="grupo.data" class="extrato__dia">
        <p class="extrato__dia-rotulo">{{ grupo.rotulo }}</p>
        <div class="lista">
          <button
            v-for="l in grupo.itens"
            :key="l.id"
            type="button"
            class="linha extrato__linha"
            @click="abrirDetalhe(l)"
          >
            <span class="linha__icone" :style="{ background: corDoLancamento(l) }">
              <i class="ti" :class="iconeDoLancamento(l)"></i>
            </span>
            <span class="linha__texto">
              <span class="linha__titulo extrato__desc">{{ l.descricao }}</span>
              <span class="linha__sub">{{ subDoLancamento(l) }}</span>
            </span>
            <span class="extrato__valor" :style="{ color: corDoTipo(l.tipo) }">
              {{ formatarCentavos(valorComSinal(l)) }}
            </span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss" src="~/assets/scss/pages/extrato.scss" scoped></style>
