<script setup lang="ts">
import type { ResumoFechamento } from '@orcamento/contrato';
import { useFechamento } from '~/composables/useFechamento';
import { useCompetencia } from '~/composables/useCompetencia';
import { formatarCentavos } from '~/utils/dinheiro';

const { lerResumoFechamento, fecharCompetencia } = useFechamento();
const { competencia, rotulo: rotuloDoMesAtivo } = useCompetencia();

const carregando = ref(true);
const erroOperacao = ref<string | null>(null);
const mutando = ref(false);

const resumo = ref<ResumoFechamento | null>(null);

let leituraEmOrdem = 0;

async function carregar(): Promise<void> {
  const minhaOrdem = ++leituraEmOrdem;
  carregando.value = true;
  erroOperacao.value = null;
  try {
    const resposta = await lerResumoFechamento(competencia.value);
    if (minhaOrdem !== leituraEmOrdem) return;
    resumo.value = resposta;
  } catch (erro: any) {
    if (minhaOrdem !== leituraEmOrdem) return;
    erroOperacao.value = erro?.data?.mensagem || 'Não consegui carregar o resumo de fechamento.';
  } finally {
    if (minhaOrdem === leituraEmOrdem) carregando.value = false;
  }
}

onMounted(carregar);

watch(competencia, async () => {
  await carregar();
});

useRealtime({
  recursos: ['fechamento', 'orcamento', 'lancamento'],
  competenciaAtiva: computed(() => competencia.value),
  aoInvalidar: async () => {
    await carregar();
  },
});

async function confirmarFechamento(): Promise<void> {
  if (mutando.value || resumo.value?.status === 'fechado') return;
  mutando.value = true;
  erroOperacao.value = null;
  
  try {
    await fecharCompetencia(competencia.value);
    await carregar();
  } catch (erro: any) {
    erroOperacao.value = erro?.data?.mensagem || 'Não consegui fechar o mês.';
  } finally {
    mutando.value = false;
  }
}

const formatarData = (dataIso: string) => {
  return new Date(dataIso).toLocaleDateString('pt-BR');
};
</script>

<template>
  <section class="fechamento">
    <p class="fechamento__subtitulo">Fechamento do mês de {{ rotuloDoMesAtivo }}</p>

    <p v-if="carregando" class="fechamento__vazio">Carregando…</p>
    <p v-else-if="erroOperacao" class="fechamento__vazio fechamento__vazio--erro" role="alert">{{ erroOperacao }}</p>

    <template v-else-if="resumo">
      <div v-if="resumo.status === 'fechado'" class="fechamento__selo">
        <i class="ti ti-lock"></i>
        <span>
          Mês fechado em {{ resumo.fechadoEm ? formatarData(resumo.fechadoEm) : '' }}
        </span>
      </div>

      <div class="fechamento__cartoes">
        <div class="fechamento__cartao-resumo">
          <span class="fechamento__cartao-resumo-rotulo">Recebido</span>
          <span class="fechamento__cartao-resumo-valor">{{ formatarCentavos(resumo.recebidoCentavos) }}</span>
        </div>
        <div class="fechamento__cartao-resumo">
          <span class="fechamento__cartao-resumo-rotulo">Planejado</span>
          <span class="fechamento__cartao-resumo-valor">{{ formatarCentavos(resumo.planejadoCentavos) }}</span>
        </div>
        <div class="fechamento__cartao-resumo">
          <span class="fechamento__cartao-resumo-rotulo">Gasto</span>
          <span class="fechamento__cartao-resumo-valor">{{ formatarCentavos(resumo.gastoCentavos) }}</span>
        </div>
        <div class="fechamento__cartao-resumo">
          <span class="fechamento__cartao-resumo-rotulo">Sobra Projetada</span>
          <span class="fechamento__cartao-resumo-valor fechamento__cartao-resumo-valor--sobra">
            {{ formatarCentavos(resumo.sobraProjetadaCentavos) }}
          </span>
        </div>
      </div>

      <div v-if="resumo.categoriasEstouradas.length > 0" class="fechamento__estouradas">
        <h3 class="fechamento__estouradas-titulo">Passaram do teto</h3>
        <div class="fechamento__estouradas-lista">
          <div v-for="cat in resumo.categoriasEstouradas" :key="cat.id" class="fechamento__estouradas-item">
            <span class="fechamento__estouradas-item-nome">{{ cat.nome }}</span>
            <span class="fechamento__estouradas-item-valor">{{ formatarCentavos(Math.abs(cat.disponivelCentavos)) }}</span>
          </div>
        </div>
      </div>

      <div v-if="resumo.status === 'aberto'" class="fechamento__aviso">
        <i class="ti ti-alert-circle"></i>
        <p>Ao fechar o mês, a competência é selada e não aceitará novos lançamentos. A sobra permanece em caixa e entrará no lastro do mês seguinte.</p>
      </div>

      <button 
        v-if="resumo.status === 'aberto'"
        type="button" 
        class="botao" 
        :disabled="mutando" 
        @click="confirmarFechamento"
      >
        {{ mutando ? 'Fechando…' : 'Fechar mês' }}
      </button>
    </template>
  </section>
</template>

<style lang="scss" src="~/assets/scss/pages/fechamento.scss" scoped></style>
