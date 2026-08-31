/**
 * Orçamento (EF-03) — categorias, teto por competência, renda prevista e
 * remanejamento.
 *
 * ⛔ Regra #0: RN-09..RN-14 e RN-40 vêm de
 * `.preator/skills/negocio/orcamento-por-envelope/SKILL.md` (glossário e
 * tabela "Regras de negócio"), que cita `docs/especificacoes/EF-03-orcamento.md`
 * §1/§2 como fonte primária. Nada aqui foi preenchido de memória.
 *
 * Os tipos vêm do CONTRATO GERADO — não redeclarados aqui (regra inviolável
 * #4 do projeto / D-03): importar de `@orcamento/contrato` é o que garante que
 * este arquivo nunca diverge do modelo que a API de fato aceita e devolve.
 * `tetoCentavos`, `gastoCentavos` e `disponivelCentavos` são DERIVADOS pela
 * leitura da competência (RN-10, RN-11, RN-40) — este módulo só os lê e os
 * manda mudar via API, nunca os recalcula no cliente.
 */
import type {
  AtualizarCategoria,
  Categoria,
  CompetenciaLida,
  DefinirRendaPrevista,
  DefinirTeto,
  NovaCategoria,
  NovoRemanejamento,
  OrcamentoMesLido,
  Remanejamento,
} from '@orcamento/contrato';

/**
 * Mesmo cabeçalho que `useContas.ts` usa — vai em toda mutação para que o
 * emissor da API devolva este id no evento de invalidação, e o `useRealtime`
 * descarte o próprio eco (R5). Mesmo nome literal de
 * `api/src/realtime/emissor.ts#CABECALHO_ORIGEM_CLIENTE`.
 */
const CABECALHO_ORIGEM_CLIENTE = 'x-origem-cliente';

/**
 * A folha `sheetEditCat` do mockup (MOCKUP-EF-03.md §2) traz uma grade de 8
 * cores, valores literais do desenho — não é escolha nova deste arquivo.
 */
export const CORES_CATEGORIA: readonly string[] = [
  '#14325a',
  '#2e6b8f',
  '#4c7d5a',
  '#8a5a2b',
  '#6b4a7d',
  '#2f6f6f',
  '#a04a4a',
  '#3d5a8a',
];

/**
 * Os 18 ícones da grade de `sheetEditCat` (MOCKUP-EF-03.md §2), na mesma
 * ordem do desenho. Ao contrário de `ICONES_CONTA` (`useContas.ts`), aqui a
 * CHAVE persistida é a própria classe Tabler — o mockup já guarda `icone`
 * dessa forma nos `cats` do protótipo, e traduzir para um vocabulário
 * português à parte não teria propósito: o back só exige "string não vazia"
 * (`esquemas.ts#camposDeCategoria`), então a classe literal já é o valor
 * mais direto que existe.
 */
export const ICONES_CATEGORIA: readonly string[] = [
  'ti-shopping-cart',
  'ti-home',
  'ti-school',
  'ti-gas-station',
  'ti-heartbeat',
  'ti-glass-full',
  'ti-device-tv',
  'ti-shirt',
  'ti-paw',
  'ti-plane',
  'ti-barbell',
  'ti-tools',
  'ti-gift',
  'ti-pill',
  'ti-bus',
  'ti-wifi',
  'ti-scissors',
  'ti-tag',
];

const CONJUNTO_ICONES_CATEGORIA = new Set<string>(ICONES_CATEGORIA);

/** Ícone neutro para uma categoria com `icone` fora do vocabulário desta tela — nunca quebra o render. */
const ICONE_PADRAO = 'ti-tag';

/**
 * A classe Tabler exibida para um `icone` persistido. Cai no ícone neutro
 * quando o valor não é um dos 18 do seletor — a tela renderiza mesmo assim,
 * em vez de quebrar por causa de um dado que ela não escreveu.
 */
export function classeDoIconeCategoria(icone: string): string {
  return CONJUNTO_ICONES_CATEGORIA.has(icone) ? icone : ICONE_PADRAO;
}

/**
 * Rótulo humano para cada uma das 8 cores da grade (`aria-label` — leitor de
 * tela não deve anunciar o hex cru). Nome, não regra de negócio: livre para
 * esta tela escolher, na mesma ordem de `CORES_CATEGORIA`.
 */
const NOME_DA_COR: Record<string, string> = {
  '#14325a': 'Azul-marinho',
  '#2e6b8f': 'Azul petróleo',
  '#4c7d5a': 'Verde musgo',
  '#8a5a2b': 'Marrom',
  '#6b4a7d': 'Roxo',
  '#2f6f6f': 'Verde-azulado',
  '#a04a4a': 'Vermelho terracota',
  '#3d5a8a': 'Azul-claro',
};

/** O nome acessível de uma cor da grade — cai no próprio hex se, por algum motivo, vier fora da lista. */
export function nomeDaCor(cor: string): string {
  return NOME_DA_COR[cor] ?? cor;
}

/**
 * Rótulo humano para cada um dos 18 ícones da grade (`aria-label` — leitor de
 * tela não deve anunciar a classe Tabler crua). Mesma ressalva de
 * `NOME_DA_COR`: nome de UI, não regra de negócio.
 */
const NOME_DO_ICONE: Record<string, string> = {
  'ti-shopping-cart': 'Carrinho de compras',
  'ti-home': 'Casa',
  'ti-school': 'Escola',
  'ti-gas-station': 'Posto de gasolina',
  'ti-heartbeat': 'Saúde',
  'ti-glass-full': 'Bebidas',
  'ti-device-tv': 'TV',
  'ti-shirt': 'Roupas',
  'ti-paw': 'Pet',
  'ti-plane': 'Viagem',
  'ti-barbell': 'Academia',
  'ti-tools': 'Ferramentas',
  'ti-gift': 'Presente',
  'ti-pill': 'Remédio',
  'ti-bus': 'Transporte',
  'ti-wifi': 'Internet',
  'ti-scissors': 'Cabelo e beleza',
  'ti-tag': 'Outros',
};

/** O nome acessível de um ícone da grade — cai na própria classe se vier fora da lista. */
export function nomeDoIcone(icone: string): string {
  return NOME_DO_ICONE[icone] ?? icone;
}

/**
 * Passo do −/+ do teto de cada categoria, na lista principal. O mockup não
 * declara um valor para este stepper (só para os da folha de remanejar, ver
 * abaixo) — escolhido por analogia de grandeza com os tetos do seed
 * (R$ 1.500 / R$ 400 em `semear.ts`).
 */
export const PASSO_TETO_CENTAVOS = 5000;

/**
 * Passo do −/+ da renda prevista. Mesma ausência de valor no mockup que o
 * teto; a renda familiar tende a ser uma ordem de grandeza maior, daí o
 * passo maior.
 */
export const PASSO_RENDA_CENTAVOS = 10000;

/**
 * Limiar mínimo de sobra para uma categoria aparecer como FONTE na folha de
 * remanejar — porta literal de `fontesBase = categorias com liberado >= 10`
 * (MOCKUP-EF-03.md §3, "a lógica do remanejo"). O mockup usa reais
 * fracionários; aqui o valor é convertido para centavos na borda (D-06):
 * R$ 10 = 1000 centavos.
 */
export const LIMIAR_FONTE_CENTAVOS = 1000;

/** Passo do −/+ de cada fonte na folha de remanejar — porta literal de "passo de 50" (R$ 50). */
export const PASSO_FONTE_BOTAO_CENTAVOS = 5000;

/** Passo do slider de cada fonte — porta literal de `step 10` (R$ 10) do mockup. */
export const PASSO_FONTE_SLIDER_CENTAVOS = 1000;

export function useOrcamento() {
  const api = useApi();
  const origemClienteId = useOrigemClienteId();

  const cabecalhoDeOrigem = { [CABECALHO_ORIGEM_CLIENTE]: origemClienteId };

  async function criarCategoria(dados: NovaCategoria): Promise<Categoria> {
    return api<Categoria>('/categorias', {
      method: 'POST',
      body: dados,
      headers: cabecalhoDeOrigem,
    });
  }

  async function atualizarCategoria(id: string, dados: AtualizarCategoria): Promise<Categoria> {
    return api<Categoria>(`/categorias/${id}`, {
      method: 'PATCH',
      body: dados,
      headers: cabecalhoDeOrigem,
    });
  }

  async function excluirCategoria(id: string): Promise<void> {
    await api(`/categorias/${id}`, {
      method: 'DELETE',
      headers: cabecalhoDeOrigem,
    });
  }

  /**
   * A leitura da competência (RN-10, RN-11, RN-40): renda prevista,
   * planejado, recebido, não alocado e categorias com teto/gasto/disponível.
   */
  async function lerCompetencia(competencia: string): Promise<CompetenciaLida> {
    return api<CompetenciaLida>(`/competencias/${competencia}`);
  }

  /** RN-12: referência de planejamento — nunca altera teto nenhum. */
  async function definirRendaPrevista(competencia: string, rendaPrevistaCentavos: number): Promise<void> {
    const corpo: DefinirRendaPrevista = { rendaPrevistaCentavos };
    await api(`/competencias/${competencia}/renda-prevista`, {
      method: 'PUT',
      body: corpo,
      headers: cabecalhoDeOrigem,
    });
  }

  /** RN-09 — define o teto de UMA categoria NESTA competência. */
  async function definirTeto(
    competencia: string,
    categoriaId: string,
    tetoCentavos: number,
  ): Promise<OrcamentoMesLido> {
    const corpo: DefinirTeto = { tetoCentavos };
    return api<OrcamentoMesLido>(`/competencias/${competencia}/categorias/${categoriaId}/teto`, {
      method: 'PUT',
      body: corpo,
      headers: cabecalhoDeOrigem,
    });
  }

  /**
   * RN-13/RN-14 — move teto de UMA origem para UM destino, só nesta
   * competência, sem trava. A folha de remanejar (várias fontes por vez)
   * chama isto uma vez por fonte com valor > 0 — a API só sabe mover um par
   * por chamada (`NovoRemanejamento`); a sugestão por fonte é da tela, a
   * mutação é sempre deste único endpoint (MOCKUP-EF-03.md, anotação do
   * condutor).
   */
  async function criarRemanejamento(competencia: string, entrada: NovoRemanejamento): Promise<Remanejamento> {
    return api<Remanejamento>(`/competencias/${competencia}/remanejamentos`, {
      method: 'POST',
      body: entrada,
      headers: cabecalhoDeOrigem,
    });
  }

  return {
    criarCategoria,
    atualizarCategoria,
    excluirCategoria,
    lerCompetencia,
    definirRendaPrevista,
    definirTeto,
    criarRemanejamento,
  };
}
