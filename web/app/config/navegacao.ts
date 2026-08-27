/**
 * A NAVEGAÇÃO — os destinos, num lugar só.
 *
 * Sete deles vêm do mockup: `nav` (tab bar do mobile) e `navDesktop`
 * (sidebar) são as MESMAS sete telas, não dois produtos. Um oitavo —
 * *Convidar* — não vem do mockup: é EF-01, a única EF cuja superfície não sai
 * do desenho (§3 da EF). Aqui eles são uma lista só, e o layout decide como
 * desenhá-la em cada largura.
 *
 * Acrescentar destino é editar este arquivo — e só ele. Um destino que apareça
 * na sidebar e não na tab bar (ou vice-versa) é bug de layout, não de dado.
 */

/** Um destino do app. `id` é o mesmo `tela` do protótipo. */
export interface Destino {
  id: string;
  /** O rótulo curto, da tab bar do mobile. */
  rotuloCurto: string;
  /** O rótulo longo, da sidebar do desktop. */
  rotulo: string;
  rota: string;
  /** Ícone do Tabler, o mesmo conjunto do mockup. */
  icone: string;
  /**
   * O ícone quando o destino está ATIVO. Opcional: sem ele, o ativo usa o
   * `icone` normal e a seleção é comunicada só por cor e peso.
   *
   * ⚠️ POR QUE ESTÁ VAZIO EM TODOS HOJE — e não é esquecimento. O mockup usa a
   * variante PREENCHIDA aqui (`ti-wallet-filled`, `ti-layout-grid-filled`).
   * Essas classes NÃO EXISTEM na fonte que o app carrega: medido no pacote
   * instalado (`@tabler/icons-webfont@3.46.0`), a folha do `nuxt.config`
   * (`tabler-icons.min.css`) tem **zero** classes com sufixo `-filled`. A folha
   * irmã `tabler-icons-filled.min.css` existe, mas redefine AS MESMAS 1057
   * classes com os glifos cheios — carregá-la deixaria o app inteiro preenchido,
   * ativo ou não, em vez de acrescentar variantes.
   *
   * Preencher este campo com um nome inventado renderiza **ícone vazio** e não
   * gera erro de console: o gate de navegação passaria, e o defeito só apareceria
   * para quem olhasse a tela. O próprio protótipo se protegia disso com um teste
   * em runtime antes de usar a variante cheia.
   *
   * Então o contrato existe e o consumidor já o respeita (com fallback); os
   * valores entram quando houver fonte que os sustente.
   */
  iconeAtivo?: string;
  /**
   * Se aparece direto na tab bar do mobile. São poucas: a tab bar tem quatro
   * lugares e um botão central. O resto entra por *Mais*.
   */
  abaNoMobile: boolean;
  /** Qual EF constrói a tela. A moldura é da EF-00; o conteúdo é de lá. */
  especificacao: string;
  /** A linha de apoio que a tela *Mais* mostra abaixo do título. */
  descricao: string;
}

export const DESTINOS: readonly Destino[] = [
  {
    id: 'home',
    rotuloCurto: 'Mês',
    rotulo: 'Visão do mês',
    rota: '/',
    icone: 'ti-layout-grid',
    abaNoMobile: true,
    especificacao: 'EF-04',
    descricao: 'recebido, planejado e o que sobrou por categoria',
  },
  {
    id: 'contas',
    rotuloCurto: 'Contas',
    rotulo: 'Contas',
    rota: '/contas',
    icone: 'ti-wallet',
    abaNoMobile: true,
    especificacao: 'EF-02',
    descricao: 'saldo real por conta, cartão e reserva',
  },
  {
    id: 'extrato',
    rotuloCurto: 'Extrato',
    rotulo: 'Extrato',
    rota: '/extrato',
    icone: 'ti-list-details',
    abaNoMobile: true,
    especificacao: 'EF-04',
    descricao: 'lançamentos por dia, com filtro por conta',
  },
  {
    id: 'faturas',
    rotuloCurto: 'Faturas',
    rotulo: 'Faturas',
    rota: '/faturas',
    icone: 'ti-credit-card',
    abaNoMobile: false,
    especificacao: 'EF-05',
    descricao: 'fatura do cartão, ciclo e limite livre',
  },
  {
    id: 'orcamento',
    rotuloCurto: 'Orçamento',
    rotulo: 'Orçamento',
    rota: '/orcamento',
    icone: 'ti-adjustments',
    abaNoMobile: false,
    especificacao: 'EF-03',
    descricao: 'renda prevista e o teto de cada categoria',
  },
  {
    id: 'metas',
    rotuloCurto: 'Metas',
    rotulo: 'Metas',
    rota: '/metas',
    icone: 'ti-target-arrow',
    abaNoMobile: false,
    especificacao: 'EF-07',
    descricao: 'alvo, acumulado e quanto guardar',
  },
  {
    id: 'fechamento',
    rotuloCurto: 'Fechar',
    rotulo: 'Fechamento',
    rota: '/fechamento',
    icone: 'ti-calendar-check',
    abaNoMobile: false,
    especificacao: 'EF-08',
    descricao: 'sobra projetada e o fechamento do mês',
  },
  {
    id: 'convidar',
    rotuloCurto: 'Convidar',
    rotulo: 'Convidar',
    rota: '/mais/convidar',
    icone: 'ti-user-plus',
    abaNoMobile: false,
    especificacao: 'EF-01',
    descricao: 'convide alguém para a família por email',
  },
] as const;

/** A rota da tela de acesso. Fica FORA do shell: não tem tab bar nem sidebar. */
export const ROTA_DE_ENTRADA = '/entrar';

/** A tela-índice do mobile, onde entram os destinos que não cabem na tab bar. */
export const ROTA_MAIS = '/mais';

/**
 * As abas da tab bar, na ordem. Não é exportada: quem consome são as duas
 * metades abaixo, que já sabem de que lado do botão central cada uma fica.
 */
const ABAS_DO_MOBILE = DESTINOS.filter(d => d.abaNoMobile);
export const DESTINOS_EM_MAIS = DESTINOS.filter(d => !d.abaNoMobile);

/**
 * A tab bar do mobile é `Mês · Contas · [+] · Extrato · Mais` — cinco lugares,
 * com o botão de lançar no CENTRO, como no mockup. O centro não é um destino:
 * é ação, e por isso não sai de `DESTINOS`.
 *
 * A divisão mora aqui, e não no layout, pela mesma razão que a lista mora aqui:
 * quem acrescentar uma aba edita UM arquivo. Um `slice(0, 2)` solto no template
 * moveria o botão central sem ninguém perceber assim que a quarta aba entrasse.
 */
const ABAS_ANTES_DO_CENTRO = 2;
export const ABAS_A_ESQUERDA = ABAS_DO_MOBILE.slice(0, ABAS_ANTES_DO_CENTRO);
export const ABAS_A_DIREITA = ABAS_DO_MOBILE.slice(ABAS_ANTES_DO_CENTRO);

/** O destino ativo para uma rota. `/contas/123` continua sendo *Contas*. */
export function destinoDaRota(rota: string): Destino | undefined {
  const exato = DESTINOS.find(d => d.rota === rota);
  if (exato) return exato;
  return DESTINOS.filter(d => d.rota !== '/').find(d =>
    rota.startsWith(`${d.rota}/`),
  );
}
