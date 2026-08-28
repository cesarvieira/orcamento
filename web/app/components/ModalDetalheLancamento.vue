<script setup lang="ts">
/**
 * O MODAL DE DETALHE — issue #53, história #18 (EF-04). Componente GLOBAL,
 * montado uma vez em `layouts/default.vue`, aberto de qualquer tela via
 * `useDetalheLancamento().abrir(lancamento)` (ver o cabeçalho de
 * `composables/useLancamentos.ts`) — no desenho, é o extrato quem abre
 * (`e.abrir`, recorte §5.5), mas a tarefa #54 é quem constrói o extrato.
 *
 * FONTE DE DESENHO: `.motor/recorte-desenho-18.md` §3 (não commitado,
 * artefato do condutor). 🟦 é desenho; 🟨 é anotação/decisão.
 *
 * ⚠️ A CAIXA DE EXCLUSÃO DE PARCELA É 🟨, NÃO 🟦. No desenho "Excluir" é UM
 * botão que apaga direto — coerente com o mockup, onde compra parcelada
 * gerava um lançamento só (EF-04 §4). O humano fechou o fork em 2026-08-27
 * (issue #53, "Forks" · `SKILL.md` "Forks — decididos pelo humano"): quando
 * o lançamento pertence a uma série, o detalhe PERGUNTA o alcance — `esta` ·
 * `todas` · `a partir desta`. Essa caixa NÃO existe no desenho; construída
 * no vocabulário visual das outras folhas do app (pílulas, `#14325a` sólido
 * para a ação "seguem-se as outras", contorno `#c62828` para a mais
 * destrutiva). Para um lançamento AVULSO (sem série), o clique em "Excluir"
 * continua batendo com o desenho: apaga direto, sem perguntar.
 *
 * `Lancamento.quantidadeParcelas` (issue #62) é o TOTAL de parcelas da
 * COMPRA ORIGINAL (`series_parcelas.quantidade`) — imutável à exclusão de
 * parcela, igual a `criadoPorMembroId` (RN-16). "Parcela N de M" usa esse
 * campo direto, sem chamada extra.
 *
 * ⚠️ A versão anterior deste arquivo CONTAVA lançamentos vivos com o mesmo
 * `serieParcelaId` (`GET /lancamentos` sem filtro) para achar M — e dava
 * número ERRADO: `excluirLancamento(id, 'esta')` apaga a linha sem
 * renumerar as irmãs (`api/src/modulos/lancamentos/servico.ts`). Numa
 * compra em 3×, excluir a parcela 2 deixa vivas as parcelas 1 e 3 — a
 * contagem dava 2, e a tela diria "Parcela 3 de 2". `quantidadeParcelas`
 * veio para resolver exatamente isto (issue #62).
 */
import type { Categoria, Conta, MembroDaFamilia, ModoDeExclusao } from '@orcamento/contrato';
import { classeDoIcone, useContas } from '~/composables/useContas';
import { classeDoIconeCategoria } from '~/composables/useOrcamento';
import { corDoTipo, useDetalheLancamento, useLancamentos } from '~/composables/useLancamentos';
import { formatarCentavos } from '~/utils/dinheiro';

const { lancamento, fechar } = useDetalheLancamento();
const { listarCategorias, listarMembrosDaFamilia, excluirLancamento } = useLancamentos();
const { listarContas } = useContas();

const categorias = ref<Categoria[]>([]);
const contas = ref<Conta[]>([]);
const membros = ref<MembroDaFamilia[]>([]);

/** `'padrao'` mostra o detalhe; `'escolher'` mostra a caixa de alcance (🟨, ver comentário acima). */
const modo = ref<'padrao' | 'escolher'>('padrao');
const excluindo = ref(false);
const erro = ref<string | null>(null);

watch(
  lancamento,
  async novo => {
    modo.value = 'padrao';
    erro.value = null;
    if (!novo) return;

    if (categorias.value.length === 0) categorias.value = await listarCategorias();
    if (contas.value.length === 0) contas.value = (await listarContas()).contas;
    if (membros.value.length === 0) membros.value = await listarMembrosDaFamilia();
  },
  { immediate: true },
);

const categoria = computed(() =>
  lancamento.value?.categoriaId ? (categorias.value.find(c => c.id === lancamento.value!.categoriaId) ?? null) : null,
);
const conta = computed(() => contas.value.find(c => c.id === lancamento.value?.contaId) ?? null);
const contaDestino = computed(() =>
  lancamento.value?.contaDestinoId
    ? (contas.value.find(c => c.id === lancamento.value!.contaDestinoId) ?? null)
    : null,
);
const quem = computed(() => {
  const membro = membros.value.find(m => m.id === lancamento.value?.criadoPorMembroId);
  return membro?.nome ?? '—';
});

const corValor = computed(() => (lancamento.value ? corDoTipo(lancamento.value.tipo) : 'var(--texto)'));

/**
 * `AAAA-MM-DD` → `DD/MM/AAAA`. Fatiamento de string, de propósito:
 * `new Date(texto)` interpreta como UTC e pode voltar um dia.
 */
function formatarData(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split('-');
  return `${dia}/${mes}/${ano}`;
}

/**
 * `parcelaStr` do recorte (§3) — texto sai da regra, não do mockup.
 * `quantidadeParcelas` é a compra original (ver comentário no topo do arquivo).
 */
const parcelaStr = computed(() => {
  const numero = lancamento.value?.numeroParcela;
  const total = lancamento.value?.quantidadeParcelas;
  if (!numero) return '';
  return total ? `Parcela ${numero} de ${total}` : `Parcela ${numero}`;
});

// ── EXCLUIR — 🟨 fork fechado pelo humano, ver comentário no topo do arquivo ──

function clicarExcluir(): void {
  if (!lancamento.value) return;
  if (lancamento.value.serieParcelaId) {
    modo.value = 'escolher';
    return;
  }
  void executarExclusao('esta');
}

function cancelarEscolha(): void {
  modo.value = 'padrao';
}

async function executarExclusao(alcance: ModoDeExclusao): Promise<void> {
  if (!lancamento.value || excluindo.value) return;
  excluindo.value = true;
  erro.value = null;
  try {
    await excluirLancamento(lancamento.value.id, alcance);
    // Regra inviolável #4: nenhuma leitura para refazer AQUI — quem mostra
    // lista (visão do mês/extrato, tarefa #54) reage à invalidação do
    // recurso `lancamentos` que o servidor emite depois deste DELETE.
    fechar();
  } catch (e) {
    erro.value = mensagemDoErro(e, 'Não consegui excluir o lançamento.');
  } finally {
    excluindo.value = false;
  }
}
</script>

<template>
  <div v-if="lancamento" class="detalhe-fundo" @click.self="fechar">
    <div class="detalhe">
      <div class="detalhe__selo">LANÇAMENTO</div>
      <p class="detalhe__desc">{{ lancamento.descricao }}</p>
      <p class="detalhe__valor" :style="{ color: corValor }">{{ formatarCentavos(lancamento.valorCentavos) }}</p>

      <div class="detalhe__linhas">
        <div v-if="categoria" class="detalhe__linha">
          <span class="detalhe__rotulo">Categoria</span>
          <span class="detalhe__valor-linha">
            <span class="detalhe__icone" :style="{ background: categoria.cor }">
              <i class="ti" :class="classeDoIconeCategoria(categoria.icone)"></i>
            </span>
            {{ categoria.nome }}
          </span>
        </div>

        <div class="detalhe__linha">
          <span class="detalhe__rotulo">{{ lancamento.tipo === 'TRANSFERENCIA' ? 'Conta de origem' : 'Conta' }}</span>
          <span class="detalhe__valor-linha">
            <span v-if="conta" class="detalhe__icone" :style="{ background: conta.cor }">
              <i class="ti" :class="classeDoIcone(conta.icone)"></i>
            </span>
            {{ conta?.nome ?? '—' }}
          </span>
        </div>

        <!-- 🟨 Sem fonte no desenho — transferência não existe no protótipo (EF-04 §4). -->
        <div v-if="lancamento.tipo === 'TRANSFERENCIA'" class="detalhe__linha">
          <span class="detalhe__rotulo">Conta de destino</span>
          <span class="detalhe__valor-linha">
            <span v-if="contaDestino" class="detalhe__icone" :style="{ background: contaDestino.cor }">
              <i class="ti" :class="classeDoIcone(contaDestino.icone)"></i>
            </span>
            {{ contaDestino?.nome ?? '—' }}
          </span>
        </div>

        <div class="detalhe__linha">
          <span class="detalhe__rotulo">Data</span>
          <span class="detalhe__valor-linha">{{ formatarData(lancamento.data) }}</span>
        </div>

        <div class="detalhe__linha">
          <span class="detalhe__rotulo">Lançado por</span>
          <span class="detalhe__valor-linha">{{ quem }}</span>
        </div>

        <div v-if="lancamento.serieParcelaId" class="detalhe__linha">
          <span class="detalhe__rotulo">Parcelamento</span>
          <span class="detalhe__valor-linha">{{ parcelaStr }}</span>
        </div>
      </div>

      <p v-if="erro" class="detalhe__erro" role="alert">{{ erro }}</p>

      <!-- ── rodapé padrão (recorte §3) ─────────────────────────────────────── -->
      <div v-if="modo === 'padrao'" class="detalhe__rodape">
        <button type="button" class="detalhe__botao detalhe__botao--excluir" :disabled="excluindo" @click="clicarExcluir">
          {{ excluindo ? 'Excluindo…' : 'Excluir' }}
        </button>
        <button type="button" class="detalhe__botao detalhe__botao--fechar" @click="fechar">Fechar</button>
      </div>

      <!-- ── caixa de alcance — 🟨 decisão do humano, NÃO existe no desenho ──── -->
      <template v-else>
        <p class="detalhe__pergunta">Este lançamento é parte de uma série. O que você quer excluir?</p>
        <div class="detalhe__escolhas">
          <button
            type="button"
            class="detalhe__botao detalhe__botao--fechar"
            :disabled="excluindo"
            @click="executarExclusao('esta')"
          >
            Só esta parcela
          </button>
          <button
            type="button"
            class="detalhe__botao detalhe__botao--fechar"
            :disabled="excluindo"
            @click="executarExclusao('a-partir-desta')"
          >
            Esta e as próximas
          </button>
          <button
            type="button"
            class="detalhe__botao detalhe__botao--excluir"
            :disabled="excluindo"
            @click="executarExclusao('todas')"
          >
            Todas as parcelas da série
          </button>
        </div>
        <button type="button" class="detalhe__cancelar" :disabled="excluindo" @click="cancelarEscolha">Cancelar</button>
      </template>
    </div>
  </div>
</template>

<style lang="scss" src="~/assets/scss/components/modal-detalhe-lancamento.scss" scoped></style>
