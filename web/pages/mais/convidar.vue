<script setup lang="ts">
/**
 * CONVIDAR — dentro de Mais (EF-01, §3).
 *
 * Fluxo: email → `POST /convites` → mensagem de sucesso. Não existe uma lista
 * de convites pendentes aqui: a API (#32) tem `POST /convites` mas não tem
 * `GET /convites` — não há endpoint para listar. Isso é uma lacuna conhecida
 * da história, registrada pelo condutor na matriz de completude — não um fork
 * desta tarefa.
 */
const { criarConvite } = useConvite();

const email = ref('');
const enviando = ref(false);
const mensagem = ref<string | null>(null);
const ehErro = ref(false);

async function enviar(): Promise<void> {
  if (enviando.value) return;
  mensagem.value = null;
  ehErro.value = false;
  enviando.value = true;
  try {
    const convite = await criarConvite(email.value.trim());
    mensagem.value = `Convite enviado para ${convite.email} — expira em breve.`;
    email.value = '';
  } catch (erro) {
    ehErro.value = true;
    mensagem.value = mensagemDoErro(erro, 'Não consegui enviar o convite.');
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <section class="convidar">
    <p class="convidar__intro">
      A pessoa recebe um email com um link para entrar na família. O convite vale por um tempo
      limitado e serve para um único uso.
    </p>

    <form class="convidar__campos" @submit.prevent="enviar">
      <label class="campo">
        <i class="ti ti-mail campo__icone"></i>
        <span class="campo__texto">
          <span class="campo__rotulo">EMAIL DO CONVIDADO</span>
          <input
            v-model="email"
            type="email"
            name="email"
            placeholder="pessoa@email.com"
            required
            class="campo__entrada"
          >
        </span>
      </label>

      <p v-if="mensagem" class="convidar__mensagem" :class="{ 'convidar__mensagem--erro': ehErro }" role="status">
        <i class="ti" :class="ehErro ? 'ti-alert-circle' : 'ti-circle-check'"></i>
        <span>{{ mensagem }}</span>
      </p>

      <button type="submit" class="botao" :disabled="enviando">
        {{ enviando ? 'Enviando…' : 'Enviar convite' }}
      </button>
    </form>
  </section>
</template>

<style lang="scss" src="~/assets/scss/pages/convidar.scss" scoped></style>
