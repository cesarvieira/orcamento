/**
 * Convidar e aceitar convite (EF-01).
 *
 * Os tipos vêm do CONTRATO GERADO — não redeclarados aqui (D-03). A API (#35)
 * já tem `GET /convites`, que lista os convites pendentes da família da
 * sessão atual — fecha a lacuna registrada em EF01-MC-001.
 */
import type {
  AceitarConvite,
  ConvitePendente,
  ConviteCriado,
  ConvitesPendentes,
  CriarConvite,
  SessaoAtual,
} from '@orcamento/contrato';

export function useConvite() {
  const api = useApi();
  const { sessao } = useSessao();

  /** Convida um email para a família da sessão atual. */
  async function criarConvite(email: string): Promise<ConviteCriado> {
    const corpo: CriarConvite = { email };
    return api<ConviteCriado>('/convites', {
      method: 'POST',
      body: corpo,
    });
  }

  /** Lista os convites pendentes da família da sessão atual. */
  async function listarConvitesPendentes(): Promise<ConvitePendente[]> {
    const resposta = await api<ConvitesPendentes>('/convites');
    return resposta.convites;
  }

  /**
   * Aceita um convite pendente. A resposta abre sessão — igual ao login —,
   * então ela também atualiza a sessão reativa que `useSessao` expõe.
   */
  async function aceitarConvite(token: string, dados: AceitarConvite): Promise<SessaoAtual> {
    const nova = await api<SessaoAtual>(`/convites/${token}/aceitar`, {
      method: 'POST',
      body: dados,
    });
    sessao.value = nova;
    return nova;
  }

  return { criarConvite, listarConvitesPendentes, aceitarConvite };
}
