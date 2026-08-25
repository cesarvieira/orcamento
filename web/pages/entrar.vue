<script setup lang="ts">
/**
 * ENTRAR — o mínimo para autenticar, no sistema visual do shell.
 *
 * ⚠️ ESCOPO: esta tela é da EF-01. A EF-00 entrega só o caminho de email +
 * senha, porque sem ele o seed não vira sessão e o gate de navegação não passa
 * da porta. **Google OAuth, convite e aceite são da EF-01** — que substitui
 * esta página, sem inventar linguagem nova (o mockup não tem tela de login).
 */
definePageMeta({ layout: 'limpo' });

const { entrar } = useSessao();

const email = ref('');
const senha = ref('');
const enviando = ref(false);
const erro = ref<string | null>(null);

async function submeter() {
  if (enviando.value) return;
  erro.value = null;
  enviando.value = true;
  try {
    await entrar(email.value.trim(), senha.value);
    await navigateTo('/');
  } catch {
    erro.value = 'Email ou senha não conferem.';
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <div class="entrar">
    <div class="entrar__marca">
      <span class="entrar__selo"><i class="ti ti-home-dollar"></i></span>
      <div>
        <h1 class="entrar__titulo">Orçamento da casa</h1>
        <p class="entrar__sub">Quanto dá para gastar de verdade.</p>
      </div>
    </div>

    <form class="cartao" @submit.prevent="submeter">
      <label class="campo">
        <span class="campo__rotulo">EMAIL</span>
        <input
          v-model="email"
          type="email"
          name="email"
          autocomplete="username"
          required
          class="campo__entrada"
        >
      </label>

      <label class="campo">
        <span class="campo__rotulo">SENHA</span>
        <input
          v-model="senha"
          type="password"
          name="senha"
          autocomplete="current-password"
          required
          class="campo__entrada"
        >
      </label>

      <p v-if="erro" class="erro" role="alert">{{ erro }}</p>

      <button type="submit" class="botao" :disabled="enviando">
        {{ enviando ? 'Entrando…' : 'Entrar' }}
      </button>
    </form>
  </div>
</template>

<style lang="scss" src="~/assets/scss/pages/entrar.scss" scoped></style>
