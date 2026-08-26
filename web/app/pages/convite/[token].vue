<script setup lang="ts">
/**
 * ACEITAR CONVITE — `/convite/:token` (EF-01, §3).
 *
 * Rota pública (ver `middleware/sessao.global.ts`): quem chega aqui ainda não
 * tem sessão. Sem mockup para esta tela (a EF diz isso — a única cuja
 * superfície não vem do desenho): usa o MESMO sistema visual do shell, no
 * layout `limpo` que a EF-00 já reservou para telas de acesso.
 *
 * Dois métodos de aceite, os dois definidos no contrato `AceitarConvite`:
 * `senha` (nome + email + senha) e `google` (idToken do GIS). RN-02/RN-03 são
 * decisão do backend — a mensagem de erro é sempre a que a API mandou, nunca
 * um texto inventado aqui.
 */
definePageMeta({ layout: 'limpo' });

const rota = useRoute();
const token = computed(() => String(rota.params.token));

const { aceitarConvite, recusarConvite } = useConvite();
const { disponivel: googleDisponivel, obterIdToken } = useGoogle();

const nome = ref('');
const email = ref('');
const senha = ref('');
const verSenha = ref(false);
const enviando = ref(false);
const recusado = ref(false);
const mensagem = ref<string | null>(null);
const ehErro = ref(false);

async function aceitarComSenha(): Promise<void> {
  if (enviando.value) return;
  mensagem.value = null;
  ehErro.value = false;
  enviando.value = true;
  try {
    await aceitarConvite(token.value, {
      metodo: 'senha',
      nome: nome.value.trim(),
      email: email.value.trim(),
      senha: senha.value,
    });
    await navigateTo('/');
  } catch (erro) {
    ehErro.value = true;
    mensagem.value = mensagemDoErro(erro, 'Não consegui aceitar o convite.');
  } finally {
    enviando.value = false;
  }
}

async function recusar(): Promise<void> {
  if (enviando.value) return;
  mensagem.value = null;
  ehErro.value = false;
  enviando.value = true;
  try {
    await recusarConvite(token.value);
    recusado.value = true;
    ehErro.value = false;
    mensagem.value = 'Convite recusado. Este email já pode criar a própria família.';
  } catch (erro) {
    ehErro.value = true;
    mensagem.value = mensagemDoErro(erro, 'Não consegui recusar o convite.');
  } finally {
    enviando.value = false;
  }
}

async function aceitarComGoogle(): Promise<void> {
  if (!googleDisponivel || enviando.value) return;
  mensagem.value = null;
  ehErro.value = false;
  enviando.value = true;
  try {
    const idToken = await obterIdToken();
    await aceitarConvite(token.value, { metodo: 'google', idToken });
    await navigateTo('/');
  } catch (erro) {
    ehErro.value = true;
    mensagem.value = mensagemDoErro(erro, 'Não consegui aceitar o convite com o Google.');
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <div class="convite">
    <span class="convite__selo"><i class="ti ti-home-dollar"></i></span>
    <h1 class="convite__titulo">Você foi convidado</h1>
    <p class="convite__subtitulo">Crie sua conta para entrar na família.</p>

    <form class="convite__campos" @submit.prevent="aceitarComSenha">
      <label class="campo">
        <i class="ti ti-user campo__icone"></i>
        <span class="campo__texto">
          <span class="campo__rotulo">NOME</span>
          <input
            v-model="nome"
            type="text"
            name="nome"
            autocomplete="name"
            placeholder="Seu nome"
            required
            class="campo__entrada"
          >
        </span>
      </label>

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
        <i class="ti ti-lock campo__icone"></i>
        <span class="campo__texto">
          <span class="campo__rotulo">SENHA</span>
          <input
            v-model="senha"
            :type="verSenha ? 'text' : 'password'"
            name="senha"
            autocomplete="new-password"
            placeholder="••••••••"
            required
            class="campo__entrada"
          >
        </span>
        <button type="button" class="campo__olho" @click="verSenha = !verSenha">
          <i class="ti" :class="verSenha ? 'ti-eye-off' : 'ti-eye'"></i>
        </button>
      </label>

      <p v-if="mensagem" class="convite__mensagem" :class="{ 'convite__mensagem--erro': ehErro }" role="status">
        <i class="ti" :class="ehErro ? 'ti-alert-circle' : 'ti-info-circle'"></i>
        <span>{{ mensagem }}</span>
      </p>

      <button type="submit" class="botao" :disabled="enviando">
        {{ enviando ? 'Entrando…' : 'Aceitar convite e entrar' }}
      </button>
    </form>

    <template v-if="googleDisponivel">
      <div class="convite__divisor"><span></span><span>ou</span><span></span></div>

      <button type="button" class="convite__google" :disabled="enviando" @click="aceitarComGoogle">
        <i class="ti ti-brand-google"></i><span>Aceitar com Google</span>
      </button>
    </template>

    <!-- RN-08: recusar libera este email para criar a própria família. -->
    <p v-if="!recusado" class="convite__recusar">
      <button type="button" :disabled="enviando" @click="recusar">Não quero entrar nesta família</button>
    </p>
  </div>
</template>

<style lang="scss" src="~/assets/scss/pages/convite.scss" scoped></style>
