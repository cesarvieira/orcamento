<script setup lang="ts">
/**
 * A FOLHA DE NOVO LANÇAMENTO (`sheetLanc`) — issue #53, história #18 (EF-04).
 *
 * Componente GLOBAL: monta uma vez em `layouts/default.vue`, abre de
 * QUALQUER tela via `useFolhaLancamento().abrir()` — ver o cabeçalho de
 * `composables/useLancamentos.ts` para a API inteira (é a costura da #54).
 *
 * FONTE DE DESENHO: `.motor/recorte-desenho-18.md` §2 (não commitado,
 * artefato do condutor). 🟦 é desenho; 🟨 é anotação/decisão do condutor ou
 * do humano. As DIVERGÊNCIAS DELIBERADAS do desenho, citadas onde aparecem:
 *
 *   · TIPO (RECEITA/DESPESA/TRANSFERENCIA) — não existe no mockup (ele
 *     representava receita como valor negativo e não tinha transferência,
 *     exatamente as duas armadilhas que a EF-04 §4 marca para NÃO copiar).
 *     Seletor construído contra a ESPECIFICAÇÃO (EF-04 §1: "tipo explícito,
 *     não sinal"), por analogia visual com `TIPOS_CONTA` (`useContas.ts`).
 *   · DESCRIÇÃO — o recorte não lista campo de texto livre (só `resumoLanc`,
 *     que é COMPUTADO, não editável — §6 ponto 3 do recorte). Mas
 *     `NovoLancamento.descricao` é obrigatório e não-vazio no contrato: sem
 *     ele não há como lançar manualmente. "Não localizei" — não invenção
 *     silenciosa; ver o relato desta tarefa.
 *   · CONTA DE DESTINO — só existe quando `tipo === 'TRANSFERENCIA'`, que
 *     também não existe no protótipo. Mesma anatomia de linha da CONTA
 *     (recorte §2.6), duplicada para a segunda ponta do movimento.
 *   · LANÇAMENTO RÁPIDO (atalhos) — o recorte descreve a ANATOMIA
 *     (`{{ atalhos }}`: ícone + nome + valor), mas não há fonte para O QUE
 *     esses atalhos são (nem no recorte, nem na skill, nem na EF-04), e não
 *     existe endpoint para persisti-los. Desenhado, mas tratado como
 *     "Foto do recibo"/"Importar extrato" (recorte §2.2): visível, com
 *     aviso, sem dado inventado.
 *
 * Dinheiro em centavos, inteiro, na pilha toda (D-06) — `utils/dinheiro.ts`.
 * NUNCA recalcula parcela/gasto/disponível aqui (regra inviolável #4): o
 * teclado numérico só monta o TEXTO que `textoParaCentavos` já sabe ler; a
 * divisão de RN-20/RN-21 é sempre do servidor — por isso `dataHint` abaixo
 * nunca mostra valor por parcela, só o fato de que o lançamento é parcelado.
 */
import type { CategoriaNaCompetencia, Conta, NovoLancamento } from '@orcamento/contrato';
import { classeDoIcone, useContas } from '~/composables/useContas';
import { TIPOS_LANCAMENTO, corDoTipo, useFolhaLancamento, useLancamentos } from '~/composables/useLancamentos';
import { classeDoIconeCategoria, useOrcamento } from '~/composables/useOrcamento';
import { competenciaAtual, rotuloDaCompetencia } from '~/utils/competencia';
import { formatarCentavos, textoParaCentavos } from '~/utils/dinheiro';

const { aberta, categoriaPreSelecionada, fechar } = useFolhaLancamento();
const { criarLancamento } = useLancamentos();
const { lerCompetencia } = useOrcamento();
const { listarContas } = useContas();

type Tipo = NovoLancamento['tipo'];

const tipo = ref<Tipo>('DESPESA');
const descricao = ref('');
/** Dígitos crus do teclado numérico — `textoParaCentavos` lê no mesmo formato que um campo digitável. */
const valorTexto = ref('');
const data = ref('');
const contaId = ref<string | null>(null);
const contaDestinoId = ref<string | null>(null);
const categoriaId = ref<string | null>(null);
const quantidadeParcelas = ref<number | null>(null);

const categorias = ref<CategoriaNaCompetencia[]>([]);
const contas = ref<Conta[]>([]);

const abertoAtalhos = ref(false);
const abertoCategoria = ref(false);
const abertoConta = ref(false);
const abertoContaDestino = ref(false);

const avisoForaDeEscopo = ref<string | null>(null);
const salvando = ref(false);
const erro = ref<string | null>(null);

const valorCentavos = computed(() => textoParaCentavos(valorTexto.value || '0'));

/**
 * O CAMPO DE VALOR — cru enquanto se digita, formatado quando se sai.
 *
 * `valorTexto` continua sendo a única fonte: o teclado da folha e o teclado
 * físico escrevem nele do MESMO jeito, porque `textoParaCentavos` já aceita as
 * duas formas (`1234`, `12,34`, `1.234,56`, `R$ 10`). Não há segundo caminho.
 *
 * ⚠️ POR QUE NÃO FORMATAR ENQUANTO DIGITA: reescrever o texto a cada tecla
 * move o cursor para o fim e impede apagar o meio do número — o defeito
 * clássico de campo de dinheiro. Enquanto o campo tem foco ele mostra o que a
 * pessoa escreveu; ao sair, mostra o valor formatado que o resto da tela usa.
 */
const valorFocado = ref(false);
const valorExibido = computed({
  get: () => {
    if (valorFocado.value) return valorTexto.value;
    // Vazio continua vazio: formatar o zero mostraria "R$ 0,00" num campo em
    // que ninguém tocou, e o placeholder nunca apareceria.
    return valorTexto.value ? formatarCentavos(valorCentavos.value) : '';
  },
  set: (novo: string) => {
    valorTexto.value = novo;
  },
});

/** `AAAA-MM-DD` de hoje, no fuso local — só o valor inicial da folha ao abrir. */
function dataDeHoje(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

/**
 * A competência de uma `data` (`AAAA-MM-DD` → `AAAA-MM`) — espelho de
 * LEITURA de `api/src/modulos/lancamentos/dominio.ts#competenciaDaData`
 * (RN-15/RN-18): é fatiamento de string, não regra de negócio. Usada só
 * para saber qual leitura de competência pedir (o "disponível" da
 * categoria, no dropdown); quem decide a competência de verdade, na
 * escrita, é sempre o servidor — nunca este arquivo.
 */
function competenciaDaData(dataIso: string): string {
  return dataIso.slice(0, 7);
}

async function carregarContas(): Promise<void> {
  const resposta = await listarContas();
  contas.value = resposta.contas;
}

async function carregarCategorias(): Promise<void> {
  if (!data.value) return;
  const leitura = await lerCompetencia(competenciaDaData(data.value));
  categorias.value = leitura.categorias;
}

watch(data, () => {
  void carregarCategorias();
});

watch(aberta, novo => {
  if (!novo) return;

  tipo.value = 'DESPESA';
  descricao.value = '';
  valorTexto.value = '';
  data.value = dataDeHoje();
  contaId.value = null;
  contaDestinoId.value = null;
  categoriaId.value = categoriaPreSelecionada.value;
  quantidadeParcelas.value = null;
  abertoAtalhos.value = false;
  abertoCategoria.value = false;
  abertoConta.value = false;
  abertoContaDestino.value = false;
  avisoForaDeEscopo.value = null;
  erro.value = null;

  void carregarContas();
  void carregarCategorias();
});

// ── TIPO — 🟨 não é do desenho, ver comentário no topo do arquivo ─────────

function escolherTipo(novo: Tipo): void {
  tipo.value = novo;
  if (novo !== 'DESPESA') {
    categoriaId.value = null;
    quantidadeParcelas.value = null;
  }
  if (novo !== 'TRANSFERENCIA') {
    contaDestinoId.value = null;
  }
}

// ── TECLADO NUMÉRICO (recorte §2.9 — 12 teclas: dez dígitos, separador, apagar) ──

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'apagar'] as const;

function apertarTecla(tecla: (typeof TECLAS)[number]): void {
  if (tecla === 'apagar') {
    valorTexto.value = valorTexto.value.slice(0, -1);
    return;
  }
  if (tecla === ',' && valorTexto.value.includes(',')) return;
  if (valorTexto.value.replace(/\D/g, '').length >= 12) return; // trava contra dígito sem fim
  valorTexto.value += tecla;
}

// ── DROPDOWNS (toggleAtalhos/toggleCats/toggleContas do recorte) ─────────

function alternarAtalhos(): void {
  abertoAtalhos.value = !abertoAtalhos.value;
}
function alternarCategoria(): void {
  abertoCategoria.value = !abertoCategoria.value;
}
function alternarConta(): void {
  abertoConta.value = !abertoConta.value;
}
function alternarContaDestino(): void {
  abertoContaDestino.value = !abertoContaDestino.value;
}

function escolherCategoria(c: CategoriaNaCompetencia): void {
  categoriaId.value = c.id;
  abertoCategoria.value = false;
}
function escolherConta(c: Conta): void {
  contaId.value = c.id;
  abertoConta.value = false;
}
function escolherContaDestino(c: Conta): void {
  contaDestinoId.value = c.id;
  abertoContaDestino.value = false;
}

/**
 * `a.sub` do recorte (§2.6) — mesma leitura de `pages/contas.vue#subDaConta`
 * (fora do escopo desta tarefa, `pages/` não se toca aqui), reescrita neste
 * arquivo porque `scoped`/módulo local não atravessa arquivos.
 */
function subDaConta(conta: Conta): string {
  if (conta.tipo === 'CREDITO') return `Fecha dia ${conta.diaFechamento} · vence dia ${conta.diaVencimento}`;
  if (conta.tipo === 'RESERVA') return 'Fora do orçamento';
  return 'Conta corrente';
}

const categoriaSelecionada = computed(() => categorias.value.find(c => c.id === categoriaId.value) ?? null);
const contaSelecionada = computed(() => contas.value.find(c => c.id === contaId.value) ?? null);
const contaDestinoSelecionada = computed(() => contas.value.find(c => c.id === contaDestinoId.value) ?? null);

/**
 * A conta de destino nunca repete a de origem, e vice-versa — o back recusa
 * com 400 (fork 3/#52); aqui só não se oferece o erro óbvio.
 */
const contasParaDestino = computed(() => contas.value.filter(c => c.id !== contaId.value));
const contasParaOrigem = computed(() => {
  if (tipo.value !== 'TRANSFERENCIA' || !contaDestinoId.value) return contas.value;
  return contas.value.filter(c => c.id !== contaDestinoId.value);
});

// ── PARCELAS ───────────────────────────────────────────────────────────

function parcelasMenos(): void {
  if (quantidadeParcelas.value === null) return;
  quantidadeParcelas.value = quantidadeParcelas.value <= 2 ? null : quantidadeParcelas.value - 1;
}
function parcelasMais(): void {
  quantidadeParcelas.value = Math.min(48, (quantidadeParcelas.value ?? 1) + 1);
}

// ── RESUMO · DICA · COR ────────────────────────────────────────────────

const corValor = computed(() => corDoTipo(tipo.value));
/** `corSalvar` do recorte — mesma cor do valor, mas nunca sobrepõe o cinza de `:disabled` do botão. */
const corSalvar = computed(() => (salvando.value ? undefined : corValor.value));

/** `resumoLanc` do recorte (§2.3) — texto computado, não editável (§6 ponto 3: o texto sai da regra, não do mockup). */
const resumoLanc = computed(() => {
  if (tipo.value === 'TRANSFERENCIA') {
    if (contaSelecionada.value && contaDestinoSelecionada.value) {
      return `De ${contaSelecionada.value.nome} para ${contaDestinoSelecionada.value.nome}`;
    }
    return 'Escolha as duas contas';
  }
  const partes: string[] = [tipo.value === 'RECEITA' ? 'Receita' : 'Despesa'];
  if (tipo.value === 'DESPESA' && categoriaSelecionada.value) partes.push(categoriaSelecionada.value.nome);
  if (contaSelecionada.value) partes.push(contaSelecionada.value.nome);
  return partes.join(' · ');
});

/**
 * `dataHint` do recorte (§2.8) — texto e cor saem da regra, não do mockup
 * (§6 ponto 3). Cobre RN-15 (retroativo muda de mês de orçamento); NÃO
 * cobre valor por parcela — mostrar `total ÷ N` seria reproduzir RN-20/RN-21
 * no cliente, e a regra inviolável #4 proíbe exatamente isso.
 */
const dataHint = computed(() => {
  if (!data.value) return '';
  const competenciaDaEscolha = competenciaDaData(data.value);
  if (competenciaDaEscolha !== competenciaAtual()) {
    return `Vai para o orçamento de ${rotuloDaCompetencia(competenciaDaEscolha)}.`;
  }
  if (tipo.value === 'DESPESA' && quantidadeParcelas.value && quantidadeParcelas.value > 1) {
    return `Parcelado em ${quantidadeParcelas.value}×, sem juros — o valor de cada parcela é calculado ao salvar.`;
  }
  return '';
});
const corDataHint = computed(() => {
  if (!data.value) return 'var(--texto-fraco)';
  return competenciaDaData(data.value) !== competenciaAtual() ? 'var(--atencao)' : 'var(--texto-fraco)';
});

/** `labelSalvar` do recorte — dinâmico com o tipo e a quantidade de parcelas. */
const labelSalvar = computed(() => {
  if (salvando.value) return 'Salvando…';
  if (tipo.value === 'TRANSFERENCIA') return 'Transferir';
  if (tipo.value === 'RECEITA') return 'Lançar receita';
  if (quantidadeParcelas.value && quantidadeParcelas.value > 1) return `Lançar em ${quantidadeParcelas.value}×`;
  return 'Lançar despesa';
});

// ── FORA DE ESCOPO — recibo, importar, atalhos (recorte §2.2 e `.preator/CONTEXT.md`) ──

function avisarRecibo(): void {
  avisoForaDeEscopo.value = 'Fotografar o recibo ainda não está disponível.';
}
function avisarImportar(): void {
  avisoForaDeEscopo.value = 'Importar extrato ainda não está disponível.';
}

// ── SALVAR ─────────────────────────────────────────────────────────────

async function salvar(): Promise<void> {
  if (salvando.value) return;
  erro.value = null;

  const descricaoAparada = descricao.value.trim();
  if (!descricaoAparada) {
    erro.value = 'Descreva o lançamento.';
    return;
  }
  if (valorCentavos.value <= 0) {
    erro.value = 'Informe um valor.';
    return;
  }
  if (!contaId.value) {
    erro.value = tipo.value === 'TRANSFERENCIA' ? 'Escolha a conta de origem.' : 'Escolha a conta.';
    return;
  }
  if (tipo.value === 'DESPESA' && !categoriaId.value) {
    erro.value = 'Escolha a categoria.';
    return;
  }
  if (tipo.value === 'TRANSFERENCIA' && !contaDestinoId.value) {
    erro.value = 'Escolha a conta de destino.';
    return;
  }

  let corpo: NovoLancamento;
  if (tipo.value === 'RECEITA') {
    corpo = {
      tipo: 'RECEITA',
      descricao: descricaoAparada,
      valorCentavos: valorCentavos.value,
      data: data.value,
      contaId: contaId.value,
    };
  } else if (tipo.value === 'TRANSFERENCIA') {
    corpo = {
      tipo: 'TRANSFERENCIA',
      descricao: descricaoAparada,
      valorCentavos: valorCentavos.value,
      data: data.value,
      contaId: contaId.value,
      contaDestinoId: contaDestinoId.value!,
    };
  } else {
    corpo = {
      tipo: 'DESPESA',
      descricao: descricaoAparada,
      valorCentavos: valorCentavos.value,
      data: data.value,
      contaId: contaId.value,
      categoriaId: categoriaId.value!,
      ...(quantidadeParcelas.value && quantidadeParcelas.value > 1
        ? { quantidadeParcelas: quantidadeParcelas.value }
        : {}),
    };
  }

  salvando.value = true;
  try {
    // Regra inviolável #4: nenhuma leitura para refazer AQUI — quem mostra
    // lista (visão do mês/extrato, tarefa #54) reage à invalidação do
    // recurso `lancamentos` que o servidor emite depois deste POST.
    await criarLancamento(corpo);
    fechar();
  } catch (e) {
    erro.value = mensagemDoErro(e, 'Não consegui registrar o lançamento.');
  } finally {
    salvando.value = false;
  }
}
</script>

<template>
  <div v-if="aberta" class="sheet-fundo" @click.self="fechar">
    <div class="sheet">
      <div class="sheet__cabecalho">
        <span class="sheet__titulo">Novo lançamento</span>
        <button type="button" class="sheet__fechar" aria-label="Fechar" @click="fechar">✕</button>
      </div>

      <!-- ⚠️ Fora de escopo (`.preator/CONTEXT.md`) — desenhados, não implementados (recorte §2.2). -->
      <div class="folha__pilulas">
        <button type="button" class="folha__pilula" @click="avisarRecibo">
          <i class="ti ti-camera"></i>
          Foto do recibo
        </button>
        <button type="button" class="folha__pilula" @click="avisarImportar">
          <i class="ti ti-file-import"></i>
          Importar extrato
        </button>
      </div>
      <p v-if="avisoForaDeEscopo" class="folha__aviso">{{ avisoForaDeEscopo }}</p>

      <!-- ── TIPO — 🟨 não é do desenho, ver comentário no <script> ────────── -->
      <div class="sheet__tipos folha__tipos">
        <button
          v-for="t in TIPOS_LANCAMENTO"
          :key="t.valor"
          type="button"
          class="sheet__tipo"
          :class="{ 'sheet__tipo--ativo': tipo === t.valor }"
          @click="escolherTipo(t.valor)"
        >
          <i class="ti" :class="t.icone"></i>
          <span>{{ t.rotulo }}</span>
        </button>
      </div>

      <!-- ── DESCRIÇÃO — 🟨 não é do desenho, ver comentário no <script> ───── -->
      <input
        v-model="descricao"
        type="text"
        placeholder="O que foi?"
        aria-label="Descrição do lançamento"
        class="sheet__nome folha__descricao"
      >

      <!-- ── LANÇAMENTO RÁPIDO (recorte §2.4) ─────────────────────────────────
           🟨 Sem fonte de dado: anatomia é do desenho, o CONTEÚDO não — ver
           comentário no topo do arquivo. -->
      <button type="button" class="folha__campo-toggle" @click="alternarAtalhos">
        <i class="ti ti-bolt folha__campo-icone-vazio folha__campo-icone-vazio--bolt"></i>
        <span class="folha__campo-rotulo-coluna">
          <span class="folha__campo-rotulo">LANÇAMENTO RÁPIDO</span>
        </span>
        <i class="ti folha__campo-seta" :class="abertoAtalhos ? 'ti-chevron-down' : 'ti-chevron-right'"></i>
      </button>
      <div v-if="abertoAtalhos" class="folha__lista folha__lista--atalhos">
        <p class="folha__lista-vazia">Nenhum atalho configurado ainda.</p>
      </div>

      <!-- ── CATEGORIA (recorte §2.5) — só em DESPESA (EF-04 §1) ──────────────── -->
      <template v-if="tipo === 'DESPESA'">
        <button type="button" class="folha__campo-toggle" @click="alternarCategoria">
          <span v-if="categoriaSelecionada" class="folha__campo-icone" :style="{ background: categoriaSelecionada.cor }">
            <i class="ti" :class="classeDoIconeCategoria(categoriaSelecionada.icone)"></i>
          </span>
          <i v-else class="ti ti-tag folha__campo-icone-vazio"></i>
          <span class="folha__campo-rotulo-coluna">
            <span class="folha__campo-rotulo">CATEGORIA</span>
            <span class="folha__campo-valor">{{ categoriaSelecionada?.nome ?? 'Escolher categoria' }}</span>
          </span>
          <i class="ti folha__campo-seta" :class="abertoCategoria ? 'ti-chevron-down' : 'ti-chevron-right'"></i>
        </button>
        <div v-if="abertoCategoria" class="folha__lista">
          <p v-if="categorias.length === 0" class="folha__lista-vazia">Nenhuma categoria cadastrada ainda.</p>
          <button
            v-for="c in categorias"
            :key="c.id"
            type="button"
            class="linha folha__item"
            @click="escolherCategoria(c)"
          >
            <span class="linha__icone" :style="{ background: c.cor }">
              <i class="ti" :class="classeDoIconeCategoria(c.icone)"></i>
            </span>
            <span class="linha__texto">
              <span class="linha__titulo">{{ c.nome }}</span>
              <span class="linha__sub">disponível {{ formatarCentavos(c.disponivelCentavos) }}</span>
            </span>
            <i v-if="c.id === categoriaId" class="ti ti-check folha__check"></i>
          </button>
        </div>
      </template>

      <!-- ── CONTA de origem (recorte §2.6) ───────────────────────────────────── -->
      <button type="button" class="folha__campo-toggle" @click="alternarConta">
        <span v-if="contaSelecionada" class="folha__campo-icone" :style="{ background: contaSelecionada.cor }">
          <i class="ti" :class="classeDoIcone(contaSelecionada.icone)"></i>
        </span>
        <i v-else class="ti ti-wallet folha__campo-icone-vazio"></i>
        <span class="folha__campo-rotulo-coluna">
          <span class="folha__campo-rotulo">{{ tipo === 'TRANSFERENCIA' ? 'CONTA DE ORIGEM' : 'CONTA' }}</span>
          <span class="folha__campo-valor">{{ contaSelecionada?.nome ?? 'Escolher conta' }}</span>
        </span>
        <i class="ti folha__campo-seta" :class="abertoConta ? 'ti-chevron-down' : 'ti-chevron-right'"></i>
      </button>
      <div v-if="abertoConta" class="folha__lista">
        <p v-if="contasParaOrigem.length === 0" class="folha__lista-vazia">Nenhuma conta cadastrada ainda.</p>
        <button
          v-for="c in contasParaOrigem"
          :key="c.id"
          type="button"
          class="linha folha__item"
          @click="escolherConta(c)"
        >
          <span class="linha__icone" :style="{ background: c.cor }">
            <i class="ti" :class="classeDoIcone(c.icone)"></i>
          </span>
          <span class="linha__texto">
            <span class="linha__titulo">{{ c.nome }}</span>
            <span class="linha__sub">{{ subDaConta(c) }}</span>
          </span>
          <i v-if="c.id === contaId" class="ti ti-check folha__check"></i>
        </button>
      </div>

      <!-- ── CONTA DE DESTINO — 🟨 só em TRANSFERENCIA, sem fonte no desenho ── -->
      <template v-if="tipo === 'TRANSFERENCIA'">
        <button type="button" class="folha__campo-toggle" @click="alternarContaDestino">
          <span
            v-if="contaDestinoSelecionada"
            class="folha__campo-icone"
            :style="{ background: contaDestinoSelecionada.cor }"
          >
            <i class="ti" :class="classeDoIcone(contaDestinoSelecionada.icone)"></i>
          </span>
          <i v-else class="ti ti-wallet folha__campo-icone-vazio"></i>
          <span class="folha__campo-rotulo-coluna">
            <span class="folha__campo-rotulo">CONTA DE DESTINO</span>
            <span class="folha__campo-valor">{{ contaDestinoSelecionada?.nome ?? 'Escolher conta' }}</span>
          </span>
          <i class="ti folha__campo-seta" :class="abertoContaDestino ? 'ti-chevron-down' : 'ti-chevron-right'"></i>
        </button>
        <div v-if="abertoContaDestino" class="folha__lista">
          <p v-if="contasParaDestino.length === 0" class="folha__lista-vazia">Nenhuma outra conta cadastrada ainda.</p>
          <button
            v-for="c in contasParaDestino"
            :key="c.id"
            type="button"
            class="linha folha__item"
            @click="escolherContaDestino(c)"
          >
            <span class="linha__icone" :style="{ background: c.cor }">
              <i class="ti" :class="classeDoIcone(c.icone)"></i>
            </span>
            <span class="linha__texto">
              <span class="linha__titulo">{{ c.nome }}</span>
              <span class="linha__sub">{{ subDaConta(c) }}</span>
            </span>
            <i v-if="c.id === contaDestinoId" class="ti ti-check folha__check"></i>
          </button>
        </div>
      </template>

      <!-- ── DATA · PARCELAS (recorte §2.7) ───────────────────────────────────── -->
      <div class="folha__linha-dupla">
        <div class="folha__data-campo">
          <div class="folha__campo-rotulo">DATA</div>
          <div class="folha__data-entrada">
            <i class="ti ti-calendar-event"></i>
            <input v-model="data" type="date" class="folha__data-input" aria-label="Data do lançamento">
          </div>
        </div>

        <div v-if="tipo === 'DESPESA'" class="folha__parcelas-campo">
          <div class="folha__campo-rotulo">PARCELAS</div>
          <div class="folha__parcelas-entrada">
            <button
              type="button"
              class="sheet__passo sheet__passo--pequeno"
              aria-label="Menos parcelas"
              @click="parcelasMenos"
            >
              −
            </button>
            <span class="folha__parcelas-valor">{{ quantidadeParcelas ?? 1 }}×</span>
            <button
              type="button"
              class="sheet__passo sheet__passo--pequeno"
              aria-label="Mais parcelas"
              @click="parcelasMais"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <!-- recorte §2.8 — texto e cor saem da regra, não do mockup (§6 ponto 3) -->
      <p v-if="dataHint" class="folha__hint" :style="{ color: corDataHint }">{{ dataHint }}</p>

      <!-- ── VALOR (recorte §2.3) ─────────────────────────────────────────────
           🟨 POSIÇÃO e CAMPO divergem do desenho, por decisão do humano:

           · No mockup o valor fica no TOPO da folha. Aqui ele desceu para
             ficar exatamente ACIMA do teclado — os dois formam uma peça só, e
             separá-los obrigava o olho a subir a folha inteira a cada tecla.
           · No mockup o valor é só EXIBIÇÃO, alimentada pelo teclado. Aqui é
             um campo digitável, porque no desktop o teclado numérico não faz
             sentido e some (ver `folha-lancamento.scss`).

           `inputmode="none"` é o que faz os dois mundos coexistirem: no celular
           o campo é focável mas o teclado DO SISTEMA não sobe — quem digita é o
           teclado da folha, que ficaria escondido atrás dele. No desktop o
           atributo é inerte e o teclado físico escreve normalmente. -->
      <div class="folha__valor-cartao">
        <label class="folha__valor-rotulo" for="folha-valor">VALOR</label>
        <input
          id="folha-valor"
          v-model="valorExibido"
          type="text"
          inputmode="none"
          placeholder="R$ 0,00"
          class="folha__valor-numero"
          :style="{ color: corValor }"
          @focus="valorFocado = true"
          @blur="valorFocado = false"
        >
        <div class="folha__valor-resumo">{{ resumoLanc }}</div>
      </div>

      <!-- ── TECLADO NUMÉRICO (recorte §2.9) ────────────────────────────────────
           Só no celular: no desktop `folha-lancamento.scss` o esconde, e o
           valor se digita no campo acima. -->
      <div class="folha__teclado">
        <button
          v-for="t in TECLAS"
          :key="t"
          type="button"
          class="folha__tecla"
          :aria-label="t === 'apagar' ? 'Apagar' : t"
          @click="apertarTecla(t)"
        >
          <i v-if="t === 'apagar'" class="ti ti-backspace"></i>
          <template v-else>{{ t }}</template>
        </button>
      </div>

      <p v-if="erro" class="sheet__erro" role="alert">{{ erro }}</p>

      <button
        type="button"
        class="botao sheet__salvar"
        :style="{ background: corSalvar }"
        :disabled="salvando"
        @click="salvar"
      >
        {{ labelSalvar }}
      </button>
    </div>
  </div>
</template>

<style lang="scss" src="~/assets/scss/components/folha-lancamento.scss" scoped></style>
