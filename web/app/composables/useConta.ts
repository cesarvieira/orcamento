/**
 * Criar a própria família e confirmar o email (RN-06 a RN-09 · EF-01).
 *
 * Os tipos vêm do CONTRATO GERADO — não redeclarados aqui (D-03).
 *
 * `pedirRecuperacao`/`concluirRecuperacao` fecham RN-12 a RN-16 no mesmo
 * lugar: recuperar senha é, do ponto de vista da tela, o mesmo par
 * "pede código, digita código" da confirmação.
 *
 * `criarConta` NÃO abre sessão de propósito: a identidade nasce não
 * confirmada e o login a recusa até o email ser provado. Quem chama isto
 * mostra "confira seu email", não navega para dentro do app.
 */
import type {
  ConcluirRecuperacao,
  ConfirmarConta,
  ContaCriada,
  CriarConta,
  RecuperacaoPedida,
  SessaoAtual,
} from '@orcamento/contrato';

export function useConta() {
  const api = useApi();
  const { sessao } = useSessao();

  async function criarConta(dados: CriarConta): Promise<ContaCriada> {
    return api<ContaCriada>('/cadastros', { method: 'POST', body: dados });
  }

  /**
   * Prova o email e já entra — a resposta abre sessão, igual ao login. Desde
   * RN-10 o que prova é o par email + código digitado, não um link.
   */
  async function confirmarConta(dados: ConfirmarConta): Promise<SessaoAtual> {
    const nova = await api<SessaoAtual>('/cadastros/confirmar', { method: 'POST', body: dados });
    sessao.value = nova;
    return nova;
  }

  /**
   * RN-13 — a resposta é a MESMA exista ou não a conta. Por isso a tela não
   * tem como (nem deve) distinguir os dois casos: ela sempre segue para o
   * passo do código.
   */
  async function pedirRecuperacao(email: string): Promise<RecuperacaoPedida> {
    return api<RecuperacaoPedida>('/recuperacoes', { method: 'POST', body: { email } });
  }

  /** Troca a senha e já entra — a resposta abre sessão, como a confirmação. */
  async function concluirRecuperacao(dados: ConcluirRecuperacao): Promise<SessaoAtual> {
    const nova = await api<SessaoAtual>('/recuperacoes/concluir', { method: 'POST', body: dados });
    sessao.value = nova;
    return nova;
  }

  return { criarConta, confirmarConta, pedirRecuperacao, concluirRecuperacao };
}
