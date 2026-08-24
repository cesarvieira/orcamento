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
const { sessao } = useSessao();

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
        <span class="marca__selo"><i class="ti ti-home-dollar" /></span>
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
          <i class="ti" :class="destino.icone" />
          <span class="sidebar__rotulo">{{ destino.rotulo }}</span>
        </NuxtLink>
      </nav>

      <NuxtLink :to="rotaDeLancamento" class="sidebar__acao">
        <i class="ti ti-plus" />
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
    </aside>

    <!-- ── CONTEÚDO ─────────────────────────────────────────────────────── -->
    <div class="corpo">
      <header class="topo">
        <slot name="topo">
          <h1 class="topo__titulo">{{ destinoAtivo?.rotulo ?? 'Orçamento' }}</h1>
        </slot>
      </header>

      <main class="conteudo">
        <slot />
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
        <i class="ti" :class="destino.icone" />
        <span>{{ destino.rotuloCurto }}</span>
      </NuxtLink>

      <div class="tabbar__centro">
        <NuxtLink :to="rotaDeLancamento" class="tabbar__fab" aria-label="Novo lançamento">
          <i class="ti ti-plus" />
        </NuxtLink>
      </div>

      <NuxtLink
        :to="ROTA_MAIS"
        class="tabbar__aba"
        :class="{ 'tabbar__aba--ativa': maisEstaAtivo }"
        :aria-current="maisEstaAtivo ? 'page' : undefined"
      >
        <i class="ti ti-dots" />
        <span>Mais</span>
      </NuxtLink>
    </nav>
  </div>
</template>

<style scoped>
/* ─────────────────────────────────────────────────────────────────────────
   MOBILE PRIMEIRO. A sidebar não existe abaixo de 768px; a tab bar não
   existe acima. Uma das duas está sempre em `display:none`, nunca as duas.
   ───────────────────────────────────────────────────────────────────────── */

.shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.sidebar {
  display: none;
}

.corpo {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  /* Espaço para a tab bar não cobrir o fim do conteúdo. */
  padding-bottom: var(--altura-tabbar);
}

.topo {
  padding: 14px 18px 0;
}

.topo__titulo {
  margin: 0;
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.conteudo {
  flex: 1;
  padding: 6px 18px 24px;
}

/* ── tab bar ───────────────────────────────────────────────────────────── */

.tabbar {
  position: fixed;
  inset: auto 0 0 0;
  z-index: 30;
  height: var(--altura-tabbar);
  background: var(--superficie);
  border-top: 1px solid var(--borda-topo);
  display: grid;
  grid-template-columns: 1fr 1fr 76px 1fr 1fr;
  align-items: center;
  padding-bottom: 10px;
}

.tabbar__aba {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  color: var(--texto-fraco);
  font-size: 10.5px;
  font-weight: 700;
}

.tabbar__aba i {
  font-size: 23px;
}

.tabbar__aba--ativa,
.tabbar__aba--ativa:hover {
  color: var(--tinta);
}

.tabbar__centro {
  display: flex;
  justify-content: center;
}

.tabbar__fab {
  width: 56px;
  height: 56px;
  margin-top: -14px;
  border-radius: 9999px;
  background: var(--tinta);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--sombra-flutuante);
}

.tabbar__fab i {
  font-size: 26px;
}

.tabbar__fab:hover {
  color: #fff;
}

/* ─────────────────────────────────────────────────────────────────────────
   DESKTOP · a partir de 768px
   ───────────────────────────────────────────────────────────────────────── */

@media (min-width: 768px) {
  .shell {
    flex-direction: row;
  }

  .tabbar {
    display: none;
  }

  .sidebar {
    display: flex;
    flex-direction: column;
    gap: 22px;
    width: var(--largura-sidebar);
    flex: none;
    position: sticky;
    top: 0;
    height: 100vh;
    padding: 22px 16px;
    background: var(--tinta);
    color: #fff;
  }

  .marca {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 0 6px;
  }

  .marca__selo {
    width: 38px;
    height: 38px;
    flex: none;
    border-radius: 11px;
    background: rgba(255, 255, 255, 0.14);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 21px;
  }

  .marca__texto {
    min-width: 0;
  }

  .marca__titulo {
    display: block;
    font-size: 14px;
    font-weight: 800;
    letter-spacing: -0.01em;
  }

  .marca__sub {
    display: block;
    font-size: 11px;
    opacity: 0.62;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sidebar__nav {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .sidebar__item {
    height: 42px;
    padding: 0 12px;
    display: flex;
    align-items: center;
    gap: 11px;
    border-radius: var(--raio-pequeno);
    font-size: 13.5px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.82);
    background: transparent;
  }

  .sidebar__item i {
    font-size: 19px;
  }

  .sidebar__item:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.08);
  }

  .sidebar__item--ativo,
  .sidebar__item--ativo:hover {
    background: #fff;
    color: var(--tinta);
  }

  .sidebar__rotulo {
    flex: 1;
  }

  .sidebar__acao {
    height: 46px;
    border-radius: 12px;
    background: #fff;
    color: var(--tinta);
    font-size: 13.5px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .sidebar__acao i {
    font-size: 18px;
  }

  .sidebar__rodape {
    margin-top: auto;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 14px;
    font-size: 11px;
  }

  .sidebar__rodape-vazio {
    opacity: 0.62;
    line-height: 1.5;
  }

  .corpo {
    padding-bottom: 0;
  }

  .topo {
    height: var(--altura-topo);
    flex: none;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 0 30px;
    background: var(--superficie);
    border-bottom: 1px solid rgba(0, 0, 0, 0.07);
    position: sticky;
    top: 0;
    z-index: 20;
  }

  .topo__titulo {
    font-size: 20px;
  }

  .conteudo {
    padding: 26px 30px 40px;
  }
}
</style>
