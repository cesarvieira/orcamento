<script setup lang="ts">
/**
 * A moldura SEM navegação — para as telas que existem antes de haver família:
 * entrar e aceitar convite. Sem tab bar, sem sidebar, mesmo sistema visual.
 */
</script>

<template>
  <div class="limpo">
    <div class="limpo__caixa">
      <slot></slot>
    </div>
  </div>
</template>

<style lang="scss" src="~/assets/scss/layouts/limpo.scss" scoped></style>
