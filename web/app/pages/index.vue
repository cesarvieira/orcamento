<script setup lang="ts">
/**
 * VISÃO DO MÊS (EF-04) — a tela `home` do mockup. Recorte em
 * `.preator/tmp/recorte-desenho-18.md` §4 (não commitado, artefato do condutor) —
 * é FONTE, não ilustração. O LASTRO (EF-06, #20) tem recorte próprio,
 * `recorte-desenho-20.md`, também na raiz do worktree — citado nos pontos 2,
 * 4 e 5 abaixo, que esta tarefa (#77) fecha. 🟦 é desenho; 🟨 é anotação do
 * condutor ou decisão do humano.
 *
 * `recebidoCentavos`, `naoAlocadoCentavos`, `lastroCentavos`,
 * `deficitCentavos`, `liberadoTotalCentavos` e, por categoria,
 * `tetoCentavos`/`gastoCentavos`/`disponivelCentavos`/`liberadoCentavos`/
 * `bloqueadoCentavos` são DERIVADOS pelo servidor (mesma leitura que
 * `orcamento.vue` já consome, `useOrcamento().lerCompetencia`) — esta tela só
 * formata para exibir, nunca recalcula (regra inviolável #4 do projeto).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * ONDE ESTA TELA DIVERGE DO RECORTE, E POR QUÊ — tudo declarado, nada
 * inventado em silêncio (recorte-desenho-18.md §6; recorte-desenho-20.md §5):
 * ═══════════════════════════════════════════════════════════════════════
 *
 * 1. CABEÇALHO DE MÊS E A PÍLULA "A + B" (recorte-desenho-18.md §4.1) — não
 *    duplicados aqui. O seletor de mês já é global (`layouts/default.vue`,
 *    `.mes`), porque EF-03/EF-04/EF-08 leem a MESMA competência (mesmo
 *    raciocínio já registrado em `orcamento.vue`) — o recorte lê o mockup
 *    isolado e por isso anota o seletor como "da própria home"; o código já
 *    divergiu disso antes desta tarefa, e repetir o cabeçalho aqui criaria
 *    DOIS controles de mês na mesma tela. A pílula de iniciais da família
 *    ("A + B" no mockup) não tem fonte de dado nem precedente no app (a
 *    sidebar mostra o NOME da família, não iniciais) — omitida, não
 *    inventada. Segue sem fonte de dado (recorte-desenho-20.md §5.4).
 *
 * 2. O NÚMERO DOMINANTE DO CARTÃO-HERÓI (recorte-desenho-20.md §3, RN-30) —
 *    FECHADO por esta tarefa. É `liberadoTotalCentavos`
 *    (`Math.max(0, restanteTotal − déficit)`, calculado e derivado no
 *    servidor, EF-06 §2), sob o rótulo do desenho, "Liberado até o fim do
 *    mês". Nada é somado, subtraído ou ratado aqui — o número chega pronto
 *    de `CompetenciaLida` (regra inviolável #4).
 *
 * 3. `{{ alocLabel }}` (recorte-desenho-18.md §4.2/§6.5) é dinâmico no
 *    mockup; o condutor não localizou a regra que o alterna. Continua fixo
 *    em "NÃO ALOCADO" — vazio declarado de novo em recorte-desenho-20.md
 *    §5.3. Se precisar variar, é fork, não invenção.
 *
 * 4. FAIXA DE BLOQUEIO (recorte-desenho-20.md §1) — FECHADA por esta
 *    tarefa. Aparece entre o cartão-herói e o cabeçalho "Categorias" quando
 *    `deficitCentavos > 0` — este app não tem uma faixa de estouro GLOBAL
 *    separada (ver ponto 6: aqui o estouro é por categoria, dentro da
 *    lista), então esta é a posição equivalente à do mockup ("entre a faixa
 *    de estouro e 'Categorias'"). O texto da explicação é a variante
 *    DESKTOP, por decisão do humano (2026-08-29, recorte-desenho-20.md
 *    §1/§5.1): "lastro" e "reserva" são termos do produto, "poupança" não
 *    é — a variante mobile foi descartada, não esquecida, e não há split
 *    responsivo de texto nesta tela.
 *
 * 5. BARRA DE DUAS FAIXAS + BLOQUEIO POR CATEGORIA (recorte-desenho-20.md
 *    §2) — FECHADO por esta tarefa.
 *    - a linha "«valor» bloqueado por falta de lastro" aparece sob
 *      `c.gastoLabel` quando `c.bloqueadoCentavos > 0` — posição do recorte
 *      MOBILE; o recorte desktop move essa linha para fora do bloco de
 *      texto (`margin-top:8px`, abaixo da barra). Como esta tela é UM único
 *      template responsivo, sem split mobile/desktop, mantive a posição
 *      mobile por caber na estrutura de texto já existente —
 *      divergência declarada, não reconciliação silenciosa de F2/§5.2.
 *    - o número à direita é `c.liberadoCentavos` (não mais
 *      `c.disponivelCentavos`); a legenda da seção ("disponível · teto
 *      mensal") foi ajustada para "liberado · teto mensal" para não
 *      descrever um número que a coluna já não mostra.
 *    - a cor de alerta do número continua lendo `c.disponivelCentavos < 0`
 *      (estouro), não `c.liberadoCentavos`: o contrato garante que
 *      `liberadoCentavos` nunca é negativo, então não haveria estouro para
 *      colorir se a leitura fosse sobre ele.
 *    - `pctLabel` vira `estourou`/`parcial`/percentual, nesta ordem de
 *      prioridade (EF-06 recorte-desenho-20.md §2).
 *    - a barra ganha a segunda faixa hachurada,
 *      `repeating-linear-gradient(135deg,#d7dce3 0 3px,#eceef1 3px 6px)`,
 *      largura `bloqueado / teto` — mesma base da faixa gasta (não a
 *      cor da categoria; `c.corBarra` do mockup, cuja regra nunca foi
 *      localizada, continua sem equivalente aqui, como já era).
 *
 * 6. FAIXA DE ESTOURO (`temEstouro`, recorte-desenho-18.md §4.3) — sem
 *    mudança nesta tarefa. Já tem precedente: `orcamento.vue` implementa o
 *    MESMO cartão (mesma cópia, "Cobrir com o saldo de outra categoria")
 *    por categoria com `disponivelCentavos < 0`, e o comentário de lá já
 *    reserva este lugar para a home. Reaproveitado aqui — MESMO texto,
 *    mesma condição. O botão "Remanejar", porém, não reabre a folha de
 *    remanejar: essa folha (`sheetRemanejar`) é ~150 linhas de estado só
 *    dentro de `orcamento.vue`, e o escopo desta tarefa é só
 *    `pages/index.vue` e `assets/scss/pages/home.scss` — nem `orcamento.vue`
 *    nem `components/` são meus para tocar. O botão navega para
 *    `/orcamento`, onde o remanejamento de verdade já existe, em vez de
 *    abrir um SEGUNDO caminho para a mesma ação (o que a doutrina proíbe
 *    mais ainda do que duplicar código).
 */
import type { CategoriaNaCompetencia, CompetenciaLida } from '@orcamento/contrato';
import { useFolhaLancamento, useLancamentos } from '~/composables/useLancamentos';
import { classeDoIconeCategoria, useOrcamento } from '~/composables/useOrcamento';
import { formatarCentavos } from '~/utils/dinheiro';

const { lerCompetencia } = useOrcamento();
const { abrir: abrirLancamento } = useFolhaLancamento();

// ── LEITURA DA COMPETÊNCIA ──────────────────────────────────────────────
// O mês ativo vem do shell (`useCompetencia`), não é estado desta tela —
// mesmo raciocínio de `orcamento.vue`.
const { competencia } = useCompetencia();

const leitura = ref<CompetenciaLida | null>(null);
const carregando = ref(true);
const erroLista = ref<string | null>(null);

const categorias = computed<CategoriaNaCompetencia[]>(() => leitura.value?.categorias ?? []);
const recebidoCentavos = computed(() => leitura.value?.recebidoCentavos ?? 0);
const rendaPrevistaCentavos = computed(() => leitura.value?.rendaPrevistaCentavos ?? 0);
const naoAlocadoCentavos = computed(() => leitura.value?.naoAlocadoCentavos ?? 0);

// EF-06 (lastro, #20) — os três campos que fecham o ponto 2/4 do cabeçalho.
// Vêm prontos de `CompetenciaLida`; esta tela não soma nem rateia nada.
const lastroCentavos = computed(() => leitura.value?.lastroCentavos ?? 0);
const deficitCentavos = computed(() => leitura.value?.deficitCentavos ?? 0);
const liberadoTotalCentavos = computed(() => leitura.value?.liberadoTotalCentavos ?? 0);

/** Mesmo padrão de `orcamento.vue`: só a leitura MAIS RECENTE grava a tela. */
let leituraEmOrdem = 0;

async function carregar(): Promise<void> {
  const minhaOrdem = ++leituraEmOrdem;
  try {
    const resposta = await lerCompetencia(competencia.value);
    if (minhaOrdem !== leituraEmOrdem) return;
    leitura.value = resposta;
    erroLista.value = null;
  } catch (erro) {
    if (minhaOrdem !== leituraEmOrdem) return;
    erroLista.value = mensagemDoErro(erro, 'Não consegui carregar a visão do mês.');
  } finally {
    if (minhaOrdem === leituraEmOrdem) carregando.value = false;
  }
}

onMounted(carregar);

watch(competencia, async () => {
  carregando.value = true;
  await carregar();
});

// ── TEMPO REAL ───────────────────────────────────────────────────────────
// Esta tela mistura dois recursos: o TETO/RENDA vêm do recurso `orcamento`
// (mesmo que `orcamento.vue` já ouve) e o GASTO/RECEBIDO vêm dos
// lançamentos (EF-04, tarefa #53) — por isso ouve os DOIS, não só um.
//
// `useLancamentos({ competenciaAtiva, aoInvalidar })` já embute a fiação do
// recurso `lancamentos` (filtro por competência, ressincronização ao
// reconectar, descarte do próprio eco) — não reescrita aqui, conforme o
// cabeçalho de `composables/useLancamentos.ts`.
useLancamentos({
  competenciaAtiva: computed(() => competencia.value),
  aoInvalidar: async () => {
    await carregar();
  },
});

// O recurso `orcamento` (teto, renda prevista, remanejamento) — mesma
// assinatura que `orcamento.vue` já usa, chamada direto por não ser parte
// do wrapper acima (que só cobre `lancamentos`).
//
// `contas` (achado da revisão de COSTURA da #20, tarefa #80) — a tarefa #76
// tornou esta tela dependente do LASTRO: `lastroCentavos`, `deficitCentavos`,
// `liberadoTotalCentavos` e, por categoria, `liberadoCentavos`/
// `bloqueadoCentavos` derivam do saldo das contas de débito e do limite livre
// dos cartões (EF-06). `api/src/modulos/contas/rotas.ts` emite
// `recurso: 'contas'` em toda mutação de conta (criar, excluir, editar saldo
// ou limite) — sem ouvir aqui, editar um cartão numa aba deixava as OUTRAS
// abas com esses cinco campos velhos até o socket reconectar. Não remova
// isto sem primeiro verificar se a home ainda depende do lastro: é assim que
// este defeito volta. Pagar fatura já cai em `lancamentos` (a rota co-emite
// `contas` e `lancamentos`, e o wrapper acima já ouve `lancamentos`) — não é
// esta assinatura que cobre aquele caminho.
useRealtime({
  recursos: ['orcamento', 'contas'],
  competenciaAtiva: computed(() => competencia.value),
  aoInvalidar: async () => {
    await carregar();
  },
});

// ── CARTÃO DE CATEGORIA — a "porta 2" do recorte §1 ──────────────────────

/**
 * `pctLabel` (EF-06 recorte-desenho-20.md §2) — `estourou` se a categoria
 * estourou o teto, `parcial` se há bloqueio de lastro, senão o percentual de
 * sempre (gasto/teto; teto zero sem estouro nem bloqueio não tem razão
 * definida, mostra "—"). Nesta ordem de prioridade.
 */
function pctLabel(c: CategoriaNaCompetencia): string {
  if (c.disponivelCentavos < 0) return 'estourou';
  if (c.bloqueadoCentavos > 0) return 'parcial';
  if (c.tetoCentavos <= 0) return '—';
  return `${Math.round(Math.min(999, (c.gastoCentavos / c.tetoCentavos) * 100))}%`;
}

/** Largura da faixa GASTA da barra — mede contra o teto. */
function larguraBarra(c: CategoriaNaCompetencia): string {
  if (c.tetoCentavos <= 0) return c.gastoCentavos > 0 ? '100%' : '0%';
  return `${Math.min(100, (c.gastoCentavos / c.tetoCentavos) * 100)}%`;
}

/**
 * Largura da faixa BLOQUEADA (hachurada) — mede contra o TETO, a mesma base
 * da faixa gasta acima (EF-06 recorte-desenho-20.md §2: "a hachura mede
 * contra o TETO"). Some sozinha em 0% quando não há bloqueio.
 */
function larguraBloqueio(c: CategoriaNaCompetencia): string {
  if (c.tetoCentavos <= 0) return '0%';
  return `${Math.min(100, (c.bloqueadoCentavos / c.tetoCentavos) * 100)}%`;
}

/** Literal do recorte (EF-06 recorte-desenho-20.md §2, `bloqLabel`): "«valor» bloqueado por falta de lastro". */
function bloqLabel(c: CategoriaNaCompetencia): string {
  return `${formatarCentavos(c.bloqueadoCentavos)} bloqueado por falta de lastro`;
}

/** `c.gastoLabel` — construído aqui (o mockup não dá o formato literal): "gasto de teto". */
function gastoLabel(c: CategoriaNaCompetencia): string {
  return `${formatarCentavos(c.gastoCentavos)} de ${formatarCentavos(c.tetoCentavos)}`;
}

/**
 * Vermelho só quando a categoria estourou — mesmo critério de
 * `contas.vue#corDoValor`. Lê `disponivelCentavos`, não `liberadoCentavos`:
 * o contrato garante que `liberadoCentavos` nunca é negativo (ver
 * `packages/contrato/src/gerado/api.ts`), então não haveria estouro para
 * colorir se a leitura fosse sobre ele.
 */
function corDisponivel(c: CategoriaNaCompetencia): string {
  return c.disponivelCentavos < 0 ? 'var(--alerta)' : 'var(--texto)';
}

/** Cópia LITERAL de `orcamento.vue#tituloEstouro` — mesmo cartão, ver ponto 6 do cabeçalho. */
function tituloEstouro(c: CategoriaNaCompetencia): string {
  return `${c.nome} passou ${formatarCentavos(Math.abs(c.disponivelCentavos))} do teto`;
}
</script>

<template>
  <section class="home">
    <p v-if="carregando" class="home__vazio">Carregando…</p>
    <p v-else-if="erroLista" class="home__vazio home__vazio--erro" role="alert">{{ erroLista }}</p>

    <template v-else>
      <!-- ── CARTÃO-HERÓI (recorte-desenho-20.md §3, RN-30 — ver ponto 2 do cabeçalho) ── -->
      <div class="home__hero">
        <p class="home__hero-titulo">LIBERADO ATÉ O FIM DO MÊS</p>
        <p class="home__hero-numero">{{ formatarCentavos(liberadoTotalCentavos) }}</p>

        <div class="home__hero-blocos">
          <div class="home__hero-bloco">
            <p class="home__hero-bloco-rotulo">RECEBIDO</p>
            <p class="home__hero-bloco-valor">{{ formatarCentavos(recebidoCentavos) }}</p>
            <p class="home__hero-bloco-sub">de {{ formatarCentavos(rendaPrevistaCentavos) }} previsto</p>
          </div>
          <div class="home__hero-bloco">
            <p class="home__hero-bloco-rotulo">NÃO ALOCADO</p>
            <p class="home__hero-bloco-valor">{{ formatarCentavos(naoAlocadoCentavos) }}</p>
            <p class="home__hero-bloco-sub">renda variável</p>
          </div>
        </div>
      </div>

      <!-- ── FAIXA DE BLOQUEIO (recorte-desenho-20.md §1 — ver ponto 4 do cabeçalho) ── -->
      <div v-if="deficitCentavos > 0" class="home__bloqueio">
        <span class="home__bloqueio-icone"><i class="ti ti-lock"></i></span>
        <div class="home__bloqueio-texto">
          <p class="home__bloqueio-titulo">{{ formatarCentavos(deficitCentavos) }} do plano está bloqueado</p>
          <p class="home__bloqueio-explicacao">
            Conta corrente + limite dos cartões cobrem {{ formatarCentavos(lastroCentavos) }}. A reserva fica
            fora do orçamento.
          </p>
        </div>
      </div>

      <!-- ── LISTA DE CATEGORIAS (recorte-desenho-20.md §2) ─────────────────────── -->
      <div class="home__secao-cabecalho">
        <span class="home__secao-titulo">Categorias</span>
        <span class="home__secao-legenda">liberado · teto mensal</span>
      </div>

      <p v-if="categorias.length === 0" class="home__vazio">
        Nenhuma categoria cadastrada ainda. Crie uma em Orçamento.
      </p>

      <div v-else class="home__lista">
        <div v-for="c in categorias" :key="c.id" class="home__cartao">
          <!-- ⭐ o cartão INTEIRO é o botão que abre a folha com a categoria pré-escolhida (recorte §1). -->
          <button type="button" class="home__categoria" @click="abrirLancamento({ categoriaId: c.id })">
            <span class="home__icone" :style="{ background: c.cor }">
              <i class="ti" :class="classeDoIconeCategoria(c.icone)"></i>
            </span>
            <span class="home__texto">
              <span class="home__linha-superior">
                <span class="home__nome">{{ c.nome }}</span>
                <span class="home__valores">
                  <span class="home__disponivel" :style="{ color: corDisponivel(c) }">
                    {{ formatarCentavos(c.liberadoCentavos) }}
                  </span>
                  <span class="home__pct">{{ pctLabel(c) }}</span>
                </span>
              </span>
              <span class="home__gasto">{{ gastoLabel(c) }}</span>
              <span v-if="c.bloqueadoCentavos > 0" class="home__bloqueado">{{ bloqLabel(c) }}</span>
              <span class="home__barra">
                <span class="home__barra-fill" :style="{ width: larguraBarra(c), background: c.cor }"></span>
                <span class="home__barra-bloqueado" :style="{ width: larguraBloqueio(c) }"></span>
              </span>
            </span>
          </button>

          <!-- Cartão canônico de estouro — mesmo texto de `orcamento.vue`, ver ponto 6 do cabeçalho. -->
          <div v-if="c.disponivelCentavos < 0" class="home__estouro">
            <div class="home__estouro-texto">
              <p class="home__estouro-titulo">{{ tituloEstouro(c) }}</p>
              <p class="home__estouro-subtitulo">Cobrir com o saldo de outra categoria</p>
            </div>
            <NuxtLink to="/orcamento" class="home__estouro-botao">Remanejar</NuxtLink>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<style lang="scss" src="~/assets/scss/pages/home.scss" scoped></style>
