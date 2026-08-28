/**
 * Faturas (EF-05) — a(s) fatura(s) em aberto (D1) de um cartão, e o pagamento.
 * Tarefa #71 (issue #71 da história #19).
 *
 * Os tipos vêm do CONTRATO GERADO — não redeclarados aqui (regra inviolável
 * #4 do projeto / D-03): `FaturasDoCartao`/`Fatura`/`PagarFatura`, importados
 * de `@orcamento/contrato`, são exatamente o que
 * `api/src/modulos/faturas/esquemas.ts` devolve. Este módulo nunca soma nada
 * — nem o total de uma fatura, nem o limite livre do cartão: os dois chegam
 * DERIVADOS na resposta (RN-25/RN-26, com o escopo amplo de D1) e só são
 * lidos aqui, nunca recalculados.
 */
import type { Fatura, FaturasDoCartao, PagarFatura } from '@orcamento/contrato';

/**
 * Mesmo cabeçalho que `useContas.ts`/`useLancamentos.ts` usam — vai em toda
 * mutação para que o emissor da API devolva este id no evento de
 * invalidação, e o `useRealtime` descarte o próprio eco (R5). Mesmo nome
 * literal de `api/src/realtime/emissor.ts#CABECALHO_ORIGEM_CLIENTE`.
 */
const CABECALHO_ORIGEM_CLIENTE = 'x-origem-cliente';

export function useFaturas() {
  const api = useApi();
  const origemClienteId = useOrigemClienteId();
  const cabecalhoDeOrigem = { [CABECALHO_ORIGEM_CLIENTE]: origemClienteId };

  /**
   * A(s) fatura(s) em aberto (D1: `ABERTA` + `FECHADA`, nunca `PAGA`) do
   * cartão `contaId`, mais antiga primeiro, com `limiteLivreCentavos`
   * (RN-26). `contaId` precisa ser uma conta `CREDITO` da família da sessão
   * — a API devolve 404 caso contrário (tratado por quem chama, via
   * `mensagemDoErro`).
   */
  async function listarFaturas(contaId: string): Promise<FaturasDoCartao> {
    return api<FaturasDoCartao>('/faturas', { query: { contaId } });
  }

  /**
   * Paga a fatura `faturaId`. RN-24/D3 — gera uma `TRANSFERENCIA` da conta
   * escolhida (`dados.pagaComContaId`, ESCOLHIDA PELO USUÁRIO — nunca
   * inferida) para o cartão; os lançamentos originais mantêm sua conta.
   */
  async function pagarFatura(faturaId: string, dados: PagarFatura): Promise<Fatura> {
    return api<Fatura>(`/faturas/${faturaId}/pagar`, {
      method: 'POST',
      body: dados,
      headers: cabecalhoDeOrigem,
    });
  }

  return { listarFaturas, pagarFatura };
}
