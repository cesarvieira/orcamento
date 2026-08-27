/**
 * Contas (EF-02) — leitura, cadastro/edição e exclusão.
 *
 * Os tipos vêm do CONTRATO GERADO — não redeclarados aqui (D-03 · R4): importar
 * de `@orcamento/contrato` é o que garante que este arquivo nunca diverge do
 * modelo que a API de fato aceita e devolve. `saldoCentavos` é DERIVADO pelo
 * servidor (EF-02 §1) — este módulo só o lê, nunca o recalcula.
 */
import type { AtualizarConta, Conta, ContasListadas, NovaConta } from '@orcamento/contrato';

/**
 * Vai em toda mutação (POST/PATCH/DELETE) para que o emissor da API devolva
 * este id no evento de invalidação — é o que permite ao cliente que agiu
 * DESCARTAR o próprio eco (R5 de `useRealtime.ts`). Mesmo nome de cabeçalho
 * que a API lê em `api/src/realtime/emissor.ts` (`CABECALHO_ORIGEM_CLIENTE`);
 * não exportado de lá para o front, então repetido aqui como string literal.
 */
const CABECALHO_ORIGEM_CLIENTE = 'x-origem-cliente';

/**
 * As TRÊS opções de TIPO, na ordem em que a folha as mostra (`tiposConta` no
 * mockup) — cada uma com o ícone e o rótulo do botão-anel de seleção.
 */
export const TIPOS_CONTA = [
  { valor: 'DEBITO', rotulo: 'Débito', icone: 'ti-wallet' },
  { valor: 'CREDITO', rotulo: 'Crédito', icone: 'ti-credit-card' },
  { valor: 'RESERVA', rotulo: 'Reserva', icone: 'ti-pig-money' },
] as const satisfies readonly { valor: Conta['tipo']; rotulo: string; icone: string }[];

/**
 * ⚠️ FORK — ver relato da tarefa #40.
 *
 * A folha do mockup (`sheetConta`) tem seletor de ÍCONE mas NÃO tem seletor de
 * COR, embora `cor` seja campo obrigatório de `NovaConta`/`AtualizarConta`
 * (EF-02 §1). Não inventamos um seletor novo — a leitura mais fiel ao desenho
 * é que a cor é DERIVADA, não escolhida pela família: este mapa fixa uma cor
 * por TIPO, usando os MESMOS valores que a tarefa #39 já semeou em
 * `api/src/modulos/contas/semear.ts` (débito azul, crédito vermelho, reserva
 * verde) — não é uma escolha nova deste arquivo, é a paleta que já está no
 * dado real da família de teste.
 *
 * Se a família precisar ESCOLHER a cor da conta, isso é decisão de produto a
 * ser levada ao humano: a folha de categoria (`sheetEditCat`) já tem uma
 * grade de cor pronta, como precedente visual.
 */
export const MAPA_COR_POR_TIPO: Record<Conta['tipo'], string> = {
  DEBITO: '#2563eb',
  CREDITO: '#dc2626',
  RESERVA: '#16a34a',
};

/**
 * A grade de ÍCONE da folha — 12 opções, 6 colunas (2 linhas), como no
 * desenho (`iconesConta`, `hint-placeholder-count="12"`). A CHAVE é o que vai
 * persistido em `icone` (o back só exige "string não vazia" — quem decide o
 * VOCABULÁRIO de ícones é o front); os três primeiros valores são os mesmos
 * que o seed da #39 já usa (`banco`, `cartao`, `cofre`), para que a conta
 * semeada apareça com o ícone certo assim que a tela abre.
 */
export const ICONES_CONTA: readonly string[] = [
  'banco',
  'cartao',
  'cofre',
  'carteira',
  'moedas',
  'recibo',
  'maleta',
  'casa',
  'carro',
  'aviao',
  'presente',
  'coracao',
];

/** `icone` (a chave persistida) → classe do Tabler exibida na tela. */
const MAPA_CLASSE_DO_ICONE: Record<string, string> = {
  banco: 'ti-building-bank',
  cartao: 'ti-credit-card',
  cofre: 'ti-lock',
  carteira: 'ti-wallet',
  moedas: 'ti-coin',
  recibo: 'ti-receipt',
  maleta: 'ti-briefcase',
  casa: 'ti-home',
  carro: 'ti-car',
  aviao: 'ti-plane',
  presente: 'ti-gift',
  coracao: 'ti-heart',
};

/** A classe Tabler de um `icone` persistido. Cai num ícone neutro se a chave for desconhecida. */
export function classeDoIcone(icone: string): string {
  return MAPA_CLASSE_DO_ICONE[icone] ?? 'ti-wallet';
}

export function useContas() {
  const api = useApi();
  const origemClienteId = useOrigemClienteId();

  const cabecalhoDeOrigem = { [CABECALHO_ORIGEM_CLIENTE]: origemClienteId };

  /** As contas da família da sessão, com o saldo derivado e o total "em conta hoje" (RN-07). */
  async function listarContas(): Promise<ContasListadas> {
    return api<ContasListadas>('/contas');
  }

  async function criarConta(dados: NovaConta): Promise<Conta> {
    return api<Conta>('/contas', {
      method: 'POST',
      body: dados,
      headers: cabecalhoDeOrigem,
    });
  }

  async function atualizarConta(id: string, dados: AtualizarConta): Promise<Conta> {
    return api<Conta>(`/contas/${id}`, {
      method: 'PATCH',
      body: dados,
      headers: cabecalhoDeOrigem,
    });
  }

  /**
   * RN-06 — a API recusa com 409 (`conta_com_lancamentos`) se a conta tiver
   * lançamentos. Esta função NUNCA traduz o erro: quem chama decide o que
   * mostrar, lendo a mensagem que a API devolveu (`mensagemDoErro`).
   */
  async function excluirConta(id: string): Promise<void> {
    await api(`/contas/${id}`, {
      method: 'DELETE',
      headers: cabecalhoDeOrigem,
    });
  }

  return { listarContas, criarConta, atualizarConta, excluirConta };
}
