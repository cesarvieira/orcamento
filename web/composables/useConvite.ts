/**
 * Convidar e aceitar convite (EF-01).
 *
 * Os tipos vêm do CONTRATO GERADO — não redeclarados aqui (D-03). `criarConvite`
 * não devolve lista nenhuma: a API (#32) só tem `POST /convites`, não
 * `GET /convites` — não há como listar convites pendentes ainda.
 */
import type { AceitarConvite, ConviteCriado, CriarConvite, SessaoAtual } from '@orcamento/contrato';

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

  return { criarConvite, aceitarConvite };
}
