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
        <span class="linha__icone"><i class="ti" :class="destino.icone" /></span>
        <span class="linha__texto">
          <span class="linha__titulo">{{ destino.rotulo }}</span>
          <span class="linha__sub">{{ destino.descricao }}</span>
        </span>
        <i class="ti ti-chevron-right linha__seta" />
      </NuxtLink>
    </nav>

    <p class="rodape">
      {{ sessao?.familiaNome }} · {{ sessao?.membroNome }}
    </p>

    <button type="button" class="sair" @click="encerrar">Sair</button>
  </section>
</template>

<style scoped>
.mais__titulo {
  margin: 0 0 16px;
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.lista {
  background: var(--superficie);
  border: 1px solid var(--borda);
  border-radius: var(--raio);
  overflow: hidden;
}

.linha {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 14px 16px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  color: var(--texto);
}

.linha:first-child {
  border-top: none;
}

.linha__icone {
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: 9px;
  background: var(--tinta);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
}

.linha__texto {
  flex: 1;
  min-width: 0;
}

.linha__titulo {
  display: block;
  font-size: 14px;
  font-weight: 700;
}

.linha__sub {
  display: block;
  font-size: 11.5px;
  color: var(--texto-fraco);
  margin-top: 2px;
}

.linha__seta {
  color: var(--texto-apagado);
  font-size: 16px;
}

.rodape {
  font-size: 11px;
  color: var(--texto-fraco);
  text-align: center;
  margin: 20px 0 12px;
  line-height: 1.6;
}

.sair {
  display: block;
  width: 100%;
  height: 44px;
  border: 1px solid var(--borda-media);
  border-radius: 9999px;
  background: var(--superficie);
  font-size: 13px;
  font-weight: 700;
  color: var(--texto-medio);
  cursor: pointer;
}
</style>
