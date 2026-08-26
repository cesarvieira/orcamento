/**
 * Criar a própria família e confirmar o email (RN-06 a RN-09 · EF-01).
 *
 * Os tipos vêm do CONTRATO GERADO — não redeclarados aqui (D-03).
 *
 * `criarConta` NÃO abre sessão de propósito: a identidade nasce não
 * confirmada e o login a recusa até o email ser provado. Quem chama isto
 * mostra "confira seu email", não navega para dentro do app.
 */
import type { ContaCriada, CriarConta, SessaoAtual } from '@orcamento/contrato';

export function useConta() {
  const api = useApi();
  const { sessao } = useSessao();

  async function criarConta(dados: CriarConta): Promise<ContaCriada> {
    return api<ContaCriada>('/contas', { method: 'POST', body: dados });
  }

  /** Prova o email e já entra — a resposta abre sessão, igual ao login. */
  async function confirmarConta(token: string): Promise<SessaoAtual> {
    const nova = await api<SessaoAtual>(`/contas/${token}/confirmar`, { method: 'POST' });
    sessao.value = nova;
    return nova;
  }

  return { criarConta, confirmarConta };
}
