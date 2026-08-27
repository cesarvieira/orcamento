<script setup lang="ts">
/**
 * RECUPERAR A SENHA — RN-12 a RN-16 (EF-01 §3).
 *
 * Rota pública: quem chega aqui não consegue entrar, é esse o problema.
 *
 * Duas etapas na MESMA tela, como `/criar-conta` faz com o aviso de
 * confirmação: pede o email, depois pede código + senha nova. Não navega
 * entre páginas porque o código chega enquanto a pessoa está aqui.
 *
 * RN-13 — a API responde igual exista ou não a conta, e a tela repete essa
 * resposta sem interpretar. Um "esse email não tem conta" aqui reabriria pelo
 * front o oráculo que o backend fechou.
 */
definePageMeta({ layout: false });

const { pedirRecuperacao, concluirRecuperacao } = useConta();

const etapa = ref<'email' | 'codigo'>('email');
const email = ref('');
const codigo = ref('');
const senha = ref('');
const verSenha = ref(false);
const enviando = ref(false);
const mensagem = ref<string | null>(null);
const ehErro = ref(false);

async function pedir(): Promise<void> {
  if (enviando.value) return;
  mensagem.value = null;
  ehErro.value = false;
  enviando.value = true;
  try {
    const resposta = await pedirRecuperacao(email.value.trim());
    etapa.value = 'codigo';
    // A mensagem é a da API, palavra por palavra (RN-13).
    mensagem.value = resposta.mensagem;
  } catch (erro) {
    ehErro.value = true;
    mensagem.value = mensagemDoErro(erro, 'Não consegui pedir a recuperação.');
  } finally {
    enviando.value = false;
  }
}

async function concluir(): Promise<void> {
  if (enviando.value) return;
  mensagem.value = null;
  ehErro.value = false;
  enviando.value = true;
  try {
    await concluirRecuperacao({
      email: email.value.trim(),
      codigo: codigo.value.trim(),
      senha: senha.value,
    });
    await navigateTo('/');
  } catch (erro) {
    ehErro.value = true;
    mensagem.value = mensagemDoErro(erro, 'Não consegui trocar a senha.');
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <div class="entrar">
    <div class="entrar__coluna">
      <div class="entrar__hero">
        <span class="entrar__selo"><i class="ti ti-home-dollar"></i></span>
        <h1 class="entrar__hero-titulo">Orçamento<br>familiar</h1>
        <p class="entrar__hero-sub">Vamos recuperar seu acesso.</p>
      </div>

      <div class="entrar__cartao">
        <template v-if="etapa === 'email'">
          <h2 class="entrar__titulo">Esqueci minha senha</h2>
          <p class="entrar__subtitulo">Diga seu email e mandamos um código de 6 dígitos.</p>

          <form class="entrar__campos" @submit.prevent="pedir">
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

            <p v-if="mensagem" class="entrar__mensagem" :class="{ 'entrar__mensagem--erro': ehErro }" role="status">
              <i class="ti" :class="ehErro ? 'ti-alert-circle' : 'ti-info-circle'"></i>
              <span>{{ mensagem }}</span>
            </p>

            <button type="submit" class="botao" :disabled="enviando">
              {{ enviando ? 'Enviando…' : 'Enviar código' }}
            </button>
          </form>
        </template>

        <template v-else>
          <h2 class="entrar__titulo">Escolha a senha nova</h2>
          <p class="entrar__subtitulo">
            Digite o código que mandamos e a senha que você vai usar a partir de agora.
          </p>

          <form class="entrar__campos" @submit.prevent="concluir">
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

            <label class="campo">
              <i class="ti ti-lock campo__icone"></i>
              <span class="campo__texto">
                <span class="campo__rotulo">SENHA NOVA (MÍNIMO 8)</span>
                <input
                  v-model="senha"
                  :type="verSenha ? 'text' : 'password'"
                  name="senha"
                  autocomplete="new-password"
                  placeholder="••••••••"
                  required
                  minlength="8"
                  class="campo__entrada"
                >
              </span>
              <button type="button" class="campo__olho" @click="verSenha = !verSenha">
                <i class="ti" :class="verSenha ? 'ti-eye-off' : 'ti-eye'"></i>
              </button>
            </label>

            <p v-if="mensagem" class="entrar__mensagem" :class="{ 'entrar__mensagem--erro': ehErro }" role="status">
              <i class="ti" :class="ehErro ? 'ti-alert-circle' : 'ti-info-circle'"></i>
              <span>{{ mensagem }}</span>
            </p>

            <!-- RN-14: dito antes de acontecer, não depois. -->
            <p class="entrar__subtitulo">
              Ao trocar a senha, todos os aparelhos conectados nesta conta são desconectados.
            </p>

            <button type="submit" class="botao" :disabled="enviando">
              {{ enviando ? 'Trocando…' : 'Trocar senha e entrar' }}
            </button>
          </form>

          <p class="entrar__criar-conta">
            <span class="entrar__criar-conta-pergunta">Não chegou?</span>
            <button type="button" class="entrar__link" :disabled="enviando" @click="etapa = 'email'">
              Pedir outro código
            </button>
          </p>
        </template>

        <p class="entrar__criar-conta">
          <span class="entrar__criar-conta-pergunta">Lembrou a senha?</span>
          <NuxtLink to="/entrar">Entrar</NuxtLink>
        </p>
      </div>
    </div>
  </div>
</template>

<style lang="scss" src="~/assets/scss/pages/entrar.scss" scoped></style>
