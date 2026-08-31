/**
 * Metas (EF-07) — os cofrinhos: listar, criar (D4) e guardar (RN-33/RN-34,
 * D1/D2/D5). Tarefa #87 (issue #87 da história #21).
 *
 * ⛔ Regra #0: os termos e as regras (RN-33..RN-35, D1..D5) vêm de
 * `.preator/skills/negocio/metas-e-reservas/SKILL.md`, que cita
 * `docs/especificacoes/EF-07-metas.md` §1/§2 como fonte primária. Nada aqui
 * foi preenchido de memória.
 *
 * Os tipos vêm do CONTRATO GERADO — não redeclarados aqui (regra inviolável
 * #4 do projeto / D-03): `Meta`/`NovaMeta`/`Guardar`/`MetasListadas`,
 * importados de `@orcamento/contrato`, são exatamente o que
 * `api/src/modulos/metas/esquemas.ts` aceita e devolve.
 * `acumuladoCentavos` é DERIVADO pelo servidor (EF-07 §1, soma das
 * transferências para a conta RESERVA vinculada) — este módulo nunca o
 * recalcula, só o lê.
 *
 * Edição e exclusão de cofrinho NÃO entram aqui: a EF-07 §5 (DoD) e a skill
 * (edge case "Excluir um cofrinho com acumulado > 0") registram que nenhuma
 * fonte lida define essa superfície para esta história — só o CRUD que a
 * tela #87 de fato usa é exposto.
 */
import type { Guardar, Meta, MetasListadas, NovaMeta } from '@orcamento/contrato';

/**
 * Mesmo cabeçalho que `useContas.ts`/`useFaturas.ts`/`useOrcamento.ts` usam —
 * vai em toda mutação para que o emissor da API devolva este id no evento de
 * invalidação, e o `useRealtime` descarte o próprio eco (R5). Mesmo nome
 * literal de `api/src/realtime/emissor.ts#CABECALHO_ORIGEM_CLIENTE`.
 */
const CABECALHO_ORIGEM_CLIENTE = 'x-origem-cliente';

/**
 * 🟦 FONTE — os dois valores dos botões do cartão (recorte §3, mobile:386-401
 * / desktop:462-475): "Guardar 100" e "Guardar 500". D-06 — inteiro em
 * centavos: R$ 100,00 e R$ 500,00.
 */
export const GUARDAR_100_CENTAVOS = 10000;
export const GUARDAR_500_CENTAVOS = 50000;

/**
 * Passo do −/+ do campo "alvo" na folha de criar cofrinho (D4). O desenho não
 * define este stepper — a folha inteira é superfície nova (D4) —, então este
 * valor é escolha desta tela, por analogia de grandeza com
 * `PASSO_TETO_CENTAVOS` (`useOrcamento.ts`) e com o passo de valor de
 * `contas.vue` (`PASSO_VALOR_CENTAVOS`): um alvo de poupança tende a ser maior
 * que um teto de categoria, daí R$ 50 por clique em vez de R$ 10.
 */
export const PASSO_ALVO_CENTAVOS = 5000;

export function useMetas() {
  const api = useApi();
  const origemClienteId = useOrigemClienteId();

  const cabecalhoDeOrigem = { [CABECALHO_ORIGEM_CLIENTE]: origemClienteId };

  /** Os cofrinhos da família da sessão, com o acumulado derivado (EF-07 §1). */
  async function listarMetas(): Promise<MetasListadas> {
    return api<MetasListadas>('/metas');
  }

  /** D4 — cria um cofrinho novo; a conta RESERVA dele é criada pelo servidor (D3), não por esta tela. */
  async function criarMeta(dados: NovaMeta): Promise<Meta> {
    return api<Meta>('/metas', {
      method: 'POST',
      body: dados,
      headers: cabecalhoDeOrigem,
    });
  }

  /**
   * O ato de guardar (RN-33: `TRANSFERENCIA`, nunca despesa). D2/D5 — as duas
   * pontas (`dados.contaOrigemId` e `metaId`) vêm sempre de escolha do
   * usuário, nunca inferidas. A API recusa com 409 quando o valor excede o
   * não alocado da competência, ou quando o não alocado já é ≤ 0 (RN-34/D1) —
   * esta função não trata o erro, só propaga: quem chama decide a mensagem
   * (`mensagemDoErro`).
   *
   * `dados.data` — D6 (tarefa #91): quem chama informa a data do ato (fuso
   * local, `utils/data.ts#hojeLocal`); a API deriva a competência dela
   * (RN-15) para conferir o teto de RN-34/D1, nunca do próprio relógio.
   */
  async function guardar(metaId: string, dados: Guardar): Promise<Meta> {
    return api<Meta>(`/metas/${metaId}/guardar`, {
      method: 'POST',
      body: dados,
      headers: cabecalhoDeOrigem,
    });
  }

  return { listarMetas, criarMeta, guardar };
}
