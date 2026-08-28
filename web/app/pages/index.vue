<script setup lang="ts">
/**
 * VISÃO DO MÊS (EF-04) — a tela `home` do mockup. Recorte em
 * `.motor/recorte-desenho-18.md` §4 (não commitado, artefato do condutor) —
 * é FONTE, não ilustração. 🟦 é desenho; 🟨 é anotação do condutor ou decisão
 * do humano.
 *
 * `recebidoCentavos`, `naoAlocadoCentavos`, `planejadoCentavos` e, por
 * categoria, `tetoCentavos`/`gastoCentavos`/`disponivelCentavos` são
 * DERIVADOS pelo servidor (mesma leitura que `orcamento.vue` já consome,
 * `useOrcamento().lerCompetencia`) — esta tela só formata para exibir,
 * nunca recalcula (regra inviolável #4 do projeto).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * ONDE ESTA TELA DIVERGE DO RECORTE, E POR QUÊ — tudo declarado, nada
 * inventado em silêncio (recorte §6):
 * ═══════════════════════════════════════════════════════════════════════
 *
 * 1. CABEÇALHO DE MÊS E A PÍLULA "A + B" (recorte §4.1) — não duplicados
 *    aqui. O seletor de mês já é global (`layouts/default.vue`, `.mes`),
 *    porque EF-03/EF-04/EF-08 leem a MESMA competência (mesmo raciocínio já
 *    registrado em `orcamento.vue`) — o recorte lê o mockup isolado e por
 *    isso anota o seletor como "da própria home"; o código já divergiu
 *    disso antes desta tarefa, e repetir o cabeçalho aqui criaria DOIS
 *    controles de mês na mesma tela. A pílula de iniciais da família
 *    ("A + B" no mockup) não tem fonte de dado nem precedente no app (a
 *    sidebar mostra o NOME da família, não iniciais) — omitida, não
 *    inventada.
 *
 * 2. O NÚMERO DOMINANTE DO CARTÃO-HERÓI (recorte §4.2, `{{ disponivel }}`,
 *    "Liberado até o fim do mês") — é o número do LASTRO (EF-06, #20,
 *    ainda não construída; `CompetenciaLida` não tem esse campo). Calculá-lo
 *    aqui seria reproduzir a fórmula do produto no front (regra inviolável
 *    #4). Como a própria "Sinal de conclusão" desta tarefa (issue #54) só
 *    exige recebido · previsto · planejado · não alocado · categorias — sem
 *    "disponível" —, o cartão usa `planejadoCentavos` (Σ tetos, RN-11) como
 *    número dominante, com o rótulo trocado para "PLANEJADO NO MÊS" (o
 *    rótulo do mockup, "Liberado até o fim do mês", falaria de um número que
 *    esta tela não tem como calcular direito).
 *
 * 3. `{{ alocLabel }}` (recorte §4.2/§6.5) é dinâmico no mockup; o condutor
 *    não localizou a regra que o alterna. Fixado em "NÃO ALOCADO" — se
 *    precisar variar, é fork, não invenção.
 *
 * 4. FAIXA DE BLOQUEIO (`temDeficit`) E `c.temBloqueio`/`c.bloqLabel`
 *    (recorte §4.4/§4.6, §6.4) — dependem do LASTRO (EF-06, #20, não
 *    construída); `CategoriaNaCompetencia` não tem esses campos. Omitidas
 *    inteiras, não simuladas.
 *
 * 5. A BARRA DE DUAS FAIXAS da categoria (recorte §4.6) — só a faixa GASTA
 *    é desenhada; a faixa BLOQUEADA (hachura) é o mesmo número do lastro do
 *    ponto 4, e some pelo mesmo motivo. `{{ c.corBarra }}` não tem regra
 *    conhecida (podia ser aviso de estouro) — a barra usa a cor da própria
 *    categoria (`c.cor`), decisão simples e declarada, não o desenho.
 *
 * 6. FAIXA DE ESTOURO (`temEstouro`, recorte §4.3) — já tem precedente:
 *    `orcamento.vue` implementa o MESMO cartão (mesma cópia, "Cobrir com o
 *    saldo de outra categoria") por categoria com `disponivelCentavos < 0`,
 *    e o comentário de lá já reserva este lugar para a home. Reaproveitado
 *    aqui — MESMO texto, mesma condição. O botão "Remanejar", porém, não
 *    reabre a folha de remanejar: essa folha (`sheetRemanejar`) é ~150
 *    linhas de estado só dentro de `orcamento.vue`, e o escopo desta tarefa
 *    é só `pages/index.vue` e `pages/extrato.vue` — nem `orcamento.vue` nem
 *    `components/` são meus para tocar. O botão navega para `/orcamento`,
 *    onde o remanejamento de verdade já existe, em vez de abrir um SEGUNDO
 *    caminho para a mesma ação (o que a doutrina proíbe mais ainda do que
 *    duplicar código).
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
const planejadoCentavos = computed(() => leitura.value?.planejadoCentavos ?? 0);
const naoAlocadoCentavos = computed(() => leitura.value?.naoAlocadoCentavos ?? 0);

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
useRealtime({
  recursos: ['orcamento'],
  competenciaAtiva: computed(() => competencia.value),
  aoInvalidar: async () => {
    await carregar();
  },
});

// ── CARTÃO DE CATEGORIA — a "porta 2" do recorte §1 ──────────────────────

/** `pctLabel` — gasto/teto em percentual. Teto zero não tem razão definida: mostra "—". */
function pctLabel(c: CategoriaNaCompetencia): string {
  if (c.tetoCentavos <= 0) return '—';
  return `${Math.round(Math.min(999, (c.gastoCentavos / c.tetoCentavos) * 100))}%`;
}

/** Largura da faixa GASTA da barra (a faixa bloqueada não existe aqui — ver ponto 5 do cabeçalho). */
function larguraBarra(c: CategoriaNaCompetencia): string {
  if (c.tetoCentavos <= 0) return c.gastoCentavos > 0 ? '100%' : '0%';
  return `${Math.min(100, (c.gastoCentavos / c.tetoCentavos) * 100)}%`;
}

/** `c.gastoLabel` — construído aqui (o mockup não dá o formato literal): "gasto de teto". */
function gastoLabel(c: CategoriaNaCompetencia): string {
  return `${formatarCentavos(c.gastoCentavos)} de ${formatarCentavos(c.tetoCentavos)}`;
}

/** Vermelho só quando a categoria estourou — mesmo critério de `contas.vue#corDoValor`. */
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
      <!-- ── CARTÃO-HERÓI (recorte §4.2 — ver ponto 2 do cabeçalho para o número dominante) ── -->
      <div class="home__hero">
        <p class="home__hero-titulo">PLANEJADO NO MÊS</p>
        <p class="home__hero-numero">{{ formatarCentavos(planejadoCentavos) }}</p>

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

      <!-- ── LISTA DE CATEGORIAS (recorte §4.5/§4.6) ─────────────────────── -->
      <div class="home__secao-cabecalho">
        <span class="home__secao-titulo">Categorias</span>
        <span class="home__secao-legenda">disponível · teto mensal</span>
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
                    {{ formatarCentavos(c.disponivelCentavos) }}
                  </span>
                  <span class="home__pct">{{ pctLabel(c) }}</span>
                </span>
              </span>
              <span class="home__gasto">{{ gastoLabel(c) }}</span>
              <span class="home__barra">
                <span class="home__barra-fill" :style="{ width: larguraBarra(c), background: c.cor }"></span>
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
