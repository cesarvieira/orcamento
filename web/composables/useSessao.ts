/**
 * A sessão, como o front a enxerga.
 *
 * O tipo vem do CONTRATO GERADO — `SessaoAtual` é declarado uma vez, no Zod da
 * API, e chega aqui pronto (R6 · D-03). Se você sentir vontade de escrever
 * `interface Sessao { ... }` neste arquivo, é o sinal de que o contrato deixou
 * de ser regenerado — e o gate de contrato vai reprovar, com razão.
 */
import type { LoginGoogle, SessaoAtual } from '@orcamento/contrato';

export function useSessao() {
  const sessao = useState<SessaoAtual | null>('sessao', () => null);

  const api = useApi();

  /** Relê a sessão da API. Devolve `null` quando não há (401). */
  async function carregar(): Promise<SessaoAtual | null> {
    try {
      sessao.value = await api<SessaoAtual>('/sessoes/atual');
    } catch {
      sessao.value = null;
    }
    return sessao.value;
  }

  async function entrar(email: string, senha: string): Promise<SessaoAtual> {
    const nova = await api<SessaoAtual>('/sessoes', {
      method: 'POST',
      body: { email, senha },
    });
    sessao.value = nova;
    return nova;
  }

  /** Entra com o ID token que o Google Identity Services devolveu ao cliente. */
  async function entrarComGoogle(idToken: string): Promise<SessaoAtual> {
    const corpo: LoginGoogle = { idToken };
    const nova = await api<SessaoAtual>('/sessoes/google', {
      method: 'POST',
      body: corpo,
    });
    sessao.value = nova;
    return nova;
  }

  async function sair(): Promise<void> {
    try {
      await api('/sessoes/atual', { method: 'DELETE' });
    } catch {
      // Encerra localmente mesmo se a chamada falhar — sair não pode travar
      // numa API fora do ar.
    }
    sessao.value = null;
  }

  return { sessao, carregar, entrar, entrarComGoogle, sair };
}
