<script setup lang="ts">
/**
 * CONFIRMAR O EMAIL DO CADASTRO — RN-06/RN-09 (EF-01 §3).
 *
 * Rota pública: quem chega aqui vem do email e ainda não tem sessão — é
 * justamente a confirmação que a abre.
 *
 * A confirmação dispara sozinha ao abrir: o clique no link do email JÁ é a
 * intenção. Pedir um segundo clique aqui não prova nada a mais.
 */
definePageMeta({ layout: false });

const rota = useRoute();
const { confirmarConta } = useConta();

const token = String(rota.params.token ?? '');
const estado = ref<'confirmando' | 'erro'>('confirmando');
const mensagem = ref<string | null>(null);

onMounted(async () => {
  try {
    await confirmarConta(token);
    await navigateTo('/');
  } catch (erro) {
    estado.value = 'erro';
    // A mensagem é da API — é ela que sabe se expirou ou se já foi usado.
    mensagem.value = mensagemDoErro(erro, 'Não consegui confirmar este email.');
  }
});
</script>

<template>
  <div class="entrar">
    <div class="entrar__coluna">
      <div class="entrar__cartao">
        <template v-if="estado === 'confirmando'">
          <h2 class="entrar__titulo">Confirmando…</h2>
          <p class="entrar__subtitulo">Só um instante, estamos validando seu email.</p>
        </template>

        <template v-else>
          <h2 class="entrar__titulo">Não deu para confirmar</h2>
          <p class="entrar__mensagem entrar__mensagem--erro" role="status">
            <i class="ti ti-alert-circle"></i>
            <span>{{ mensagem }}</span>
          </p>
          <p class="entrar__criar-conta">
            <span class="entrar__criar-conta-pergunta">Já confirmou antes?</span>
            <NuxtLink to="/entrar">Entrar</NuxtLink>
          </p>
        </template>
      </div>
    </div>
  </div>
</template>

<style lang="scss" src="~/assets/scss/pages/entrar.scss" scoped></style>
