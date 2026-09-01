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
 *
 * ═══════════════════════════════════════════════════════════════════════
 * HISTÓRIA #74 / TAREFA #110 — as "portas da fatura" no cartão de crédito:
 * ═══════════════════════════════════════════════════════════════════════
 *
 * 🟦 Do desenho (`.preator/tmp/recorte-desenho-74.md` §1/§2): a linha de dois
 * botões-pílula ("Ver fatura" / "Pagar fatura") dentro do cartão da conta, só
 * quando `conta.tipo === 'CREDITO'` (o `a.ehCartao` do mockup). "Ver fatura"
 * navega para `/faturas?contaId=<id>` — o consumidor já existe em
 * `faturas.vue:130` (`rota.query.contaId`), esta tela só manda o query certo,
 * NUNCA o fallback "primeiro cartão" que o mockup usa (`:1116`).
 *
 * 🟨 F1 · PAGAR SEM SAIR DA TELA — decisão humana (2026-08-31, recorte §5).
 * O botão sempre abre uma folha de confirmação (`sheetPagar` abaixo) com um
 * seletor de conta pagadora, reaproveitando o PADRÃO DE INTERAÇÃO que
 * `faturas.vue` já tem para D3 (`alternarSeletorContaPagadora`,
 * `escolherContaPagadora`, dropdown com `.lista`/`.linha--botao` globais) —
 * não é uma segunda UI de seleção. A conta pagadora nunca é fixada na
 * primeira `DEBITO`: ela vem pré-selecionada nesse lugar (mesmo default que
 * `faturas.vue` usa), mas o usuário PRECISA confirmar antes do POST — a
 * armadilha que a skill de negócio e a EF-05 §4 proíbem é pagar sem escolha
 * nenhuma, não ter um default editável. RN-24 (`faturas-e-ciclo-do-cartao`
 * SKILL.md): "Pagar é transferência (...) a conta pagadora é ESCOLHIDA (D3)".
 *
 * 🟨 F2 · QUAL FATURA O BOTÃO PAGA — decisão humana (2026-08-31, recorte §5).
 * Ao clicar, esta tela busca `GET /faturas?contaId=` (`useFaturas.listarFaturas`,
 * o único ponto de acesso HTTP a faturas — não redeclarado aqui) e decide:
 *   - 0 fatura `FECHADA` → mostra "Não há fatura em aberto nesse cartão."
 *     (a MESMA frase do 409 `fatura_sem_valor`, recorte §3) SEM disparar POST;
 *   - 1 fatura `FECHADA` → abre `sheetPagar` para ELA (a mais antiga —
 *     `listarFaturas` já devolve em ordem crescente, ver `useFaturas.ts`);
 *   - 2+ faturas `FECHADA` → navega para `/faturas?contaId=` em vez de pagar
 *     (lá cada bloco tem seu próprio botão) — mesmo critério que
 *     `faturas.vue#faturaParaBotaoNoCabecalho` já aplica
 *     (`faturasFechadas.length === 1`).
 * RN-25/RN-26/D1 (`faturas-e-ciclo-do-cartao` SKILL.md): "fatura em aberto" é
 * toda fatura não paga (`ABERTA` + `FECHADA`); só a `FECHADA` é PAGÁVEL — o
 * ciclo `ABERTA` só acumula (mesma fronteira que `faturas.vue#blocos` usa).
 *
 * 🟨 `faturaAviso` (recorte §4) — a 3ª linha do card "EM CONTA HOJE". O
 * número JÁ CHEGA derivado do servidor: `saldoCentavos` de uma conta
 * `CREDITO` é `−Σ(fatura em aberto, D1)` (RN-25, `expressaoSaldoDerivado`).
 * Esta tela só SOMA o que a lista de contas já tem em mão e FORMATA — nunca
 * chama `GET /faturas` por cartão para montar este aviso, e nunca recalcula
 * regra de lastro no front (regra inviolável #4). Decisão de LAYOUT (não de
 * regra, recorte §4): a posição da 3ª linha do desenho tem hoje o texto fixo
 * "Não inclui as contas reserva." (RN-07, acréscimo da tarefa #40) — as duas
 * continuam visíveis: `faturaAviso` na posição do desenho
 * (`.contas__resumo-aviso`), a nota de RN-07 logo abaixo
 * (`.contas__resumo-nota`, nova classe). Nenhuma das duas foi apagada.
 *
 * 🟨 Tempo real — `useRealtime` continua assinando só `['contas']`. A rota de
 * pagamento invalida `faturas` E `contas` juntos (`api/src/modulos/faturas/rotas.ts`),
 * mas esta tela não guarda nenhum estado de fatura entre cliques: a decisão
 * de F2 (quantas `FECHADA`s existem agora) é sempre uma leitura FRESCA no
 * instante do clique em "Pagar fatura", nunca um cache que uma invalidação
 * precisasse expirar. E o que ESTE arquivo exibe de fatura (`faturaAviso`) já
 * deriva de `saldoCentavos`, que é `contas`. Assinar `faturas` aqui não
 * mudaria nenhum dado na tela — por isso não foi adicionado.
 *
 * ⛔ `subDaConta()` NÃO foi tocada — a divergência dela com o mockup (`sub`
 * do cartão) é pré-existente (tarefa #40) e fora do §3 da história #74.
 */
import type { AtualizarConta, Conta, Fatura, NovaConta } from '@orcamento/contrato';
import { classeDoIcone, ICONES_CONTA, MAPA_COR_POR_TIPO, TIPOS_CONTA, useContas } from '~/composables/useContas';
import { useFaturas } from '~/composables/useFaturas';
import { hojeLocal } from '~/utils/data';
import { centavosParaTexto, formatarCentavos, textoParaCentavos } from '~/utils/dinheiro';

const { listarContas, criarConta, atualizarConta, excluirConta } = useContas();
const { listarFaturas, pagarFatura } = useFaturas();

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

/**
 * `faturaAviso` (recorte §4) — soma o que a lista JÁ TEM em mão e formata.
 * `saldoCentavos` de uma conta `CREDITO` é `−Σ(fatura em aberto, D1)`
 * (RN-25, `api/src/modulos/contas/servico.ts#expressaoSaldoDerivado`), então
 * nunca é positivo; a dívida em aberto de cada cartão é o seu negativo.
 * Nenhum `GET /faturas` aqui, nenhuma regra de lastro recalculada (regra
 * inviolável #4 do projeto).
 */
const faturaAviso = computed(() => {
  const totalEmAbertoCentavos = contas.value
    .filter(conta => conta.tipo === 'CREDITO')
    .reduce((total, conta) => total - conta.saldoCentavos, 0);
  return totalEmAbertoCentavos > 0
    ? `Faturas de ${formatarCentavos(totalEmAbertoCentavos)} ainda não debitadas`
    : 'Nenhuma fatura em aberto';
});

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

// ── AÇÕES DA FATURA — "Ver fatura" / "Pagar fatura" (história #74, #110) ──
// Só aparecem em `conta.tipo === 'CREDITO'` (`a.ehCartao` do mockup).

/** Porta 1 (recorte §2): navega com o `contaId` DESTE cartão, nunca o fallback "primeiro cartão". */
function verFatura(conta: Conta): void {
  void navigateTo(`/faturas?contaId=${conta.id}`);
}

const contasDebito = computed(() => contas.value.filter(conta => conta.tipo === 'DEBITO'));

const verificandoFaturaId = ref<string | null>(null);
const avisoPagamento = ref<{ contaId: string; texto: string } | null>(null);

/**
 * F2 (decisão humana 2026-08-31, recorte §5): decide, na hora do clique,
 * qual fatura o botão único paga — nunca um estado guardado entre cliques
 * (ver o porquê no cabeçalho do arquivo, seção "Tempo real").
 */
async function pagarFaturaDoCartao(conta: Conta): Promise<void> {
  if (verificandoFaturaId.value) return;

  avisoPagamento.value = null;
  verificandoFaturaId.value = conta.id;
  try {
    const resposta = await listarFaturas(conta.id);
    const fechadas = resposta.faturas.filter(f => f.status === 'FECHADA');

    if (fechadas.length === 0) {
      // A MESMA frase do 409 `fatura_sem_valor` (recorte §3) — nunca inventada aqui.
      avisoPagamento.value = { contaId: conta.id, texto: 'Não há fatura em aberto nesse cartão.' };
      return;
    }

    if (fechadas.length >= 2) {
      // 2+ fechadas: cada uma precisa do próprio botão — vai para `/faturas`,
      // mesmo critério de `faturas.vue#faturaParaBotaoNoCabecalho`.
      await navigateTo(`/faturas?contaId=${conta.id}`);
      return;
    }

    // Exatamente uma — `listarFaturas` devolve em ordem crescente
    // (`useFaturas.ts`), então a única `FECHADA` já é a mais antiga.
    abrirSheetPagar(conta, fechadas[0]!);
  } catch (erro) {
    avisoPagamento.value = { contaId: conta.id, texto: mensagemDoErro(erro, 'Não consegui verificar a fatura.') };
  } finally {
    verificandoFaturaId.value = null;
  }
}

// ── FOLHA (sheetPagar) — F1, decisão humana 2026-08-31 ───────────────────
// Reaproveita o markup/CSS genéricos de `sheetConta` (`.sheet`,
// `.sheet__cabecalho`, `.sheet__cartao`, `.sheet__erro`, `.botao`) e o PADRÃO
// de interação do seletor de conta pagadora que `faturas.vue` já tem (D3) —
// não é uma segunda UI de seleção.

const sheetPagarAberta = ref(false);
const cartaoParaPagar = ref<Conta | null>(null);
const faturaParaPagar = ref<Fatura | null>(null);
const contaPagadoraId = ref<string | null>(null);
const seletorContaPagadoraAberto = ref(false);
const pagando = ref(false);
const erroPagar = ref<string | null>(null);

const contaPagadoraSelecionada = computed(() => contasDebito.value.find(c => c.id === contaPagadoraId.value) ?? null);

function abrirSheetPagar(conta: Conta, fatura: Fatura): void {
  cartaoParaPagar.value = conta;
  faturaParaPagar.value = fatura;
  // Pré-selecionada na primeira `DEBITO` (mesmo default de `faturas.vue`),
  // mas o usuário PRECISA confirmar antes do POST — a folha não paga sozinha.
  contaPagadoraId.value = contasDebito.value[0]?.id ?? null;
  seletorContaPagadoraAberto.value = false;
  erroPagar.value = null;
  sheetPagarAberta.value = true;
}

function fecharSheetPagar(): void {
  sheetPagarAberta.value = false;
}

function alternarSeletorContaPagadora(): void {
  seletorContaPagadoraAberto.value = !seletorContaPagadoraAberto.value;
}
function fecharSeletorContaPagadora(): void {
  seletorContaPagadoraAberto.value = false;
}
function escolherContaPagadora(id: string): void {
  contaPagadoraId.value = id;
  seletorContaPagadoraAberto.value = false;
}

/** RN-24/D3 — gera a TRANSFERENCIA (conta pagadora → cartão); não reatribui lançamento nenhum. */
async function confirmarPagamento(): Promise<void> {
  if (pagando.value || !faturaParaPagar.value) return;

  const conta = contaPagadoraSelecionada.value;
  if (!conta) {
    erroPagar.value = 'Escolha uma conta para pagar.';
    return;
  }

  pagando.value = true;
  erroPagar.value = null;
  try {
    // D6 — a data do pagamento vem do CLIENTE, nunca do relógio do servidor.
    await pagarFatura(faturaParaPagar.value.id, { pagaComContaId: conta.id, data: hojeLocal() });
    // Sem recalcular nada aqui (regra inviolável #4): refaz a leitura para
    // pegar o saldo/limite derivados e recomputados no servidor.
    await carregar();
    sheetPagarAberta.value = false;
  } catch (erro) {
    // 409 `fatura_sem_valor` (ou qualquer outro erro da API) chega aqui como
    // a própria API devolveu — nunca um texto inventado.
    erroPagar.value = mensagemDoErro(erro, 'Não consegui pagar a fatura.');
  } finally {
    pagando.value = false;
  }
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

// O desenho só tem stepper (−/+), sem campo digitável. O stepper continua —
// R$10 por clique, prático para ajustar um valor já perto do certo —, mas o
// número no meio virou INPUT por decisão do humano (2026-08-27): com só o
// stepper, digitar um valor quebrado como R$ 1.234,56 custaria 124 cliques.
// Divergir do mockup aqui é escolha registrada, não descuido.
const PASSO_VALOR_CENTAVOS = 1000;

/**
 * O que o usuário vê e edita. `valorCentavos` continua sendo a verdade em
 * INTEIRO (D-06); este texto é só a borda, e só ela conhece vírgula e ponto.
 */
const valorTexto = ref(formatarCentavos(0));
const editandoValor = ref(false);


/** Enquanto o campo tem foco, o texto é do usuário — não o reformate embaixo dele. */
watch(valorTexto, texto => {
  if (editandoValor.value) valorCentavos.value = textoParaCentavos(texto);
});

watch(valorCentavos, centavos => {
  if (!editandoValor.value) valorTexto.value = centavosParaTexto(centavos);
});

function aoFocarValor(): void {
  editandoValor.value = true;
}

/** Ao sair, o texto volta à forma canônica: `1234,5` vira `R$ 1.234,50`. */
function aoSairDoValor(): void {
  editandoValor.value = false;
  valorCentavos.value = textoParaCentavos(valorTexto.value);
  valorTexto.value = centavosParaTexto(valorCentavos.value);
}

function valorMenos(): void {
  valorCentavos.value = Math.max(0, valorCentavos.value - PASSO_VALOR_CENTAVOS);
  valorTexto.value = centavosParaTexto(valorCentavos.value);
}
function valorMais(): void {
  valorCentavos.value += PASSO_VALOR_CENTAVOS;
  valorTexto.value = centavosParaTexto(valorCentavos.value);
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
  editandoValor.value = false;
  valorCentavos.value = 0;
  valorTexto.value = centavosParaTexto(0);
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
  editandoValor.value = false;
  valorCentavos.value = (conta.tipo === 'CREDITO' ? conta.limiteCentavos : conta.saldoInicialCentavos) ?? 0;
  valorTexto.value = centavosParaTexto(valorCentavos.value);
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
      <div class="contas__resumo-aviso">{{ faturaAviso }}</div>
      <div class="contas__resumo-nota">Não inclui as contas reserva.</div>
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

        <!-- Ver fatura / Pagar fatura (história #74, tarefa #110) — só CREDITO -->
        <div v-if="conta.tipo === 'CREDITO'" class="contas__acoes-fatura">
          <button type="button" class="contas__botao-fatura contas__botao-fatura--secundario" @click="verFatura(conta)">
            Ver fatura
          </button>
          <button
            type="button"
            class="contas__botao-fatura contas__botao-fatura--primario"
            :disabled="verificandoFaturaId === conta.id"
            @click="pagarFaturaDoCartao(conta)"
          >
            {{ verificandoFaturaId === conta.id ? 'Verificando…' : 'Pagar fatura' }}
          </button>
        </div>
        <p v-if="avisoPagamento && avisoPagamento.contaId === conta.id" class="contas__aviso-pagamento" role="alert">
          {{ avisoPagamento.texto }}
        </p>
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
            <input
              v-model="valorTexto"
              class="sheet__stepper-valor"
              type="text"
              inputmode="decimal"
              :aria-label="valorLabel"
              @focus="aoFocarValor"
              @blur="aoSairDoValor"
            >
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

    <!-- ── FOLHA · sheetPagar (F1 — decisão humana 2026-08-31) ──────────── -->
    <div v-if="sheetPagarAberta" class="sheet-fundo" @click.self="fecharSheetPagar">
      <div class="sheet">
        <div class="sheet__cabecalho">
          <span class="sheet__titulo">Pagar fatura</span>
          <button type="button" class="sheet__fechar" aria-label="Fechar" @click="fecharSheetPagar">✕</button>
        </div>

        <div class="sheet__cartao">
          <div class="sheet__cartao-rotulo">{{ cartaoParaPagar?.nome }}</div>
          <div class="sheet__cartao-sub">Fatura fechada, aguardando pagamento</div>
          <div class="contas__pagar-valor">{{ formatarCentavos(-(faturaParaPagar?.totalCentavos ?? 0)) }}</div>
        </div>

        <div class="sheet__rotulo-secao">PAGAR COM</div>
        <div class="contas__pagar-seletor-container">
          <button type="button" class="contas__pagar-seletor" @click="alternarSeletorContaPagadora">
            <span
              class="contas__pagar-seletor-quadrado"
              :style="{ background: contaPagadoraSelecionada?.cor ?? 'var(--tinta)' }"
            >
              <i class="ti" :class="contaPagadoraSelecionada ? classeDoIcone(contaPagadoraSelecionada.icone) : 'ti-wallet'"></i>
            </span>
            <span class="contas__pagar-seletor-texto">{{ contaPagadoraSelecionada?.nome ?? 'Escolha uma conta' }}</span>
            <i class="ti ti-chevron-down contas__pagar-seletor-seta"></i>
          </button>

          <template v-if="seletorContaPagadoraAberto">
            <div class="contas__pagar-seletor-backdrop" @click="fecharSeletorContaPagadora"></div>
            <div class="contas__pagar-seletor-painel lista">
              <button
                v-for="c in contasDebito"
                :key="c.id"
                type="button"
                class="linha linha--botao"
                @click="escolherContaPagadora(c.id)"
              >
                <span class="linha__icone" :style="{ background: c.cor }">
                  <i class="ti" :class="classeDoIcone(c.icone)"></i>
                </span>
                <span class="linha__texto">
                  <span class="linha__titulo">{{ c.nome }}</span>
                </span>
                <i v-if="c.id === contaPagadoraId" class="ti ti-check contas__pagar-seletor-check"></i>
              </button>
            </div>
          </template>
        </div>

        <p v-if="erroPagar" class="sheet__erro" role="alert">{{ erroPagar }}</p>

        <button type="button" class="botao sheet__salvar" :disabled="pagando" @click="confirmarPagamento">
          {{ pagando ? 'Pagando…' : 'Confirmar pagamento' }}
        </button>
      </div>
    </div>
  </section>
</template>

<style lang="scss" src="~/assets/scss/pages/contas.scss" scoped></style>
