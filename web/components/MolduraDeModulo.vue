<script setup lang="ts">
/**
 * O LUGAR RESERVADO de uma tela de módulo.
 *
 * A EF-00 entrega a moldura, não as telas: cada rota precisa existir e abrir
 * (o gate de navegação prova RENDER, não build), mas o conteúdo é da EF que
 * possui o módulo. Este componente é o que ocupa a rota até lá — e diz de quem
 * ela é, para ninguém construir por cima achando que é terreno livre.
 *
 * Ao implementar a tela, apague o `<MolduraDeModulo>` da página. Não o
 * preencha: ele não é um componente de layout, é um marcador.
 */
import { destinoDaRota } from '../config/navegacao';

const props = defineProps<{ rota: string }>();

const destino = computed(() => destinoDaRota(props.rota));
</script>

<template>
  <section class="moldura">
    <h2 class="moldura__titulo">{{ destino?.rotulo ?? 'Tela' }}</h2>
    <p class="moldura__sub">{{ destino?.descricao }}</p>

    <div class="moldura__aviso">
      <span class="moldura__selo"><i class="ti ti-layout-board-split"></i></span>
      <p>
        Esta tela é construída pela
        <strong>{{ destino?.especificacao }}</strong>. A EF-00 entrega a moldura:
        a rota, a navegação e o sistema visual.
      </p>
    </div>
  </section>
</template>

<style lang="scss" src="~/assets/scss/components/moldura-de-modulo.scss" scoped></style>
