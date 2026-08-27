<script setup lang="ts">
/**
 * CONTAS (EF-02) — a tela `contas` + a folha `sheetConta` do mockup.
 *
 * O mockup é FONTE, não ilustração, e vive no Claude Design — o link está em
 * `.preator/CONTEXT.md`. Abrir exige consentimento por sessão; não improvise a
 * tela a partir deste arquivo.
 *
 * O título "Contas" já vem do shell (`layouts/default.vue`, via
 * `config/navegacao.ts` — a rota `/contas` resolve certo em `destinoDaRota`),
 * então esta tela só acrescenta o subtítulo do desenho. Duplicar o título
 * aqui empilharia "Contas" duas vezes.
 *
 * `saldoCentavos` e `totalEmContaHojeCentavos` são DERIVADOS pelo servidor —
 * esta tela só formata para exibir (D-06), nunca recalcula (regra inviolável
 * #4 do projeto).
 */
import type { AtualizarConta, Conta, NovaConta } from '@orcamento/contrato';
import { classeDoIcone, ICONES_CONTA, MAPA_COR_POR_TIPO, TIPOS_CONTA, useContas } from '~/composables/useContas';

const { listarContas, criarConta, atualizarConta, excluirConta } = useContas();

// ── LISTA ────────────────────────────────────────────────────────────────

const contas = ref<Conta[]>([]);
const totalHojeCentavos = ref(0);
const carregando = ref(true);
const erroLista = ref<string | null>(null);

async function carregar(): Promise<void> {
  try {
    const resposta = await listarContas();
    contas.value = resposta.contas;
    totalHojeCentavos.value = resposta.totalEmContaHojeCentavos;
    erroLista.value = null;
  } catch (erro) {
    erroLista.value = mensagemDoErro(erro, 'Não consegui carregar as contas.');
  } finally {
    carregando.value = false;
  }
}

onMounted(carregar);

// Tempo real (EF-00 R2-R5, ver `composables/useRealtime.ts`): ao chegar
// invalidação do recurso "contas" — ou ao reconectar —, refaz a leitura. O
// próprio eco desta aba já é descartado pelo `useRealtime`; as mutações que
// ESTA aba faz se resolvem chamando `carregar()` direto após a resposta HTTP
// (abaixo), sem esperar o socket.
useRealtime({
  recursos: ['contas'],
  aoInvalidar: async () => {
    await carregar();
  },
});

/** Centavos → reais. Só aqui, na borda (D-06) — nunca no composable. */
function formatarCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * A linha de apoio de cada conta (`a.sub` no mockup) — o protótipo a manda
 * pronta; aqui é a tela quem a monta, a partir de dados que a API já devolve
 * (nunca uma string formatada vinda do servidor).
 */
function subDaConta(conta: Conta): string {
  if (conta.tipo === 'CREDITO') return `Fecha dia ${conta.diaFechamento} · vence dia ${conta.diaVencimento}`;
  if (conta.tipo === 'RESERVA') return 'Fora do orçamento'; // RN-07 — não entra no lastro
  return 'Conta corrente';
}

/** A cor do valor (`a.corValor` no mockup): vermelho só quando o saldo está negativo. */
function corDoValor(conta: Conta): string {
  return conta.saldoCentavos < 0 ? 'var(--alerta)' : 'var(--texto)';
}

// ── FOLHA (sheetConta) ───────────────────────────────────────────────────

const sheetAberta = ref(false);
const editando = ref<Conta | null>(null);
const salvando = ref(false);
const excluindo = ref(false);
const erroSheet = ref<string | null>(null);

const nome = ref('');
const tipo = ref<Conta['tipo']>('DEBITO');
/** Saldo atual (DEBITO/RESERVA) OU limite do cartão (CREDITO) — um valor só, o rótulo muda com o tipo. */
const valorCentavos = ref(0);
const diaVencimento = ref(10);
const diaFechamento = ref(20);
const icone = ref<string>(ICONES_CONTA[0]!);

const tituloSheet = computed(() => (editando.value ? 'Editar conta' : 'Nova conta'));
const podeExcluir = computed(() => editando.value !== null);

/** EF-02 §3: o rótulo do valor muda com o tipo. */
const valorLabel = computed(() => (tipo.value === 'CREDITO' ? 'Limite do cartão' : 'Saldo atual'));
const valorSub = computed(() => {
  if (tipo.value === 'CREDITO') return 'o teto de gasto desta fatura';
  if (tipo.value === 'RESERVA') return 'quanto já está guardado aqui';
  return 'o saldo desta conta hoje';
});

const labelBotaoSalvar = computed(() => {
  if (salvando.value) return 'Salvando…';
  return editando.value ? 'Salvar alterações' : 'Cadastrar conta';
});

// O desenho só tem stepper para o valor, sem campo numérico (ver
// a folha `sheetConta` do mockup) — R$10 por clique é um passo prático para um
// valor já perto do certo; não há especificação de passo no mockup.
const PASSO_VALOR_CENTAVOS = 1000;

function valorMenos(): void {
  valorCentavos.value = Math.max(0, valorCentavos.value - PASSO_VALOR_CENTAVOS);
}
function valorMais(): void {
  valorCentavos.value += PASSO_VALOR_CENTAVOS;
}

/** RN-08 — 1 a 28. */
function clampeDia(dia: number): number {
  return Math.min(28, Math.max(1, dia));
}
function vencimentoMenos(): void {
  diaVencimento.value = clampeDia(diaVencimento.value - 1);
}
function vencimentoMais(): void {
  diaVencimento.value = clampeDia(diaVencimento.value + 1);
}
function fechamentoMenos(): void {
  diaFechamento.value = clampeDia(diaFechamento.value - 1);
}
function fechamentoMais(): void {
  diaFechamento.value = clampeDia(diaFechamento.value + 1);
}

function abrirNova(): void {
  editando.value = null;
  nome.value = '';
  tipo.value = 'DEBITO';
  valorCentavos.value = 0;
  diaVencimento.value = 10;
  diaFechamento.value = 20;
  icone.value = ICONES_CONTA[0]!;
  erroSheet.value = null;
  sheetAberta.value = true;
}

function abrirEdicao(conta: Conta): void {
  editando.value = conta;
  nome.value = conta.nome;
  tipo.value = conta.tipo;
  valorCentavos.value = (conta.tipo === 'CREDITO' ? conta.limiteCentavos : conta.saldoInicialCentavos) ?? 0;
  diaVencimento.value = conta.diaVencimento ?? 10;
  diaFechamento.value = conta.diaFechamento ?? 20;
  icone.value = conta.icone;
  erroSheet.value = null;
  sheetAberta.value = true;
}

function fecharSheet(): void {
  sheetAberta.value = false;
}

async function salvar(): Promise<void> {
  if (salvando.value) return;

  const nomeAparado = nome.value.trim();
  if (!nomeAparado) {
    erroSheet.value = 'Dê um nome para a conta.';
    return;
  }

  const tipoAtual = tipo.value;
  let corpo: NovaConta | AtualizarConta;
  if (tipoAtual === 'CREDITO') {
    corpo = {
      tipo: 'CREDITO',
      nome: nomeAparado,
      icone: icone.value,
      cor: MAPA_COR_POR_TIPO.CREDITO,
      limiteCentavos: valorCentavos.value,
      diaFechamento: diaFechamento.value,
      diaVencimento: diaVencimento.value,
    };
  } else {
    corpo = {
      tipo: tipoAtual,
      nome: nomeAparado,
      icone: icone.value,
      cor: MAPA_COR_POR_TIPO[tipoAtual],
      saldoInicialCentavos: valorCentavos.value,
    };
  }

  salvando.value = true;
  erroSheet.value = null;
  try {
    if (editando.value) {
      await atualizarConta(editando.value.id, corpo);
    } else {
      await criarConta(corpo);
    }
    // Sem recalcular nada aqui (regra inviolável #4): refaz a leitura para
    // pegar o saldo derivado e o total "em conta hoje" recomputados no servidor.
    await carregar();
    sheetAberta.value = false;
  } catch (erro) {
    erroSheet.value = mensagemDoErro(erro, 'Não consegui salvar a conta.');
  } finally {
    salvando.value = false;
  }
}

async function excluir(): Promise<void> {
  if (!editando.value || excluindo.value) return;

  excluindo.value = true;
  erroSheet.value = null;
  try {
    await excluirConta(editando.value.id);
    await carregar();
    sheetAberta.value = false;
  } catch (erro) {
    // RN-06 (409 conta_com_lancamentos) e 404 chegam aqui — a tela mostra a
    // mensagem que a API devolveu, nunca um texto inventado.
    erroSheet.value = mensagemDoErro(erro, 'Não consegui excluir a conta.');
  } finally {
    excluindo.value = false;
  }
}
</script>

<template>
  <section class="contas">
    <p class="contas__subtitulo">Saldo real, não o previsto</p>

    <div class="contas__resumo">
      <div class="contas__resumo-rotulo">EM CONTA HOJE</div>
      <div class="contas__resumo-valor">{{ formatarCentavos(totalHojeCentavos) }}</div>
      <div class="contas__resumo-aviso">Não inclui as contas reserva.</div>
    </div>

    <p v-if="carregando" class="contas__vazio">Carregando…</p>
    <p v-else-if="erroLista" class="contas__vazio contas__vazio--erro" role="alert">{{ erroLista }}</p>
    <p v-else-if="contas.length === 0" class="contas__vazio">Nenhuma conta cadastrada ainda.</p>

    <div v-else class="contas__lista">
      <div v-for="conta in contas" :key="conta.id" class="contas__cartao">
        <button type="button" class="contas__linha" @click="abrirEdicao(conta)">
          <span class="contas__icone" :style="{ background: conta.cor }">
            <i class="ti" :class="classeDoIcone(conta.icone)"></i>
          </span>
          <span class="contas__texto">
            <span class="contas__nome">{{ conta.nome }}</span>
            <span class="contas__sub">{{ subDaConta(conta) }}</span>
          </span>
          <span class="contas__valor" :style="{ color: corDoValor(conta) }">
            {{ formatarCentavos(conta.saldoCentavos) }}
          </span>
          <i class="ti ti-chevron-right contas__seta"></i>
        </button>
      </div>
    </div>

    <button type="button" class="contas__nova" @click="abrirNova">
      <i class="ti ti-plus"></i>
      Cadastrar conta
    </button>

    <!-- ── FOLHA · sheetConta ─────────────────────────────────────────────── -->
    <div v-if="sheetAberta" class="sheet-fundo" @click.self="fecharSheet">
      <div class="sheet">
        <div class="sheet__cabecalho">
          <span class="sheet__titulo">{{ tituloSheet }}</span>
          <button type="button" class="sheet__fechar" aria-label="Fechar" @click="fecharSheet">✕</button>
        </div>

        <input v-model="nome" type="text" placeholder="Nome da conta" class="sheet__nome">

        <div class="sheet__rotulo-secao">TIPO</div>
        <div class="sheet__tipos">
          <button
            v-for="t in TIPOS_CONTA"
            :key="t.valor"
            type="button"
            class="sheet__tipo"
            :class="{ 'sheet__tipo--ativo': tipo === t.valor }"
            @click="tipo = t.valor"
          >
            <i class="ti" :class="t.icone"></i>
            <span>{{ t.rotulo }}</span>
          </button>
        </div>

        <div class="sheet__cartao">
          <div class="sheet__cartao-rotulo">{{ valorLabel }}</div>
          <div class="sheet__cartao-sub">{{ valorSub }}</div>
          <div class="sheet__stepper">
            <button type="button" class="sheet__passo" aria-label="Diminuir" @click="valorMenos">−</button>
            <div class="sheet__stepper-valor">{{ formatarCentavos(valorCentavos) }}</div>
            <button type="button" class="sheet__passo" aria-label="Aumentar" @click="valorMais">+</button>
          </div>
        </div>

        <div v-if="tipo === 'CREDITO'" class="sheet__cartao">
          <div class="sheet__linha-dia">
            <div class="sheet__dia-texto">
              <div class="sheet__cartao-rotulo">Vencimento da fatura</div>
              <div class="sheet__cartao-sub">dia do débito na conta</div>
            </div>
            <button type="button" class="sheet__passo sheet__passo--pequeno" aria-label="Diminuir" @click="vencimentoMenos">−</button>
            <div class="sheet__dia-valor">Dia {{ diaVencimento }}</div>
            <button type="button" class="sheet__passo sheet__passo--pequeno" aria-label="Aumentar" @click="vencimentoMais">+</button>
          </div>
          <div class="sheet__linha-dia sheet__linha-dia--com-topo">
            <div class="sheet__dia-texto">
              <div class="sheet__cartao-rotulo">Fechamento</div>
              <div class="sheet__cartao-sub">até quando as compras entram nesta fatura</div>
            </div>
            <button type="button" class="sheet__passo sheet__passo--pequeno" aria-label="Diminuir" @click="fechamentoMenos">−</button>
            <div class="sheet__dia-valor">Dia {{ diaFechamento }}</div>
            <button type="button" class="sheet__passo sheet__passo--pequeno" aria-label="Aumentar" @click="fechamentoMais">+</button>
          </div>
        </div>

        <div class="sheet__rotulo-secao">ÍCONE</div>
        <div class="sheet__icones">
          <button
            v-for="chave in ICONES_CONTA"
            :key="chave"
            type="button"
            class="sheet__icone-opcao"
            :class="{ 'sheet__icone-opcao--ativo': icone === chave }"
            :aria-label="chave"
            @click="icone = chave"
          >
            <i class="ti" :class="classeDoIcone(chave)"></i>
          </button>
        </div>

        <p v-if="erroSheet" class="sheet__erro" role="alert">{{ erroSheet }}</p>

        <button type="button" class="botao sheet__salvar" :disabled="salvando" @click="salvar">
          {{ labelBotaoSalvar }}
        </button>

        <button
          v-if="podeExcluir"
          type="button"
          class="sheet__excluir"
          :disabled="excluindo"
          @click="excluir"
        >
          {{ excluindo ? 'Excluindo…' : 'Excluir conta' }}
        </button>
      </div>
    </div>
  </section>
</template>

<style lang="scss" src="~/assets/scss/pages/contas.scss" scoped></style>
