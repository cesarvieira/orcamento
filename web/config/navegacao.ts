/**
 * A NAVEGAÇÃO — os sete destinos, num lugar só.
 *
 * Extraídos do mockup: `nav` (tab bar do mobile) e `navDesktop` (sidebar) são
 * as MESMAS sete telas, não dois produtos. Aqui elas são uma lista, e o layout
 * decide como desenhá-la em cada largura.
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
] as const;

/** A rota da tela de acesso. Fica FORA do shell: não tem tab bar nem sidebar. */
export const ROTA_DE_ENTRADA = '/entrar';

/** A tela-índice do mobile, onde entram os destinos que não cabem na tab bar. */
export const ROTA_MAIS = '/mais';

export const ABAS_DO_MOBILE = DESTINOS.filter(d => d.abaNoMobile);
export const DESTINOS_EM_MAIS = DESTINOS.filter(d => !d.abaNoMobile);

/** O destino ativo para uma rota. `/contas/123` continua sendo *Contas*. */
export function destinoDaRota(rota: string): Destino | undefined {
  const exato = DESTINOS.find(d => d.rota === rota);
  if (exato) return exato;
  return DESTINOS.filter(d => d.rota !== '/').find(d =>
    rota.startsWith(`${d.rota}/`),
  );
}
