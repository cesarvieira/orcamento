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
  ABAS_DO_MOBILE,
  DESTINOS,
  ROTA_MAIS,
  destinoDaRota,
} from '../config/navegacao';

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
 * O botão central da tab bar e o "Novo lançamento" da sidebar abrem a folha de
 * lançamento — que é da EF-04. Enquanto ela não existe, o shell leva para o
 * extrato: é a moldura fazendo o que sabe, sem simular o que não tem.
 */
const rotaDeLancamento = '/extrato';
</script>

<template>
  <div class="shell">
    <!-- ── SIDEBAR · ≥ 768px ────────────────────────────────────────────── -->
    <aside class="sidebar">
      <div class="marca">
        <span class="marca__selo"><i class="ti ti-home-dollar"></i></span>
        <span class="marca__texto">
          <span class="marca__titulo">Orçamento da casa</span>
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
          <i class="ti" :class="destino.icone"></i>
          <span class="sidebar__rotulo">{{ destino.rotulo }}</span>
        </NuxtLink>
      </nav>

      <NuxtLink :to="rotaDeLancamento" class="sidebar__acao">
        <i class="ti ti-plus"></i>
        Novo lançamento
      </NuxtLink>

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
          <h1 class="topo__titulo">{{ destinoAtivo?.rotulo ?? 'Orçamento' }}</h1>
        </slot>
      </header>

      <main class="conteudo">
        <slot></slot>
      </main>
    </div>

    <!-- ── TAB BAR · < 768px ────────────────────────────────────────────── -->
    <nav class="tabbar" aria-label="Navegação principal">
      <NuxtLink
        v-for="destino in ABAS_DO_MOBILE"
        :key="destino.id"
        :to="destino.rota"
        class="tabbar__aba"
        :class="{ 'tabbar__aba--ativa': destinoAtivo?.id === destino.id }"
        :aria-current="destinoAtivo?.id === destino.id ? 'page' : undefined"
      >
        <i class="ti" :class="destino.icone"></i>
        <span>{{ destino.rotuloCurto }}</span>
      </NuxtLink>

      <div class="tabbar__centro">
        <NuxtLink :to="rotaDeLancamento" class="tabbar__fab" aria-label="Novo lançamento">
          <i class="ti ti-plus"></i>
        </NuxtLink>
      </div>

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
  </div>
</template>

<style lang="scss" src="~/assets/scss/layouts/default.scss" scoped></style>
