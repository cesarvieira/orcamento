<script setup lang="ts">
/**
 * MAIS — a tela-índice do mobile.
 *
 * A tab bar tem quatro lugares e um botão central; os outros destinos entram
 * aqui. No desktop todos os sete estão na sidebar e esta tela é redundante —
 * mas continua acessível, porque uma rota que existe no mobile e some no
 * desktop é um link quebrado esperando acontecer.
 *
 * É navegação, não domínio: a lista vem inteira de `config/navegacao.ts`.
 */
import { DESTINOS_EM_MAIS } from '../config/navegacao';

const { sessao, sair } = useSessao();

async function encerrar() {
  await sair();
  await navigateTo('/entrar');
}
</script>

<template>
  <section>
    <h2 class="mais__titulo">Mais</h2>

    <nav class="lista">
      <NuxtLink v-for="destino in DESTINOS_EM_MAIS" :key="destino.id" :to="destino.rota" class="linha">
        <span class="linha__icone"><i class="ti" :class="destino.icone"></i></span>
        <span class="linha__texto">
          <span class="linha__titulo">{{ destino.rotulo }}</span>
          <span class="linha__sub">{{ destino.descricao }}</span>
        </span>
        <i class="ti ti-chevron-right linha__seta"></i>
      </NuxtLink>
    </nav>

    <p class="rodape">
      {{ sessao?.familiaNome }} · {{ sessao?.membroNome }}
    </p>

    <button type="button" class="sair" @click="encerrar">Sair</button>
  </section>
</template>

<style lang="scss" src="~/assets/scss/pages/mais.scss" scoped></style>
