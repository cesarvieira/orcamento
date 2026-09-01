/**
 * A sessão, como o front a enxerga.
 *
 * O tipo vem do CONTRATO GERADO — `SessaoAtual` é declarado uma vez, no Zod da
 * API, e chega aqui pronto (R6 · D-03). Se você sentir vontade de escrever
 * `interface Sessao { ... }` neste arquivo, é o sinal de que o contrato deixou
 * de ser regenerado — e o gate de contrato vai reprovar, com razão.
 */
import type { LoginGoogle, SessaoAtual } from '@orcamento/contrato';

/**
 * A API não respondeu — e isso NÃO é o mesmo que "não há sessão".
 *
 * A distinção existe porque a ausência dela já custou caro: `carregar()`
 * engolia qualquer falha num `catch` e devolvia `null`, então uma API
 * inalcançável (porta errada, contêiner fora do ar, DNS) chegava ao
 * middleware como "esta pessoa não está logada". O resultado era um F5 que
 * não sobrevivia à sessão: SSR não alcançava a API → `/entrar` → o cliente
 * alcançava → `/`. O sintoma não dizia nada sobre a causa.
 *
 * 401 é RESPOSTA: o servidor falou e disse que não há sessão.
 * O resto é SILÊNCIO: não sabemos, e afirmar que não há é mentir.
 */
export class ApiInalcancavel extends Error {
  constructor(base: string, causa: unknown) {
    super(`A API não respondeu em ${base} — não dá para saber se há sessão.`);
    this.name = 'ApiInalcancavel';
    this.cause = causa;
  }
}

/** 401 — a única falha que significa "não há sessão". */
function ehSemSessao(erro: unknown): boolean {
  const e = erro as
    | { statusCode?: number; status?: number; response?: { status?: number } } |
    undefined;
  return e?.statusCode === 401 || e?.status === 401 || e?.response?.status === 401;
}

export function useSessao() {
  const sessao = useState<SessaoAtual | null>('sessao', () => null);

  const api = useApi();

  /**
   * Resolvido AQUI, no setup — nunca lá embaixo no `catch`.
   *
   * `useApiBase()` chama `useRuntimeConfig()`, e todo composable do Nuxt
   * precisa do contexto da instância, que só existe até o primeiro `await`.
   * Chamá-lo depois da falha do `$fetch` levantava um "Nuxt instance
   * unavailable" (NUXT_E1001) que SUBSTITUÍA o erro real — o processo ficava
   * sem o diagnóstico e a tela virava um 500 genérico. Medido no artefato de
   * produção, não suposto.
   */
  const base = useApiBase();

  /**
   * Relê a sessão da API.
   *
   * `null` quando a API RESPONDEU que não há (401). Qualquer outra falha
   * estoura `ApiInalcancavel` — e, de propósito, **não zera** `sessao`: não
   * sabendo se ela existe, descartar o que já se tinha é a pior das opções.
   */
  async function carregar(): Promise<SessaoAtual | null> {
    try {
      sessao.value = await api<SessaoAtual>('/sessoes/atual');
    } catch (erro: unknown) {
      if (ehSemSessao(erro)) {
        sessao.value = null;
        return null;
      }
      throw new ApiInalcancavel(base, erro);
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

  /**
   * Entra com o CODIGO de autorizacao que o Google devolveu ao navegador. O
   * codigo sozinho nao prova nada: quem o troca por um ID token e a API, que
   * tem o client secret.
   */
  async function entrarComGoogle(codigoAutorizacao: string): Promise<SessaoAtual> {
    const corpo: LoginGoogle = { codigoAutorizacao };
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
