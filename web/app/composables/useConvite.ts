/**
 * Convidar, aceitar e recusar convite (EF-01).
 *
 * Desde RN-10 o convite não viaja mais na URL: aceitar e recusar mandam
 * **email + código de 6 dígitos** no corpo. O código não é único sozinho — é
 * o par com o email que identifica o convite.
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
  RecusarConvite,
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
  async function aceitarConvite(dados: AceitarConvite): Promise<SessaoAtual> {
    const nova = await api<SessaoAtual>('/convites/aceitar', {
      method: 'POST',
      body: dados,
    });
    sessao.value = nova;
    return nova;
  }

  /**
   * RN-08 — recusar encerra o convite SEM criar membro, e é o que libera
   * aquele email para criar a própria família. Sem esta porta, quem recebe um
   * convite indesejado fica preso: o cadastro recusa e o convite fica de pé.
   */
  async function recusarConvite(dados: RecusarConvite): Promise<void> {
    await api('/convites/recusar', { method: 'POST', body: dados });
  }

  return { criarConvite, listarConvitesPendentes, aceitarConvite, recusarConvite };
}
