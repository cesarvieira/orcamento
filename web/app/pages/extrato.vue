<script setup lang="ts">
/**
 * EXTRATO (EF-04) — a tela `extrato` do mockup. Recorte em
 * `.preator/tmp/recorte-desenho-18.md` §5 (não commitado, artefato do condutor) —
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
 *
 * ═══════════════════════════════════════════════════════════════════════
 * O SALDO ACUMULADO — 🟨 regra NOVA, fora do desenho (2026-09-03):
 * ═══════════════════════════════════════════════════════════════════════
 *
 * 6. SALDO DE FECHAMENTO POR DIA, no cabeçalho do dia, à direita. Não está
 *    no mockup: nasceu do pedido de conferir o extrato contra o do banco.
 *    O número é DERIVADO NO SERVIDOR (`saldosPorDia`, de
 *    `api/src/modulos/lancamentos/servico.ts#saldosPorDiaDoExtrato`) — as
 *    três decisões do humano (o que "todas as contas" soma, o que ele
 *    significa num cartão, e que é fechamento do dia) estão registradas lá,
 *    não aqui. Esta tela só indexa por dia e formata: somar `valorCentavos`
 *    para chegar no saldo seria a segunda fonte da verdade que a regra
 *    inviolável #4 proíbe.
 *
 * 7. A TRANSFERÊNCIA QUE ENTRA passou a aparecer no extrato filtrado. O
 *    filtro por conta olhava só `contaId` (a origem), então o extrato de uma
 *    RESERVA vinha sempre vazio e o de um CARTÃO escondia o pagamento da
 *    fatura. Corrigido no serviço, porque sem isso o acumulado não fecharia
 *    com `saldoCentavos` da conta. Consequências nesta tela, ambas
 *    dependentes de haver uma conta escolhida:
 *    - `subDoLancamento` diz "Transferência DE X" quando a conta filtrada é
 *      o destino, e "para X" quando é a origem;
 *    - `valorComSinal` dá sinal à transferência (entrada +, saída −). SEM
 *      filtro ela continua sem sinal, como RN-17 sempre mandou: para a
 *      família não é gasto nem ganho, e o acumulado não se move com ela.
 */
import type { Categoria, Conta, Lancamento } from '@orcamento/contrato';
import { classeDoIcone, useContas } from '~/composables/useContas';
import { useExtratoLeitura } from '~/composables/useExtratoLeitura';
import { TIPOS_LANCAMENTO, corDoTipo, useDetalheLancamento, useLancamentos } from '~/composables/useLancamentos';
import { classeDoIconeCategoria } from '~/composables/useOrcamento';
import { MESES_DO_ANO, partesDaCompetencia } from '~/utils/competencia';
import { formatarCentavos } from '~/utils/dinheiro';

const { competencia } = useCompetencia();
const { abrir: abrirDetalhe } = useDetalheLancamento();
const { listarContas } = useContas();

const categorias = ref<Categoria[]>([]);
const contas = ref<Conta[]>([]);

const contaFiltroId = ref<string | null>(null);
const filtroAberto = ref(false);

const { listarLancamentos, listarCategorias } = useLancamentos({
  competenciaAtiva: computed(() => competencia.value),
  aoInvalidar: async () => {
    await carregar();
  },
});

/**
 * O guarda de corrida (`leituraEmOrdem`/`minhaOrdem`, mesmo padrão de
 * `orcamento.vue`) — inclusive para `verificarSeFamiliaTemHistorico` (#105) —
 * vive dentro do composable, testado sem montar a SFC em
 * `useExtratoLeitura.teste.ts`.
 */
const {
  lancamentos,
  saldosPorDia,
  carregando,
  erro,
  familiaSemHistorico,
  carregar: carregarLeitura,
} = useExtratoLeitura({ listar: listarLancamentos });

/**
 * O custo extra de listar SEM filtro (dentro do composable, só no caminho
 * vazio) fica de fora daqui — esta função só passa os parâmetros do FILTRO
 * ATUAL da tela. Ver ponto 4 do cabeçalho.
 */
async function carregar(): Promise<void> {
  await carregarLeitura({
    competencia: competencia.value,
    ...(contaFiltroId.value ? { contaId: contaFiltroId.value } : {}),
  });
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
  /**
   * O saldo de FECHAMENTO do dia (ponto 6 do cabeçalho). `null` só no caso
   * degenerado de um dia listado sem saldo correspondente — o servidor deriva
   * os dois do mesmo filtro, então na prática não acontece; o template
   * simplesmente não desenha o número em vez de mostrar um zero mentiroso.
   */
  saldoCentavos: number | null;
}

/** `AAAA-MM-DD` → "20 de agosto". Fatiamento de string — nunca `new Date()` (ver ponto 2 do cabeçalho). */
function rotuloDoDia(dataIso: string): string {
  const [, mesStr, diaStr] = dataIso.split('-');
  const nomeDoMes = MESES_DO_ANO[Number(mesStr) - 1] ?? mesStr ?? '';
  return `${diaStr ?? ''} de ${nomeDoMes.toLowerCase()}`;
}

/**
 * `data` → saldo de fechamento. Um índice, não um cálculo: o número já vem
 * derivado do servidor (`saldosPorDia`), esta tela só o encontra pelo dia.
 */
const saldoPorData = computed(
  () => new Map(saldosPorDia.value.map(s => [s.data, s.saldoCentavos])),
);

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
      saldoCentavos: saldoPorData.value.get(data) ?? null,
    }));
});

// ── A LINHA DE LANÇAMENTO (recorte §5.5, ver ponto 3/5 do cabeçalho) ─────

function categoriaDoLancamento(l: Lancamento): Categoria | null {
  return l.categoriaId ? (categorias.value.find(c => c.id === l.categoriaId) ?? null) : null;
}
function contaDestinoDoLancamento(l: Lancamento): Conta | null {
  return l.contaDestinoId ? (contas.value.find(c => c.id === l.contaDestinoId) ?? null) : null;
}
function contaOrigemDoLancamento(l: Lancamento): Conta | null {
  return contas.value.find(c => c.id === l.contaId) ?? null;
}

/**
 * A conta filtrada é o DESTINO desta transferência — ou seja, o dinheiro
 * ENTROU nela. Só faz sentido com um filtro ativo: sem filtro não há de que
 * ponta olhar (ver ponto 7 do cabeçalho).
 */
function ehEntradaNaContaFiltrada(l: Lancamento): boolean {
  return (
    l.tipo === 'TRANSFERENCIA' &&
    contaFiltroId.value !== null &&
    l.contaDestinoId === contaFiltroId.value
  );
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
  // "para X" ou "de X" conforme a ponta que a tela está olhando — antes o
  // extrato filtrado nem mostrava a transferência que ENTRA, e o texto só
  // precisava da saída (ver ponto 7 do cabeçalho).
  if (ehEntradaNaContaFiltrada(l)) {
    const origem = contaOrigemDoLancamento(l);
    return origem ? `Transferência de ${origem.nome}` : 'Transferência recebida';
  }
  const destino = contaDestinoDoLancamento(l);
  return destino ? `Transferência para ${destino.nome}` : 'Transferência';
}

/**
 * DESPESA aparece negativa, RECEITA positiva.
 *
 * TRANSFERÊNCIA depende de haver uma conta escolhida (ponto 7 do cabeçalho):
 * - SEM filtro, continua sem sinal, como sempre foi — RN-17: transferência
 *   não é gasto nem ganho, e para a família o dinheiro só mudou de bolso (o
 *   acumulado do dia, aliás, não se move com ela).
 * - COM filtro, ganha o sinal DAQUELA conta: saída negativa, entrada
 *   positiva. Não é regra nova, é a mesma de `expressaoSaldoDerivado`
 *   (EF-02 §1) — e sem isso a linha diria "+R$ 500,00" ao lado de um saldo do
 *   dia que acabou de cair R$ 500,00.
 */
function valorComSinal(l: Lancamento): number {
  if (l.tipo === 'DESPESA') return -l.valorCentavos;
  if (l.tipo === 'TRANSFERENCIA' && contaFiltroId.value) {
    return ehEntradaNaContaFiltrada(l) ? l.valorCentavos : -l.valorCentavos;
  }
  return l.valorCentavos;
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
          <button type="button" class="linha linha--botao" @click="escolherConta(null)">
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
            class="linha linha--botao"
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
        <!--
          ── O CABEÇALHO DO DIA + O SALDO DE FECHAMENTO ─────────────────────
          O número vem pronto de `saldosPorDia` (servidor). Fica na mesma
          linha do dia, à direita, porque é assim que se confere: passando o
          olho por uma coluna, contra o extrato do banco.
        -->
        <div class="extrato__dia-cabecalho">
          <p class="extrato__dia-rotulo">{{ grupo.rotulo }}</p>
          <p v-if="grupo.saldoCentavos !== null" class="extrato__dia-saldo">
            <span class="extrato__dia-saldo-rotulo">saldo</span>
            <span :class="{ 'extrato__dia-saldo-valor--negativo': grupo.saldoCentavos < 0 }">
              {{ formatarCentavos(grupo.saldoCentavos) }}
            </span>
          </p>
        </div>
        <div class="lista">
          <button
            v-for="l in grupo.itens"
            :key="l.id"
            type="button"
            class="linha linha--botao extrato__linha"
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
