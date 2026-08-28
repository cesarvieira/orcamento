<script setup lang="ts">
/**
 * O SHELL. A moldura onde as telas dos módulos entram — e nada além disso.
 *
 * Extraído dos dois arquivos do mockup:
 *   · < 768px  → tab bar de 74px no rodapé, com o botão central de lançar
 *   · ≥ 768px  → sidebar de 252px à esquerda + barra de topo de 76px
 *
 * São as MESMAS sete telas nos dois: a lista vem de `config/navegacao.ts`, e
 * aqui só muda o desenho. Nenhuma tela de domínio é construída neste arquivo.
 *
 * A troca entre as duas formas é feita em CSS puro, por media query. Não há
 * `window.innerWidth` em lugar nenhum de propósito: o app é SSR, e medir a
 * janela durante o render do servidor produz o clássico salto na hidratação —
 * a moldura errada aparece por um quadro e volta.
 */
import {
  ABAS_A_DIREITA,
  ABAS_A_ESQUERDA,
  DESTINOS,
  ROTA_MAIS,
  destinoDaRota,
} from '../config/navegacao';
import type { Destino } from '../config/navegacao';
import { useFolhaLancamento } from '~/composables/useLancamentos';
import { MESES_DO_ANO, competenciaAtual, competenciaDe } from '~/utils/competencia';

const rota = useRoute();
const { sessao, sair } = useSessao();

/**
 * Sair é a única ação de sessão que o shell executa. Vive aqui, e não só em
 * `/mais`, porque no desktop aquela tela é a redundante — quem navega pela
 * sidebar nunca passa por ela, e ficava sem saída.
 */
async function encerrar(): Promise<void> {
  await sair();
  await navigateTo('/entrar');
}

const destinoAtivo = computed(() => destinoDaRota(rota.path));
const maisEstaAtivo = computed(
  () => rota.path === ROTA_MAIS || (!!destinoAtivo.value && !destinoAtivo.value.abaNoMobile),
);

/**
 * O botão central da tab bar e o "Novo lançamento" da sidebar abrem a folha
 * de lançamento (`sheetLanc`, EF-04/tarefa #53) — não navegam mais para o
 * extrato. `<FolhaLancamento />` está montada uma vez, no fim deste template;
 * abrir é só chamar `abrir()`, sem categoria pré-selecionada (a pré-seleção
 * é a porta do cartão de categoria da home, tarefa #54 — ver
 * `composables/useLancamentos.ts`).
 */
const { abrir: abrirNovoLancamento } = useFolhaLancamento();

/**
 * O ícone de um destino, respeitando o estado. `iconeAtivo` é opcional de
 * propósito — hoje nenhum destino o preenche, porque a fonte carregada não tem
 * variante preenchida (o porquê, medido, está em `config/navegacao.ts`). O
 * fallback garante que o dia em que alguém preencher, funcione; e que enquanto
 * ninguém preencher, nada apareça vazio.
 */
function iconeDe(destino: Destino, ativo: boolean): string {
  return ativo ? (destino.iconeAtivo ?? destino.icone) : destino.icone;
}

/**
 * O MÊS ATIVO vive no shell, não numa tela.
 *
 * Três telas leem a mesma competência — orçamento (EF-03), visão do mês (EF-04)
 * e fechamento (EF-08). Deixar o seletor dentro de uma delas faria as outras
 * duas ou repetirem o controle, ou discordarem sobre qual mês está aberto.
 * O estado é compartilhado (`useCompetencia`), e quem o desenha é a moldura.
 */
const {
  competencia: competenciaAtiva,
  rotulo: rotuloDoMes,
  ehMesCorrente,
  ano: anoDoMesAtivo,
  ir: irParaCompetencia,
  anterior: mesAnterior,
  seguinte: mesSeguinte,
  voltarParaCorrente,
} = useCompetencia();

const seletorDeMesAberto = ref(false);
const anoNaFolha = ref(anoDoMesAtivo.value);

function abrirSeletorDeMes(): void {
  anoNaFolha.value = anoDoMesAtivo.value;
  seletorDeMesAberto.value = true;
}
function fecharSeletorDeMes(): void {
  seletorDeMesAberto.value = false;
}
function escolherMes(alvo: string): void {
  irParaCompetencia(alvo);
  fecharSeletorDeMes();
}
function irParaMesCorrente(): void {
  voltarParaCorrente();
  fecharSeletorDeMes();
}

/** Os doze meses do ano que a folha mostra, já sabendo qual é o ativo e qual é o de hoje. */
const mesesDoAnoNaFolha = computed(() =>
  MESES_DO_ANO.map((nome, indice) => {
    const alvo = competenciaDe(anoNaFolha.value, indice + 1);
    return {
      nome,
      competencia: alvo,
      ativo: alvo === competenciaAtiva.value,
      ehHoje: alvo === competenciaAtual(),
    };
  }),
);
</script>

<template>
  <div class="shell">
    <!-- ── SIDEBAR · ≥ 768px ────────────────────────────────────────────── -->
    <aside class="sidebar">
      <div class="marca">
        <span class="marca__selo"><i class="ti ti-home-dollar"></i></span>
        <span class="marca__texto">
          <span class="marca__titulo">Orçamento familiar</span>
          <span class="marca__sub">{{ sessao?.familiaNome ?? '—' }}</span>
        </span>
      </div>

      <nav class="sidebar__nav" aria-label="Navegação principal">
        <NuxtLink
          v-for="destino in DESTINOS"
          :key="destino.id"
          :to="destino.rota"
          class="sidebar__item"
          :class="{ 'sidebar__item--ativo': destinoAtivo?.id === destino.id }"
          :aria-current="destinoAtivo?.id === destino.id ? 'page' : undefined"
        >
          <i class="ti" :class="iconeDe(destino, destinoAtivo?.id === destino.id)"></i>
          <span class="sidebar__rotulo">{{ destino.rotulo }}</span>
        </NuxtLink>
      </nav>

      <button type="button" class="sidebar__acao" @click="abrirNovoLancamento()">
        <i class="ti ti-plus"></i>
        Novo lançamento
      </button>

      <div class="sidebar__rodape">
        <slot name="resumo-lateral">
          <!--
            No mockup este cartão mostra "LIBERADO NO MÊS" e o lastro. O número
            é da EF-06; o shell só reserva o lugar dele.
          -->
          <span class="sidebar__rodape-vazio">O resumo do mês entra aqui.</span>
        </slot>
      </div>

      <button type="button" class="sidebar__sair" @click="encerrar">
        <i class="ti ti-logout"></i>
        Sair
      </button>
    </aside>

    <!-- ── CONTEÚDO ─────────────────────────────────────────────────────── -->
    <div class="corpo">
      <header class="topo">
        <slot name="topo">
          <h1 class="topo__titulo">{{ destinoAtivo?.rotulo ?? '' }}</h1>
        </slot>

        <!--
          ── MÊS ATIVO ─────────────────────────────────────────────────────
          Desktop: à DIREITA da barra branca (`margin-left: auto`).
          Mobile:  centralizado no topo, abaixo do título.
          O mesmo bloco nos dois — só o CSS muda, como no resto do shell.
        -->
        <div class="mes">
          <button type="button" class="mes__passo" aria-label="Mês anterior" @click="mesAnterior">
            <i class="ti ti-chevron-left"></i>
          </button>

          <button
            type="button"
            class="mes__atual"
            :aria-label="`Mês ativo: ${rotuloDoMes}. Escolher outro mês`"
            @click="abrirSeletorDeMes"
          >
            <span class="mes__nome">{{ rotuloDoMes }}</span>
            <i class="ti ti-chevron-down"></i>
          </button>

          <button type="button" class="mes__passo" aria-label="Mês seguinte" @click="mesSeguinte">
            <i class="ti ti-chevron-right"></i>
          </button>
        </div>
      </header>

      <main class="conteudo">
        <slot></slot>
      </main>
    </div>

    <!-- ── TAB BAR · < 768px ────────────────────────────────────────────── -->
    <!--
      A ordem é `Mês · Contas · [+] · Extrato · Mais`, como no mockup: o botão
      de lançar fica no CENTRO, não no fim. A divisão das abas vem de
      `config/navegacao.ts` — o template não fatia a lista por conta própria.
    -->
    <nav class="tabbar" aria-label="Navegação principal">
      <NuxtLink
        v-for="destino in ABAS_A_ESQUERDA"
        :key="destino.id"
        :to="destino.rota"
        class="tabbar__aba"
        :class="{ 'tabbar__aba--ativa': destinoAtivo?.id === destino.id }"
        :aria-current="destinoAtivo?.id === destino.id ? 'page' : undefined"
      >
        <i class="ti" :class="iconeDe(destino, destinoAtivo?.id === destino.id)"></i>
        <span>{{ destino.rotuloCurto }}</span>
      </NuxtLink>

      <div class="tabbar__centro">
        <button type="button" class="tabbar__fab" aria-label="Novo lançamento" @click="abrirNovoLancamento()">
          <i class="ti ti-plus"></i>
        </button>
      </div>

      <NuxtLink
        v-for="destino in ABAS_A_DIREITA"
        :key="destino.id"
        :to="destino.rota"
        class="tabbar__aba"
        :class="{ 'tabbar__aba--ativa': destinoAtivo?.id === destino.id }"
        :aria-current="destinoAtivo?.id === destino.id ? 'page' : undefined"
      >
        <i class="ti" :class="iconeDe(destino, destinoAtivo?.id === destino.id)"></i>
        <span>{{ destino.rotuloCurto }}</span>
      </NuxtLink>

      <NuxtLink
        :to="ROTA_MAIS"
        class="tabbar__aba"
        :class="{ 'tabbar__aba--ativa': maisEstaAtivo }"
        :aria-current="maisEstaAtivo ? 'page' : undefined"
      >
        <i class="ti ti-dots"></i>
        <span>Mais</span>
      </NuxtLink>
    </nav>

    <!-- ── FOLHA DO SELETOR DE MÊS ────────────────────────────────────────
         Do shell, não de uma tela: o mês é do app. Sem limite de quão longe se
         navega — a competência é `char(7)` e o back devolve teto zero para
         categoria sem `OrcamentoMes` (RN-40), então mês futuro vazio é leitura
         válida, não erro. -->
    <div v-if="seletorDeMesAberto" class="mes-fundo" @click.self="fecharSeletorDeMes">
      <div class="mes-folha">
        <div class="mes-folha__cabecalho">
          <span class="mes-folha__titulo">Escolher o mês</span>
          <button type="button" class="mes-folha__fechar" aria-label="Fechar" @click="fecharSeletorDeMes">
            ✕
          </button>
        </div>

        <div class="mes-folha__ano">
          <button type="button" class="mes__passo" aria-label="Ano anterior" @click="anoNaFolha -= 1">
            −
          </button>
          <span class="mes-folha__ano-valor">{{ anoNaFolha }}</span>
          <button type="button" class="mes__passo" aria-label="Próximo ano" @click="anoNaFolha += 1">
            +
          </button>
        </div>

        <div class="mes-folha__grade">
          <button
            v-for="m in mesesDoAnoNaFolha"
            :key="m.competencia"
            type="button"
            class="mes-folha__opcao"
            :class="{
              'mes-folha__opcao--ativo': m.ativo,
              'mes-folha__opcao--hoje': m.ehHoje && !m.ativo,
            }"
            :aria-current="m.ativo ? 'true' : undefined"
            @click="escolherMes(m.competencia)"
          >
            {{ m.nome }}
          </button>
        </div>

        <!-- Só aparece fora do mês corrente: quem navegou para 2029 precisa de
             um caminho óbvio de volta. -->
        <button
          v-if="!ehMesCorrente"
          type="button"
          class="mes-folha__voltar"
          @click="irParaMesCorrente"
        >
          Ir para o mês atual
        </button>
      </div>
    </div>

    <!--
      ── LANÇAMENTOS (EF-04/tarefa #53) — componentes GLOBAIS ─────────────
      Montados uma vez aqui, abertos de qualquer tela via
      `useFolhaLancamento()`/`useDetalheLancamento()`
      (`composables/useLancamentos.ts`). O FAB e o "Novo lançamento" acima já
      chamam `abrirNovoLancamento()`; a tarefa #54 abre a folha com categoria
      pré-selecionada pelo cartão de categoria da home, e o modal de detalhe
      pelo extrato — sem montar estes componentes de novo.
    -->
    <FolhaLancamento />
    <ModalDetalheLancamento />
  </div>
</template>

<style lang="scss" src="~/assets/scss/layouts/default.scss" scoped></style>
