<script setup lang="ts">
/**
 * ORÇAMENTO (EF-03) — a tela `config` do mockup ("Orçamento do mês") + a
 * folha `sheetEditCat` (editar categoria) + a folha `sheetRemanejar`
 * (remanejar teto). Recorte em `MOCKUP-EF-03.md`, na raiz do worktree — ele é
 * a fonte de tela, não ilustração; não commitado (artefato do condutor).
 *
 * O título "Orçamento" já vem do shell (via `config/navegacao.ts`, rota
 * `/orcamento`), então esta tela só acrescenta o subtítulo do desenho —
 * mesmo padrão de `contas.vue`.
 *
 * `tetoCentavos`, `gastoCentavos`, `disponivelCentavos`, `planejadoCentavos`,
 * `recebidoCentavos` e `naoAlocadoCentavos` são DERIVADOS pelo servidor
 * (RN-10, RN-11, RN-40) — esta tela só formata para exibir (D-06) e manda a
 * INTENÇÃO de mudança pela API; nunca reproduz o cálculo (regra inviolável
 * #4 do projeto — o socket manda invalidação, o cliente refaz a leitura).
 *
 * ⛔ Regra #0: RN-09..RN-14 e RN-40 vêm de
 * `.preator/skills/negocio/orcamento-por-envelope/SKILL.md`, que cita
 * `docs/especificacoes/EF-03-orcamento.md` §1/§2 como fonte primária.
 */
import type { CategoriaNaCompetencia, CompetenciaLida } from '@orcamento/contrato';
import {
  CORES_CATEGORIA,
  ICONES_CATEGORIA,
  LIMIAR_FONTE_CENTAVOS,
  PASSO_FONTE_BOTAO_CENTAVOS,
  PASSO_FONTE_SLIDER_CENTAVOS,
  PASSO_RENDA_CENTAVOS,
  PASSO_TETO_CENTAVOS,
  classeDoIconeCategoria,
  nomeDaCor,
  nomeDoIcone,
  useOrcamento,
} from '~/composables/useOrcamento';
import { centavosParaTexto, formatarCentavos, textoParaCentavos } from '~/utils/dinheiro';

const {
  criarCategoria,
  atualizarCategoria,
  excluirCategoria,
  lerCompetencia,
  definirRendaPrevista,
  definirTeto,
  criarRemanejamento,
} = useOrcamento();

// ── LEITURA DA COMPETÊNCIA ──────────────────────────────────────────────

/**
 * O mês ativo NÃO é estado desta tela: vem do shell, via `useCompetencia`.
 * O seletor mora na barra de topo do app, porque a EF-04 (visão do mês) e a
 * EF-08 (fechamento) leem a MESMA competência — duas telas com dois meses
 * ativos seria segunda fonte da verdade sobre o período.
 *
 * Aqui a tela só OBSERVA: quando o mês muda, ela relê. Quem troca é o shell.
 */
const { competencia, rotulo: rotuloDoMesAtivo } = useCompetencia();

const leitura = ref<CompetenciaLida | null>(null);

const carregando = ref(true);
const erroLista = ref<string | null>(null);
const mutando = ref(false);
const mutandoRenda = ref(false);
const criandoCategoria = ref(false);

const categorias = computed<CategoriaNaCompetencia[]>(() => leitura.value?.categorias ?? []);
const rendaPrevistaCentavos = computed(() => leitura.value?.rendaPrevistaCentavos ?? 0);
const recebidoCentavos = computed(() => leitura.value?.recebidoCentavos ?? 0);

async function carregar(): Promise<void> {
  try {
    leitura.value = await lerCompetencia(competencia.value);
    erroLista.value = null;
  } catch (erro) {
    erroLista.value = mensagemDoErro(erro, 'Não consegui carregar o orçamento do mês.');
  } finally {
    carregando.value = false;
  }
}

onMounted(carregar);

// O mês é do shell: quando ele troca, esta tela recarrega a competência nova.
watch(competencia, async () => {
  carregando.value = true;
  await carregar();
});

// Tempo real (EF-00 R2-R5): ao chegar invalidação do recurso "orcamento" —
// ou ao reconectar —, refaz a leitura da competência ativa. O próprio eco
// desta aba já é descartado pelo `useRealtime`; as mutações que ESTA aba faz
// se resolvem chamando `carregar()` direto após a resposta HTTP, sem esperar
// o socket.
useRealtime({
  recursos: ['orcamento'],
  competenciaAtiva: computed(() => competencia.value),
  aoInvalidar: async () => {
    await carregar();
  },
});

// ── RENDA PREVISTA ───────────────────────────────────────────────────────

async function mudarRenda(valor: number): Promise<void> {
  if (mutandoRenda.value) return;
  mutandoRenda.value = true;
  erroLista.value = null;
  try {
    await definirRendaPrevista(competencia.value, valor);
    await carregar();
  } catch (erro) {
    erroLista.value = mensagemDoErro(erro, 'Não consegui atualizar a renda prevista.');
  } finally {
    mutandoRenda.value = false;
  }
}
function rendaMenos(): void {
  void mudarRenda(Math.max(0, rendaPrevistaCentavos.value - PASSO_RENDA_CENTAVOS));
}
function rendaMais(): void {
  void mudarRenda(rendaPrevistaCentavos.value + PASSO_RENDA_CENTAVOS);
}

/**
 * O campo digitável da renda prevista — para valor quebrado, que o passo de
 * `PASSO_RENDA_CENTAVOS` não alcança sem dezenas de cliques.
 *
 * Os steppers CONTINUAM: eles são o caminho rápido do desenho, e o campo é o
 * caminho preciso. Mesmo par que a folha de conta já usa.
 *
 * `editandoRenda` existe para o valor não ser reformatado embaixo do cursor
 * enquanto a pessoa digita — e para a releitura da competência (que o socket
 * pode disparar a qualquer momento) não sobrescrever o que ela está escrevendo.
 */
const rendaTexto = ref(centavosParaTexto(0));
const editandoRenda = ref(false);

watch(rendaPrevistaCentavos, centavos => {
  if (!editandoRenda.value) rendaTexto.value = centavosParaTexto(centavos);
}, { immediate: true });

function focarRenda(): void {
  editandoRenda.value = true;
}

/** Ao sair do campo: normaliza o texto e só chama a API se o valor mudou de verdade. */
function confirmarRenda(): void {
  editandoRenda.value = false;
  const centavos = textoParaCentavos(rendaTexto.value);
  rendaTexto.value = centavosParaTexto(centavos);
  if (centavos !== rendaPrevistaCentavos.value) void mudarRenda(centavos);
}

// ── LISTA DE CATEGORIAS · teto direto (−/+) e remoção (✕) ───────────────

async function mudarTeto(c: CategoriaNaCompetencia, tetoCentavos: number): Promise<void> {
  if (mutando.value) return;
  mutando.value = true;
  erroLista.value = null;
  try {
    await definirTeto(competencia.value, c.id, tetoCentavos);
    await carregar();
  } catch (erro) {
    erroLista.value = mensagemDoErro(erro, 'Não consegui atualizar o teto.');
  } finally {
    mutando.value = false;
  }
}
function tetoMenos(c: CategoriaNaCompetencia): void {
  void mudarTeto(c, Math.max(0, c.tetoCentavos - PASSO_TETO_CENTAVOS));
}
function tetoMais(c: CategoriaNaCompetencia): void {
  void mudarTeto(c, c.tetoCentavos + PASSO_TETO_CENTAVOS);
}

async function removerCategoria(c: CategoriaNaCompetencia): Promise<void> {
  if (mutando.value) return;
  mutando.value = true;
  erroLista.value = null;
  try {
    await excluirCategoria(c.id);
    await carregar();
  } catch (erro) {
    erroLista.value = mensagemDoErro(erro, 'Não consegui remover a categoria.');
  } finally {
    mutando.value = false;
  }
}

// ── CRIAR CATEGORIA ──────────────────────────────────────────────────────

const novoNome = ref('');

async function criarCategoriaNova(): Promise<void> {
  const nome = novoNome.value.trim();
  if (!nome || criandoCategoria.value) return;

  criandoCategoria.value = true;
  erroLista.value = null;
  try {
    await criarCategoria({ nome, icone: ICONES_CATEGORIA[0]!, cor: CORES_CATEGORIA[0]! });
    novoNome.value = '';
    await carregar();
  } catch (erro) {
    erroLista.value = mensagemDoErro(erro, 'Não consegui criar a categoria.');
  } finally {
    criandoCategoria.value = false;
  }
}

// ── FOLHA · sheetEditCat — nome · cor · ícone ────────────────────────────

const sheetCategoriaAberta = ref(false);
const categoriaEmEdicao = ref<CategoriaNaCompetencia | null>(null);
const nomeCategoria = ref('');
const corCategoria = ref<string>(CORES_CATEGORIA[0]!);
const iconeCategoria = ref<string>(ICONES_CATEGORIA[0]!);
const salvandoCategoria = ref(false);
const erroCategoria = ref<string | null>(null);

/**
 * O teto entra na folha para poder ser DIGITADO — valor quebrado pelos
 * steppers da lista custa dezenas de cliques.
 *
 * ⚠️ Ele é de outro recurso: nome/cor/ícone são da `Categoria`
 * (`PATCH /categorias/:id`), o teto é do par categoria × competência
 * (`PUT /competencias/:c/categorias/:id/teto`, RN-09). Salvar a folha pode,
 * portanto, disparar DUAS chamadas — e o tratamento de falha parcial abaixo
 * existe por isso.
 */
const tetoTexto = ref(centavosParaTexto(0));
const tetoOriginalCentavos = ref(0);

function abrirEdicaoCategoria(c: CategoriaNaCompetencia): void {
  categoriaEmEdicao.value = c;
  nomeCategoria.value = c.nome;
  corCategoria.value = c.cor;
  iconeCategoria.value = c.icone;
  tetoOriginalCentavos.value = c.tetoCentavos;
  tetoTexto.value = centavosParaTexto(c.tetoCentavos);
  erroCategoria.value = null;
  sheetCategoriaAberta.value = true;
}

/** Normaliza o texto do teto ao sair do campo — sem chamar a API: quem salva é o "Concluir". */
function normalizarTeto(): void {
  tetoTexto.value = centavosParaTexto(textoParaCentavos(tetoTexto.value));
}
// Nomes distintos dos `tetoMenos`/`tetoMais` da LISTA de propósito: aqueles
// mutam a API na hora, com a categoria como argumento; estes só mexem no texto
// da folha, e quem salva é o "Concluir".
function tetoDaFolhaMenos(): void {
  const atual = textoParaCentavos(tetoTexto.value);
  tetoTexto.value = centavosParaTexto(Math.max(0, atual - PASSO_TETO_CENTAVOS));
}
function tetoDaFolhaMais(): void {
  tetoTexto.value = centavosParaTexto(textoParaCentavos(tetoTexto.value) + PASSO_TETO_CENTAVOS);
}
function fecharSheetCategoria(): void {
  sheetCategoriaAberta.value = false;
}

async function salvarCategoria(): Promise<void> {
  if (!categoriaEmEdicao.value || salvandoCategoria.value) return;

  const nome = nomeCategoria.value.trim();
  if (!nome) {
    erroCategoria.value = 'Dê um nome para a categoria.';
    return;
  }

  const id = categoriaEmEdicao.value.id;
  const tetoCentavos = textoParaCentavos(tetoTexto.value);
  const tetoMudou = tetoCentavos !== tetoOriginalCentavos.value;

  salvandoCategoria.value = true;
  erroCategoria.value = null;

  // A folha muda DOIS recursos. Se a segunda chamada falhar, a primeira já
  // aconteceu no servidor — a folha fica aberta, relê para mostrar o que de
  // fato passou, e diz qual metade faltou. Sem inventar atomicidade: não há RN
  // que a exija, e fingir transação onde não há é pior que declarar o estado.
  let identidadeSalva = false;
  try {
    await atualizarCategoria(id, {
      nome,
      icone: iconeCategoria.value,
      cor: corCategoria.value,
    });
    identidadeSalva = true;

    if (tetoMudou) await definirTeto(competencia.value, id, tetoCentavos);

    await carregar();
    sheetCategoriaAberta.value = false;
  } catch (erro) {
    const mensagem = mensagemDoErro(erro, 'Não consegui salvar a categoria.');
    erroCategoria.value = identidadeSalva
      ? `Nome, cor e ícone foram salvos; o teto não (${mensagem}). Confira o valor e tente de novo.`
      : mensagem;

    await carregar();
    // Realinha a folha com o que o servidor tem agora, para um novo "Concluir"
    // não reenviar o que já passou nem apagar o que a pessoa acabou de digitar.
    const atualizada = categorias.value.find(c => c.id === id);
    if (atualizada) {
      categoriaEmEdicao.value = atualizada;
      tetoOriginalCentavos.value = atualizada.tetoCentavos;
    }
  } finally {
    salvandoCategoria.value = false;
  }
}

// ── FOLHA · sheetRemanejar — escolher de onde tirar, ou deixar negativo ──
//
// Entrada: o cartão de estouro aparece na categoria quando
// `disponivelCentavos < 0` (RN-10) — hoje só acontece depois de um
// remanejamento anterior ter deixado alguma categoria negativa (RN-14: a API
// não impõe piso na origem), já que o gasto ainda é sempre 0 enquanto a
// EF-04 não existe (ver `api/src/modulos/orcamento/servico.ts`).
//
// O cartão é o DESENHADO pelo mockup — MOCKUP-EF-03.md §6 (adendo): ele vive
// na tela `home` do protótipo (`sc-if temEstouro`), fora do recorte original
// desta tarefa, mas o gatilho e a cópia SÃO do desenho, não inventados. A
// colocação canônica na `home` é da EF-04 (`web/app/pages/index`, fora do
// escopo da #45) — quem construir aquela tela deve reaproveitar este mesmo
// cartão e esta mesma cópia, não desenhar um terceiro.

/** `estouroTitulo` do mockup — MOCKUP-EF-03.md §6: "<Categoria> passou R$ X do teto". */
function tituloEstouro(c: CategoriaNaCompetencia): string {
  return `${c.nome} passou ${formatarCentavos(Math.abs(c.disponivelCentavos))} do teto`;
}

interface FonteRemanejo {
  categoria: CategoriaNaCompetencia;
  valorCentavos: number;
}

const sheetRemanejarAberta = ref(false);
const categoriaDestino = ref<CategoriaNaCompetencia | null>(null);
const fontes = ref<FonteRemanejo[]>([]);
const salvandoRemanejo = ref(false);
const erroRemanejo = ref<string | null>(null);

function abrirRemanejar(c: CategoriaNaCompetencia): void {
  categoriaDestino.value = c;

  const outras = categorias.value
    .filter(cat => cat.id !== c.id && cat.disponivelCentavos >= LIMIAR_FONTE_CENTAVOS)
    .sort((a, b) => b.disponivelCentavos - a.disponivelCentavos);
  fontes.value = outras.map(categoria => ({ categoria, valorCentavos: 0 }));

  erroRemanejo.value = null;
  sheetRemanejarAberta.value = true;
}
function fecharSheetRemanejar(): void {
  sheetRemanejarAberta.value = false;
}

const estouroTitulo = computed(() => {
  const destino = categoriaDestino.value;
  if (!destino) return '';
  return destino.disponivelCentavos < 0 ? tituloEstouro(destino) : `Remanejar para ${destino.nome}`;
});

/** RN-13, cópia literal do mockup (MOCKUP-EF-03.md §3). */
const REMANEJAR_SUBTITULO = 'Escolha de onde tirar. O teto muda só neste mês.';
/** RN-14, cópia literal do mockup — o estado "sem fonte" que a EF exige que a tela ofereça, não trave. */
const REMANEJAR_SEM_FONTE = 'Nenhuma categoria tem sobra este mês. Dá para deixar negativo e ajustar no fechamento.';

const faltaRem = computed(() => {
  const destino = categoriaDestino.value;
  return destino ? Math.max(0, -destino.disponivelCentavos) : 0;
});
const remSoma = computed(() => fontes.value.reduce((soma, f) => soma + f.valorCentavos, 0));
const faltaAtual = computed(() => faltaRem.value - remSoma.value);
const remFaltaLabel = computed(() => (faltaAtual.value < 0 ? 'PASSOU DO NECESSÁRIO' : 'AINDA FALTA'));
const corFalta = computed(() => {
  if (faltaAtual.value < 0) return '#ffb74d';
  if (faltaAtual.value === 0) return '#a5d6a7';
  return '#fff';
});

function definirValorFonte(fonte: FonteRemanejo, valor: number): void {
  fonte.valorCentavos = Math.max(0, Math.min(fonte.categoria.disponivelCentavos, Math.round(valor)));
}
function fonteMenos(fonte: FonteRemanejo): void {
  definirValorFonte(fonte, fonte.valorCentavos - PASSO_FONTE_BOTAO_CENTAVOS);
}
function fonteMais(fonte: FonteRemanejo): void {
  definirValorFonte(fonte, fonte.valorCentavos + PASSO_FONTE_BOTAO_CENTAVOS);
}

/** Porta literal do algoritmo do mockup (MOCKUP-EF-03.md §3, "a lógica do remanejo"). */
function sugeridoDaFonte(fonte: FonteRemanejo): number {
  const max = fonte.categoria.disponivelCentavos;
  const sugestao = faltaRem.value - remSoma.value + fonte.valorCentavos;
  return Math.max(0, Math.min(max, sugestao));
}
function podeAtalho(fonte: FonteRemanejo): boolean {
  return sugeridoDaFonte(fonte) > 0 || fonte.valorCentavos > 0;
}
function rotuloAtalho(fonte: FonteRemanejo): string {
  const sugestao = sugeridoDaFonte(fonte);
  if (fonte.valorCentavos > 0 && fonte.valorCentavos === sugestao) return 'Zerar';
  return `Usar ${formatarCentavos(sugestao)}`;
}
function acionarAtalho(fonte: FonteRemanejo): void {
  const sugestao = sugeridoDaFonte(fonte);
  definirValorFonte(fonte, fonte.valorCentavos > 0 && fonte.valorCentavos === sugestao ? 0 : sugestao);
}

const remLabelBotao = computed(() => {
  const destino = categoriaDestino.value;
  if (!destino || remSoma.value <= 0) return 'Escolha quanto tirar de cada uma';
  return `Transferir ${formatarCentavos(remSoma.value)} para ${destino.nome}`;
});

async function confirmarRemanejamento(): Promise<void> {
  const destino = categoriaDestino.value;
  if (!destino || remSoma.value <= 0) {
    erroRemanejo.value = 'Defina o valor que sai de cada categoria.';
    return;
  }
  if (salvandoRemanejo.value) return;

  salvandoRemanejo.value = true;
  erroRemanejo.value = null;

  const aTentar = fontes.value.filter(f => f.valorCentavos > 0);
  const aplicadas: FonteRemanejo[] = [];

  try {
    // A API só move UM par origem→destino por chamada — uma chamada por
    // fonte com valor > 0, em sequência (anotação do condutor em
    // MOCKUP-EF-03.md §3: "o front manda a intenção e relê"). PARA na
    // PRIMEIRA falha — `for...of` com `await` já faz isso — em vez de
    // seguir tentando as fontes restantes.
    for (const fonte of aTentar) {
      await criarRemanejamento(competencia.value, {
        categoriaOrigemId: fonte.categoria.id,
        categoriaDestinoId: destino.id,
        valorCentavos: fonte.valorCentavos,
      });
      aplicadas.push(fonte);
    }

    await carregar();
    sheetRemanejarAberta.value = false;
  } catch (erro) {
    // Falha parcial: o que já passou ficou de pé no servidor (cada chamada é
    // um remanejamento próprio, RN-13) — a tela PRECISA reler para não
    // mostrar número velho, e a folha PRECISA continuar aberta com o que
    // ainda falta, em vez de fechar como se nada tivesse dado certo.
    await carregar();

    const destinoAtualizado = categorias.value.find(c => c.id === destino.id) ?? null;
    categoriaDestino.value = destinoAtualizado;

    // As fontes já aplicadas viram 0 — reenviá-las de novo DUPLICARIA a
    // transferência que já aconteceu. As que ainda faltam mantêm o valor
    // escolhido (ajustado ao teto que sobrou), prontas para um novo clique.
    fontes.value = fontes.value.reduce<FonteRemanejo[]>((restantes, fonte) => {
      const atualizada = categorias.value.find(c => c.id === fonte.categoria.id);
      if (!atualizada) return restantes; // categoria removida por outra aba nesse meio-tempo
      const foiAplicada = aplicadas.includes(fonte);
      restantes.push({
        categoria: atualizada,
        valorCentavos: foiAplicada ? 0 : Math.min(fonte.valorCentavos, atualizada.disponivelCentavos),
      });
      return restantes;
    }, []);

    const mensagem = mensagemDoErro(erro, 'não consegui completar');
    erroRemanejo.value =
      aplicadas.length > 0
        ? `${aplicadas.length} de ${aTentar.length} categorias já foram movidas para ${destino.nome} ` +
          `antes de falhar (${mensagem}). Confira os valores e tente de novo para o restante.`
        : `Não consegui remanejar nenhuma categoria: ${mensagem}`;
  } finally {
    salvandoRemanejo.value = false;
  }
}

/** RN-14 — a tela NÃO trava: fecha a folha sem mutação nenhuma, aceitando o teto negativo. */
function deixarNegativo(): void {
  fecharSheetRemanejar();
}
</script>

<template>
  <section class="orcamento">
    <p class="orcamento__subtitulo">Categorias e tetos, do jeito de casa</p>

    <p v-if="carregando" class="orcamento__vazio">Carregando…</p>
    <p v-else-if="erroLista" class="orcamento__vazio orcamento__vazio--erro" role="alert">{{ erroLista }}</p>

    <template v-else>
      <!-- ── RENDA PREVISTA ─────────────────────────────────────────────── -->
      <div class="orcamento__renda">
        <div class="orcamento__renda-rotulo">Renda prevista no mês</div>
        <div class="orcamento__renda-controle">
          <button
            type="button"
            class="orcamento__passo"
            aria-label="Diminuir renda prevista"
            :disabled="mutandoRenda"
            @click="rendaMenos"
          >
            −
          </button>
          <input
            v-model="rendaTexto"
            class="orcamento__renda-campo"
            type="text"
            inputmode="decimal"
            aria-label="Renda prevista no mês"
            :disabled="mutandoRenda"
            @focus="focarRenda"
            @blur="confirmarRenda"
            @keyup.enter="confirmarRenda"
          >
          <button
            type="button"
            class="orcamento__passo"
            aria-label="Aumentar renda prevista"
            :disabled="mutandoRenda"
            @click="rendaMais"
          >
            +
          </button>
        </div>
        <p class="orcamento__renda-aviso">
          Recebido até agora {{ formatarCentavos(recebidoCentavos) }}.
          Os tetos se desbloqueiam conforme o dinheiro entra.
        </p>
      </div>

      <!-- ── LISTA DE CATEGORIAS ────────────────────────────────────────── -->
      <p v-if="categorias.length === 0" class="orcamento__vazio">Nenhuma categoria cadastrada ainda.</p>

      <div v-else class="orcamento__lista">
        <div v-for="c in categorias" :key="c.id" class="orcamento__cartao">
          <div class="orcamento__linha">
            <button type="button" class="orcamento__identidade" @click="abrirEdicaoCategoria(c)">
              <span class="orcamento__icone" :style="{ background: c.cor }">
                <i class="ti" :class="classeDoIconeCategoria(c.icone)"></i>
              </span>
              <span class="orcamento__texto">
                <span class="orcamento__nome">{{ formatarCentavos(c.tetoCentavos) }}</span>
                <span class="orcamento__sub">{{ c.nome }}</span>
              </span>
            </button>

            <div class="orcamento__acoes">
              <button
                type="button"
                class="orcamento__passo orcamento__passo--pequeno"
                aria-label="Diminuir teto"
                :disabled="mutando"
                @click="tetoMenos(c)"
              >
                −
              </button>
              <button
                type="button"
                class="orcamento__passo orcamento__passo--pequeno"
                aria-label="Aumentar teto"
                :disabled="mutando"
                @click="tetoMais(c)"
              >
                +
              </button>
              <button
                type="button"
                class="orcamento__remover"
                aria-label="Remover categoria"
                :disabled="mutando"
                @click="removerCategoria(c)"
              >
                ✕
              </button>
            </div>
          </div>

          <!--
            Cartão canônico do mockup (MOCKUP-EF-03.md §6, adendo) — o mesmo
            que a tela `home` (EF-04) vai usar quando existir; ver comentário
            no <script> desta tela.
          -->
          <div v-if="c.disponivelCentavos < 0" class="orcamento__cartao-estouro">
            <div class="orcamento__cartao-estouro-texto">
              <p class="orcamento__cartao-estouro-titulo">{{ tituloEstouro(c) }}</p>
              <p class="orcamento__cartao-estouro-subtitulo">Cobrir com o saldo de outra categoria</p>
            </div>
            <button type="button" class="orcamento__cartao-estouro-botao" @click="abrirRemanejar(c)">
              Remanejar
            </button>
          </div>
        </div>
      </div>

      <!-- ── CRIAR CATEGORIA ────────────────────────────────────────────── -->
      <div class="orcamento__nova">
        <input
          v-model="novoNome"
          type="text"
          placeholder="Nova categoria"
          class="orcamento__nova-input"
          :disabled="criandoCategoria"
          @keyup.enter="criarCategoriaNova"
        >
        <button type="button" class="orcamento__nova-botao" :disabled="!novoNome.trim() || criandoCategoria" @click="criarCategoriaNova">
          {{ criandoCategoria ? 'Criando…' : 'Criar' }}
        </button>
      </div>
    </template>

    <!-- ── FOLHA · sheetEditCat — nome · cor · ícone ──────────────────────── -->
    <div v-if="sheetCategoriaAberta" class="sheet-fundo" @click.self="fecharSheetCategoria">
      <div class="sheet">
        <div class="sheet__cabecalho">
          <span class="sheet__titulo">Categoria</span>
          <button type="button" class="sheet__fechar" aria-label="Fechar" @click="fecharSheetCategoria">✕</button>
        </div>

        <input v-model="nomeCategoria" type="text" placeholder="Nome da categoria" class="sheet__nome">

        <div class="sheet__rotulo-secao">TETO DO MÊS</div>
        <div class="sheet__teto">
          <button
            type="button"
            class="orcamento__passo"
            aria-label="Diminuir teto"
            :disabled="salvandoCategoria"
            @click="tetoDaFolhaMenos"
          >
            −
          </button>
          <input
            v-model="tetoTexto"
            class="sheet__teto-campo"
            type="text"
            inputmode="decimal"
            :aria-label="`Teto de ${rotuloDoMesAtivo}`"
            :disabled="salvandoCategoria"
            @blur="normalizarTeto"
          >
          <button
            type="button"
            class="orcamento__passo"
            aria-label="Aumentar teto"
            :disabled="salvandoCategoria"
            @click="tetoDaFolhaMais"
          >
            +
          </button>
        </div>
        <p class="sheet__teto-nota">Vale só para {{ rotuloDoMesAtivo }} — o teto é do mês, não da categoria.</p>

        <div class="sheet__rotulo-secao">COR</div>
        <div class="sheet__cores">
          <button
            v-for="cor in CORES_CATEGORIA"
            :key="cor"
            type="button"
            class="sheet__cor-opcao"
            :class="{ 'sheet__cor-opcao--ativo': corCategoria === cor }"
            :style="{ background: cor }"
            :aria-label="`Cor ${nomeDaCor(cor)}`"
            @click="corCategoria = cor"
          >
            <i v-if="corCategoria === cor" class="ti ti-check"></i>
          </button>
        </div>

        <div class="sheet__rotulo-secao">ÍCONE</div>
        <div class="sheet__icones">
          <button
            v-for="icone in ICONES_CATEGORIA"
            :key="icone"
            type="button"
            class="sheet__icone-opcao"
            :class="{ 'sheet__icone-opcao--ativo': iconeCategoria === icone }"
            :aria-label="nomeDoIcone(icone)"
            @click="iconeCategoria = icone"
          >
            <i class="ti" :class="icone"></i>
          </button>
        </div>

        <p v-if="erroCategoria" class="sheet__erro" role="alert">{{ erroCategoria }}</p>

        <button type="button" class="botao sheet__salvar" :disabled="salvandoCategoria" @click="salvarCategoria">
          {{ salvandoCategoria ? 'Salvando…' : 'Concluir' }}
        </button>
      </div>
    </div>

    <!-- ── FOLHA · sheetRemanejar — escolher de onde tirar, ou deixar negativo ── -->
    <div v-if="sheetRemanejarAberta" class="sheet-fundo" @click.self="fecharSheetRemanejar">
      <div class="sheet">
        <div class="sheet__cabecalho">
          <span class="sheet__titulo">{{ estouroTitulo }}</span>
          <button type="button" class="sheet__fechar" aria-label="Fechar" @click="fecharSheetRemanejar">✕</button>
        </div>
        <p class="orcamento__remanejar-subtitulo">{{ REMANEJAR_SUBTITULO }}</p>

        <p v-if="fontes.length === 0" class="orcamento__sem-fonte">{{ REMANEJAR_SEM_FONTE }}</p>

        <template v-else>
          <div class="orcamento__totais">
            <div class="orcamento__totais-lado">
              <div class="orcamento__totais-rotulo">SELECIONADO</div>
              <div class="orcamento__totais-valor">{{ formatarCentavos(remSoma) }}</div>
            </div>
            <div class="orcamento__totais-lado orcamento__totais-lado--direita">
              <div class="orcamento__totais-rotulo">{{ remFaltaLabel }}</div>
              <div class="orcamento__totais-valor" :style="{ color: corFalta }">{{ formatarCentavos(Math.abs(faltaAtual)) }}</div>
            </div>
          </div>

          <div class="orcamento__fontes">
            <div
              v-for="fonte in fontes"
              :key="fonte.categoria.id"
              class="orcamento__fonte"
              :class="{ 'orcamento__fonte--com-valor': fonte.valorCentavos > 0 }"
            >
              <div class="orcamento__fonte-linha1">
                <span class="orcamento__icone orcamento__icone--pequeno" :style="{ background: fonte.categoria.cor }">
                  <i class="ti" :class="classeDoIconeCategoria(fonte.categoria.icone)"></i>
                </span>
                <span class="orcamento__texto">
                  <span class="orcamento__nome">{{ fonte.categoria.nome }}</span>
                  <span class="orcamento__sub">sobra {{ formatarCentavos(fonte.categoria.disponivelCentavos) }}</span>
                </span>
                <span class="orcamento__fonte-valor">{{ fonte.valorCentavos > 0 ? formatarCentavos(fonte.valorCentavos) : '—' }}</span>
              </div>
              <div class="orcamento__fonte-linha2">
                <button type="button" class="orcamento__passo orcamento__passo--pequeno" aria-label="Diminuir" @click="fonteMenos(fonte)">−</button>
                <input
                  v-model.number="fonte.valorCentavos"
                  type="range"
                  min="0"
                  :max="fonte.categoria.disponivelCentavos"
                  :step="PASSO_FONTE_SLIDER_CENTAVOS"
                  class="orcamento__fonte-slider"
                  :aria-label="`Quanto tirar de ${fonte.categoria.nome}`"
                >
                <button type="button" class="orcamento__passo orcamento__passo--pequeno" aria-label="Aumentar" @click="fonteMais(fonte)">+</button>
                <button v-if="podeAtalho(fonte)" type="button" class="orcamento__fonte-atalho" @click="acionarAtalho(fonte)">
                  {{ rotuloAtalho(fonte) }}
                </button>
              </div>
            </div>
          </div>
        </template>

        <p v-if="erroRemanejo" class="sheet__erro" role="alert">{{ erroRemanejo }}</p>

        <button
          type="button"
          class="botao sheet__salvar"
          :disabled="salvandoRemanejo || remSoma <= 0"
          @click="confirmarRemanejamento"
        >
          {{ salvandoRemanejo ? 'Transferindo…' : remLabelBotao }}
        </button>
        <button type="button" class="orcamento__negativo" @click="deixarNegativo">Deixar negativo</button>
      </div>
    </div>
  </section>
</template>

<style lang="scss" src="~/assets/scss/pages/orcamento.scss" scoped></style>
