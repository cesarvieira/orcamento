<script setup lang="ts">
/**
 * A moldura SEM navegação — para as telas que existem antes de haver família:
 * entrar e aceitar convite. Sem tab bar, sem sidebar, mesmo sistema visual.
 */
</script>

<template>
  <div class="limpo">
    <div class="limpo__caixa">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.limpo {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 18px;
  background: var(--fundo);
}

.limpo__caixa {
  width: 100%;
  max-width: 380px;
}

@media (min-width: 768px) {
  .limpo {
    background: var(--fundo-desktop);
  }
}
</style>
