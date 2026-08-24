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
      <span class="entrar__selo"><i class="ti ti-home-dollar" /></span>
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

<style scoped>
.entrar__marca {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.entrar__selo {
  width: 44px;
  height: 44px;
  flex: none;
  border-radius: 12px;
  background: var(--tinta);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 23px;
}

.entrar__titulo {
  margin: 0;
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.entrar__sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--texto-fraco);
}

.cartao {
  background: var(--superficie);
  border: 1px solid var(--borda);
  border-radius: var(--raio-grande);
  padding: 18px;
  box-shadow: var(--sombra-carta);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.campo {
  display: block;
}

.campo__rotulo {
  display: block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--texto-fraco);
  margin-bottom: 4px;
}

.campo__entrada {
  width: 100%;
  height: 46px;
  padding: 0 13px;
  border: 1px solid var(--borda-media);
  border-radius: 12px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  color: var(--texto);
  background: var(--superficie);
  outline: none;
}

.campo__entrada:focus {
  border-color: var(--tinta);
}

.erro {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--alerta);
}

.botao {
  height: 48px;
  border: none;
  border-radius: 9999px;
  background: var(--tinta);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.botao:disabled {
  background: #aab2be;
  cursor: default;
}
</style>
