<script setup lang="ts">
/**
 * CONVIDAR — dentro de Mais (EF-01, §3).
 *
 * Fluxo: email → `POST /convites` → mensagem de sucesso, e a lista de
 * convites pendentes (`GET /convites`, #35) aparece logo abaixo — fecha a
 * lacuna EF01-MC-001. Ao enviar um novo convite com sucesso, ele entra na
 * lista local direto (o corpo de `ConviteCriado` já tem o mesmo formato de
 * `ConvitePendente`), sem precisar de uma segunda ida à API.
 */
import type { ConvitePendente } from '@orcamento/contrato';

const { criarConvite, listarConvitesPendentes } = useConvite();

const email = ref('');
const enviando = ref(false);
const mensagem = ref<string | null>(null);
const ehErro = ref(false);

const convites = ref<ConvitePendente[]>([]);
const carregandoConvites = ref(true);

async function carregarConvites(): Promise<void> {
  carregandoConvites.value = true;
  try {
    convites.value = await listarConvitesPendentes();
  } catch {
    // A lista é informativa — se falhar, a tela ainda funciona para enviar
    // convites novos, só sem mostrar os pendentes.
    convites.value = [];
  } finally {
    carregandoConvites.value = false;
  }
}

onMounted(carregarConvites);

/** Ex.: "25/08/2026, 14:30". Formato local do navegador, sem lib nova. */
function formatarData(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function enviar(): Promise<void> {
  if (enviando.value) return;
  mensagem.value = null;
  ehErro.value = false;
  enviando.value = true;
  try {
    const convite = await criarConvite(email.value.trim());
    mensagem.value = `Convite enviado para ${convite.email} — expira em breve.`;
    email.value = '';
    convites.value = [convite, ...convites.value];
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

    <h3 class="convidar__subtitulo">Convites pendentes</h3>

    <p v-if="carregandoConvites" class="convidar__vazio">Carregando…</p>

    <p v-else-if="convites.length === 0" class="convidar__vazio">
      Nenhum convite pendente no momento.
    </p>

    <ul v-else class="lista">
      <li v-for="convite in convites" :key="convite.id" class="linha">
        <span class="linha__icone"><i class="ti ti-mail"></i></span>
        <span class="linha__texto">
          <span class="linha__titulo">{{ convite.email }}</span>
          <span class="linha__sub">Expira em {{ formatarData(convite.expiraEm) }}</span>
        </span>
      </li>
    </ul>
  </section>
</template>

<style lang="scss" src="~/assets/scss/pages/convidar.scss" scoped></style>
