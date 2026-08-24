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
      <span class="moldura__selo"><i class="ti ti-layout-board-split" /></span>
      <p>
        Esta tela é construída pela
        <strong>{{ destino?.especificacao }}</strong>. A EF-00 entrega a moldura:
        a rota, a navegação e o sistema visual.
      </p>
    </div>
  </section>
</template>

<style scoped>
.moldura__titulo {
  margin: 0;
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.moldura__sub {
  margin: 4px 0 16px;
  font-size: 12px;
  color: var(--texto-fraco);
}

.moldura__aviso {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: var(--superficie);
  border: 1px solid var(--borda);
  border-radius: var(--raio);
  padding: 16px;
  box-shadow: var(--sombra-carta);
}

.moldura__aviso p {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--texto-medio);
}

.moldura__selo {
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: 9px;
  background: var(--tinta);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

@media (min-width: 768px) {
  .moldura__titulo {
    display: none;
  }

  .moldura__sub {
    margin-top: 0;
  }
}
</style>
