<script setup lang="ts">
/**
 * CONFIRMAR O EMAIL DO CADASTRO — RN-06/RN-09/RN-10 (EF-01 §3).
 *
 * Rota pública: quem chega aqui vem do email e ainda não tem sessão — é
 * justamente a confirmação que a abre.
 *
 * Antes esta tela confirmava sozinha ao abrir, porque o segredo vinha no
 * link. Com RN-10 o segredo é DIGITADO: a tela virou formulário de email +
 * código de 6 dígitos, e o código não vale sem o email — ele não é único
 * sozinho.
 */
definePageMeta({ layout: false });

const { confirmarConta } = useConta();

const email = ref('');
const codigo = ref('');
const enviando = ref(false);
const mensagem = ref<string | null>(null);

async function submeter(): Promise<void> {
  if (enviando.value) return;
  mensagem.value = null;
  enviando.value = true;
  try {
    await confirmarConta({ email: email.value.trim(), codigo: codigo.value.trim() });
    await navigateTo('/');
  } catch (erro) {
    // A mensagem é da API — é ela que sabe se expirou, se já foi usado, ou
    // quantas tentativas ainda restam (RN-11).
    mensagem.value = mensagemDoErro(erro, 'Não consegui confirmar este email.');
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <div class="entrar">
    <div class="entrar__coluna">
      <div class="entrar__hero">
        <span class="entrar__selo"><img src="/icones/icone-192.png" alt="" width="192" height="192"></span>
        <h1 class="entrar__hero-titulo">Orçamento<br>familiar</h1>
        <p class="entrar__hero-sub">Falta só confirmar seu email.</p>
      </div>

      <div class="entrar__cartao">
        <h2 class="entrar__titulo">Confirmar email</h2>
        <p class="entrar__subtitulo">Digite o código de 6 dígitos que mandamos para você.</p>

        <form class="entrar__campos" @submit.prevent="submeter">
          <label class="campo">
            <i class="ti ti-mail campo__icone"></i>
            <span class="campo__texto">
              <span class="campo__rotulo">EMAIL</span>
              <input
                v-model="email"
                type="email"
                name="email"
                autocomplete="username"
                placeholder="voce@email.com"
                required
                class="campo__entrada"
              >
            </span>
          </label>

          <label class="campo">
            <i class="ti ti-shield-lock campo__icone"></i>
            <span class="campo__texto">
              <span class="campo__rotulo">CÓDIGO</span>
              <input
                v-model="codigo"
                type="text"
                name="codigo"
                inputmode="numeric"
                autocomplete="one-time-code"
                pattern="[0-9]{6}"
                maxlength="6"
                placeholder="000000"
                required
                class="campo__entrada campo__entrada--codigo"
              >
            </span>
          </label>

          <p v-if="mensagem" class="entrar__mensagem entrar__mensagem--erro" role="status">
            <i class="ti ti-alert-circle"></i>
            <span>{{ mensagem }}</span>
          </p>

          <button type="submit" class="botao" :disabled="enviando">
            {{ enviando ? 'Confirmando…' : 'Confirmar e entrar' }}
          </button>
        </form>

        <p class="entrar__criar-conta">
          <span class="entrar__criar-conta-pergunta">Já confirmou antes?</span>
          <NuxtLink to="/entrar">Entrar</NuxtLink>
        </p>
      </div>
    </div>
  </div>
</template>

<style lang="scss" src="~/assets/scss/pages/entrar.scss" scoped></style>
