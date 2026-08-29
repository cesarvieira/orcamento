<script setup lang="ts">
/**
 * METAS (EF-07) — a tela `metas` do mockup. Tarefa #87 (issue #87 da
 * história #21). `.preator/tmp/recorte-desenho-21.md` é FONTE, não
 * ilustração (não commitado, artefato do condutor) — 🟦 é desenho, 🟨 é
 * anotação do condutor. As decisões humanas D1/D2/D4/D5 (2026-08-29,
 * `.preator/skills/negocio/metas-e-reservas/SKILL.md`) são FONTE também, e
 * acrescentam superfície que o desenho NÃO tem.
 *
 * O título "Metas" já vem do shell (`layouts/default.vue`, via
 * `config/navegacao.ts:109-117` — a rota `/metas` resolve certo em
 * `destinoDaRota`), mesmo padrão de `contas.vue`/`faturas.vue`: duplicar
 * "Metas e reservas" aqui empilharia título com o shell. Só o SUBTÍTULO do
 * desenho é reproduzido — ele é obrigatório (EF-07 §3) porque enuncia a
 * regra do teto (RN-34/D1) na própria tela.
 *
 * Esta tela só LÊ e FORMATA `Meta` — nunca recalcula `acumuladoCentavos`
 * (regra inviolável #4). O percentual da barra (`pct`/`pctStr`/`pctLabel`
 * abaixo) É fonte do desenho (recorte §3, mobile:1218): deriva só um valor de
 * EXIBIÇÃO (largura/rótulo da barra) a partir de `acumuladoCentavos` e
 * `alvoCentavos` que a API já devolveu prontos — não é o mesmo tipo de
 * recálculo que a regra proíbe (não alocado, lastro, acumulado em si).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * O QUE VEM DO DESENHO (recorte §1/§2/§3) E O QUE VEM DE D1/D2/D4/D5:
 * ═══════════════════════════════════════════════════════════════════════
 *
 * 🟦 Do desenho: o subtítulo, palavra por palavra ("Guardar sai do não
 * alocado do mês"); a lista de cofrinhos (coluna única no mobile, grade de 3
 * no desktop); o cartão (nome · percentual · acumulado em destaque · "de
 * {alvo}" · barra de progresso); os botões "Guardar 100"/"Guardar 500"; o
 * teto de 100% na barra (cofrinho que passou do alvo não estoura); o texto do
 * toast de sucesso ("R$ X guardados em {nome}.").
 *
 * D1 · O TETO RECUSANDO (decisão humana, o protótipo nunca recusa): a API
 * devolve 409 (`teto_excedido`) quando o valor pedido excede o não alocado da
 * competência, ou quando o não alocado já é ≤ 0. Aparece aqui como erro
 * legível — o toast (🟨 leitura do condutor: "o padrão de aviso da casa é o
 * toast"), nunca falha silenciosa.
 *
 * D2/D5 · SELETOR DE CONTA DE ORIGEM: dropdown entre as contas `DEBITO`,
 * default na primeira — precedente direto de layout E comportamento:
 * `pages/faturas.vue:291-352` (dropdown D3 da EF-05, documentado em
 * `docs/manual/MANUAL-05-faturas.md:267`, não na EF-05). Guardar manda as
 * DUAS pontas escolhidas no ato: a conta de origem e o cofrinho de destino —
 * nenhuma inferida.
 *
 * D4 · CRIAR COFRINHO — superfície NOVA, autorizada pelo humano em
 * 2026-08-29 (o desenho só tem a lista, recorte §5). Não é invenção deste
 * arquivo: a folha reaproveita o vocabulário visual de `sheetConta`
 * (`contas.vue`, mesmo padrão que a skill cita para a caixa de exclusão de
 * parcela em `lancamentos-e-parcelamento/SKILL.md`, fork 1). Nome + alvo; a
 * conta RESERVA é criada pela API (D3), nunca por esta tela.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * O QUE NÃO SE COPIA DO PROTÓTIPO (EF-07 §4): os botões do mockup
 * incrementam `atual` direto no estado, sem mover dinheiro. Aqui "guardar" é
 * `POST /metas/:id/guardar` (RN-33 — TRANSFERENCIA real) e a tela RELÊ depois
 * — nunca soma o valor guardado ao acumulado local.
 */
import type { Conta, Meta, NovaMeta } from '@orcamento/contrato';
import { classeDoIcone, useContas } from '~/composables/useContas';
import { GUARDAR_100_CENTAVOS, GUARDAR_500_CENTAVOS, PASSO_ALVO_CENTAVOS, useMetas } from '~/composables/useMetas';
import { centavosParaTexto, formatarCentavos, textoParaCentavos } from '~/utils/dinheiro';

const { listarContas } = useContas();
const { listarMetas, criarMeta, guardar } = useMetas();

// ── LISTA DE COFRINHOS ───────────────────────────────────────────────────

const metas = ref<Meta[]>([]);
const carregando = ref(true);
const erro = ref<string | null>(null);

async function carregarMetas(): Promise<void> {
  const resposta = await listarMetas();
  metas.value = resposta.metas;
}

/**
 * 🟦 A derivação do percentual (recorte §3, mobile:1218):
 * `pct = Math.min(100, (atual / alvo) * 100)`. Só formata o que a API já
 * devolveu — `alvoCentavos` é sempre > 0 (esquema do servidor), sem risco de
 * divisão por zero.
 */
function pct(meta: Meta): number {
  return Math.min(100, (meta.acumuladoCentavos / meta.alvoCentavos) * 100);
}
function pctStr(meta: Meta): string {
  return `${pct(meta)}%`;
}
function pctLabel(meta: Meta): string {
  return `${Math.round(pct(meta))}%`;
}

// ── D2/D5 · CONTA DE ORIGEM (DEBITO) ─────────────────────────────────────

const contasDebito = ref<Conta[]>([]);
const contaOrigemId = ref<string | null>(null);
const seletorOrigemAberto = ref(false);

const contaOrigemSelecionada = computed(() => contasDebito.value.find(c => c.id === contaOrigemId.value) ?? null);

async function carregarContasInicial(): Promise<void> {
  const resposta = await listarContas();
  contasDebito.value = resposta.contas.filter(c => c.tipo === 'DEBITO');
  contaOrigemId.value = contasDebito.value[0]?.id ?? null; // D2/D5 — default na primeira
}

/** Refresca só a lista de contas débito — não mexe na seleção do usuário (mesmo padrão de `faturas.vue`). */
async function atualizarContas(): Promise<void> {
  const resposta = await listarContas();
  contasDebito.value = resposta.contas.filter(c => c.tipo === 'DEBITO');
}

function alternarSeletorOrigem(): void {
  seletorOrigemAberto.value = !seletorOrigemAberto.value;
}
function fecharSeletorOrigem(): void {
  seletorOrigemAberto.value = false;
}
function escolherContaOrigem(id: string): void {
  contaOrigemId.value = id;
  seletorOrigemAberto.value = false;
}

// ── CARGA INICIAL E TEMPO REAL ───────────────────────────────────────────

async function carregarInicial(): Promise<void> {
  carregando.value = true;
  try {
    await Promise.all([carregarContasInicial(), carregarMetas()]);
    erro.value = null;
  } catch (e) {
    erro.value = mensagemDoErro(e, 'Não consegui carregar as metas.');
  } finally {
    carregando.value = false;
  }
}

onMounted(carregarInicial);

// Tempo real (EF-00 R2-R5, `composables/useRealtime.ts`): `POST
// /metas/:id/guardar` invalida DOIS recursos (`api/src/modulos/metas/rotas.ts`
// #invalidarMetas) — `metas` (o cofrinho em si) e `contas` (guardar move
// dinheiro de verdade da conta de origem, RN-33). R3 — nada do evento vira
// estado, só dispara releitura; nunca soma o valor guardado ao acumulado
// local (ver "o que não se copia" no cabeçalho do arquivo).
useRealtime({
  recursos: ['metas', 'contas'],
  aoInvalidar: async () => {
    try {
      await Promise.all([atualizarContas(), carregarMetas()]);
      erro.value = null;
    } catch (e) {
      erro.value = mensagemDoErro(e, 'Não consegui atualizar as metas.');
    }
  },
});

// ── O TOAST (recorte §0/§3: `aviso(t)`, some em 2600 ms) ─────────────────
//
// 🟨 Leitura do condutor (recorte §5): "o padrão de aviso da casa é o toast".
// Não existe componente de toast global no projeto ainda — construído aqui,
// escopo desta tela, reaproveitando o texto e o tempo literais do desenho.

const toastTexto = ref<string | null>(null);
const toastErro = ref(false);
let toastTimer: ReturnType<typeof setTimeout> | null = null;

function mostrarToast(texto: string, ehErro: boolean): void {
  if (toastTimer) clearTimeout(toastTimer);
  toastTexto.value = texto;
  toastErro.value = ehErro;
  toastTimer = setTimeout(() => {
    toastTexto.value = null;
  }, 2600); // 🟦 recorte §0 — mobile:902
}

onBeforeUnmount(() => {
  if (toastTimer) clearTimeout(toastTimer);
});

// ── GUARDAR (RN-33/RN-34, D1/D2/D5) ──────────────────────────────────────

const guardandoId = ref<string | null>(null);

async function guardarValor(meta: Meta, valorCentavos: number): Promise<void> {
  if (guardandoId.value) return;

  const conta = contaOrigemSelecionada.value;
  if (!conta) {
    mostrarToast('Escolha uma conta para guardar.', true);
    return;
  }

  guardandoId.value = meta.id;
  try {
    await guardar(meta.id, { contaOrigemId: conta.id, valorCentavos });
    // Sem somar nada aqui (regra inviolável #4 / EF-07 §4): refaz a leitura
    // para pegar o acumulado DERIVADO e recomputado no servidor.
    await carregarMetas();
    // 🟦 texto literal do toast (recorte §3, mobile:1220-1221), generalizado
    // para os dois valores do botão via `formatarCentavos`.
    mostrarToast(`${formatarCentavos(valorCentavos)} guardados em ${meta.nome}.`, false);
  } catch (e) {
    // D1 — 409 `teto_excedido` (e qualquer outro erro) chega aqui com a
    // mensagem que a API decidiu, nunca texto inventado (regra #4).
    mostrarToast(mensagemDoErro(e, 'Não consegui guardar.'), true);
  } finally {
    guardandoId.value = null;
  }
}

// ── D4 · CRIAR COFRINHO (superfície nova, decisão humana 2026-08-29) ─────

const sheetAberta = ref(false);
const salvandoCofrinho = ref(false);
const erroSheet = ref<string | null>(null);

const nomeNovo = ref('');
const alvoCentavosNovo = ref(0);

// Mesmo padrão de campo digitável de `contas.vue` (`valorTexto`/`editandoValor`):
// `alvoCentavosNovo` é a verdade em INTEIRO (D-06); o texto é só a borda.
const alvoTextoNovo = ref(centavosParaTexto(0));
const editandoAlvoNovo = ref(false);

watch(alvoTextoNovo, texto => {
  if (editandoAlvoNovo.value) alvoCentavosNovo.value = textoParaCentavos(texto);
});
watch(alvoCentavosNovo, centavos => {
  if (!editandoAlvoNovo.value) alvoTextoNovo.value = centavosParaTexto(centavos);
});

function aoFocarAlvoNovo(): void {
  editandoAlvoNovo.value = true;
}
function aoSairDoAlvoNovo(): void {
  editandoAlvoNovo.value = false;
  alvoCentavosNovo.value = textoParaCentavos(alvoTextoNovo.value);
  alvoTextoNovo.value = centavosParaTexto(alvoCentavosNovo.value);
}
function alvoNovoMenos(): void {
  alvoCentavosNovo.value = Math.max(0, alvoCentavosNovo.value - PASSO_ALVO_CENTAVOS);
  alvoTextoNovo.value = centavosParaTexto(alvoCentavosNovo.value);
}
function alvoNovoMais(): void {
  alvoCentavosNovo.value += PASSO_ALVO_CENTAVOS;
  alvoTextoNovo.value = centavosParaTexto(alvoCentavosNovo.value);
}

function abrirCriacao(): void {
  nomeNovo.value = '';
  editandoAlvoNovo.value = false;
  alvoCentavosNovo.value = 0;
  alvoTextoNovo.value = centavosParaTexto(0);
  erroSheet.value = null;
  sheetAberta.value = true;
}
function fecharSheet(): void {
  sheetAberta.value = false;
}

async function salvarCofrinho(): Promise<void> {
  if (salvandoCofrinho.value) return;

  const nomeAparado = nomeNovo.value.trim();
  if (!nomeAparado) {
    erroSheet.value = 'Dê um nome para o cofrinho.';
    return;
  }
  if (alvoCentavosNovo.value <= 0) {
    erroSheet.value = 'Informe um alvo maior que zero.';
    return;
  }

  const corpo: NovaMeta = { nome: nomeAparado, alvoCentavos: alvoCentavosNovo.value };

  salvandoCofrinho.value = true;
  erroSheet.value = null;
  try {
    await criarMeta(corpo);
    // Sem recalcular nada aqui (regra inviolável #4): refaz a leitura para
    // pegar o cofrinho novo, com a conta RESERVA que o servidor criou (D3).
    await carregarMetas();
    sheetAberta.value = false;
  } catch (e) {
    erroSheet.value = mensagemDoErro(e, 'Não consegui criar o cofrinho.');
  } finally {
    salvandoCofrinho.value = false;
  }
}
</script>

<template>
  <section class="metas">
    <!-- 🟦 subtítulo literal (recorte §1, EF-07 §3 — obrigatório) -->
    <p class="metas__subtitulo">Guardar sai do não alocado do mês</p>

    <p v-if="carregando" class="metas__vazio">Carregando…</p>
    <p v-else-if="erro" class="metas__vazio metas__vazio--erro" role="alert">{{ erro }}</p>

    <template v-else>
      <!-- ── D2/D5 · SELETOR DE CONTA DE ORIGEM — só com algo para guardar ── -->
      <div v-if="contasDebito.length > 0 && metas.length > 0" class="metas__seletor-container">
        <button type="button" class="metas__seletor" @click="alternarSeletorOrigem">
          <span class="metas__seletor-quadrado" :style="{ background: contaOrigemSelecionada?.cor ?? 'var(--tinta)' }">
            <i class="ti" :class="contaOrigemSelecionada ? classeDoIcone(contaOrigemSelecionada.icone) : 'ti-wallet'"></i>
          </span>
          <span class="metas__seletor-texto">
            <span class="metas__seletor-rotulo">GUARDAR DE</span>
            <span class="metas__seletor-valor">{{ contaOrigemSelecionada?.nome ?? 'Escolha uma conta' }}</span>
          </span>
          <i class="ti ti-chevron-down metas__seletor-seta"></i>
        </button>

        <template v-if="seletorOrigemAberto">
          <div class="metas__seletor-backdrop" @click="fecharSeletorOrigem"></div>
          <div class="metas__seletor-painel">
            <button
              v-for="c in contasDebito"
              :key="c.id"
              type="button"
              class="linha linha--botao"
              @click="escolherContaOrigem(c.id)"
            >
              <span class="linha__icone" :style="{ background: c.cor }">
                <i class="ti" :class="classeDoIcone(c.icone)"></i>
              </span>
              <span class="linha__texto">
                <span class="linha__titulo">{{ c.nome }}</span>
              </span>
              <i v-if="c.id === contaOrigemId" class="ti ti-check metas__seletor-check"></i>
            </button>
          </div>
        </template>
      </div>

      <!-- ── A LISTA DE COFRINHOS (recorte §2/§3) ────────────────────────── -->
      <p v-if="metas.length === 0" class="metas__vazio">Nenhum cofrinho criado ainda.</p>

      <div v-else class="metas__lista">
        <div v-for="meta in metas" :key="meta.id" class="metas__cartao">
          <div class="metas__topo">
            <span class="metas__nome">{{ meta.nome }}</span>
            <span class="metas__percentual">{{ pctLabel(meta) }}</span>
          </div>
          <div class="metas__acumulado">{{ formatarCentavos(meta.acumuladoCentavos) }}</div>
          <div class="metas__alvo">de {{ formatarCentavos(meta.alvoCentavos) }}</div>

          <div class="metas__trilho">
            <div class="metas__preenchimento" :style="{ width: pctStr(meta) }"></div>
          </div>

          <div class="metas__botoes">
            <button
              type="button"
              class="metas__botao-guardar"
              :disabled="guardandoId === meta.id"
              @click="guardarValor(meta, GUARDAR_100_CENTAVOS)"
            >
              Guardar 100
            </button>
            <button
              type="button"
              class="metas__botao-guardar"
              :disabled="guardandoId === meta.id"
              @click="guardarValor(meta, GUARDAR_500_CENTAVOS)"
            >
              Guardar 500
            </button>
          </div>
        </div>
      </div>

      <!-- ── D4 · CRIAR COFRINHO — superfície nova, decisão humana ────────── -->
      <button type="button" class="metas__novo" @click="abrirCriacao">
        <i class="ti ti-plus"></i>
        Criar cofrinho
      </button>
    </template>

    <!-- ── FOLHA · D4 ──────────────────────────────────────────────────────── -->
    <div v-if="sheetAberta" class="metas__sheet-fundo" @click.self="fecharSheet">
      <div class="metas__sheet">
        <div class="metas__sheet-cabecalho">
          <span class="metas__sheet-titulo">Novo cofrinho</span>
          <button type="button" class="metas__sheet-fechar" aria-label="Fechar" @click="fecharSheet">✕</button>
        </div>

        <input v-model="nomeNovo" type="text" placeholder="Nome do cofrinho" class="metas__sheet-nome">

        <div class="metas__sheet-cartao">
          <div class="metas__sheet-rotulo">Alvo</div>
          <div class="metas__sheet-sub">quanto a família pretende juntar</div>
          <div class="metas__sheet-stepper">
            <button type="button" class="metas__sheet-passo" aria-label="Diminuir" @click="alvoNovoMenos">−</button>
            <input
              v-model="alvoTextoNovo"
              class="metas__sheet-stepper-valor"
              type="text"
              inputmode="decimal"
              aria-label="Alvo"
              @focus="aoFocarAlvoNovo"
              @blur="aoSairDoAlvoNovo"
            >
            <button type="button" class="metas__sheet-passo" aria-label="Aumentar" @click="alvoNovoMais">+</button>
          </div>
        </div>

        <p v-if="erroSheet" class="metas__sheet-erro" role="alert">{{ erroSheet }}</p>

        <button type="button" class="botao metas__sheet-salvar" :disabled="salvandoCofrinho" @click="salvarCofrinho">
          {{ salvandoCofrinho ? 'Criando…' : 'Criar cofrinho' }}
        </button>
      </div>
    </div>

    <!-- ── TOAST (recorte §0/§3 — 2600 ms) ──────────────────────────────── -->
    <div v-if="toastTexto" class="metas__toast" :class="{ 'metas__toast--erro': toastErro }" role="status">
      {{ toastTexto }}
    </div>
  </section>
</template>

<style lang="scss" src="~/assets/scss/pages/metas.scss" scoped></style>
