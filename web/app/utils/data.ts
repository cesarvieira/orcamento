/**
 * DATA — o dia corrente, no FUSO LOCAL do navegador.
 *
 * Funções puras, sem estado. Mesmo padrão de `utils/competencia.ts`: existe
 * para que nenhuma tela precise reimplementar a conta.
 *
 * ⛔ D6 (2026-08-29, tarefa #91) — a data do fato vem do CLIENTE, nunca do
 * relógio do servidor. O defeito medido: o backend calculava "hoje" com
 * getters UTC (`hojeIso()`), e das 21h à meia-noite no fuso do Brasil
 * (UTC−3) isso devolvia o DIA SEGUINTE — no último dia do mês, a competência
 * inteira ia para o mês errado (RN-34/D1 conferido contra o teto errado).
 * Trocar para getters locais NO SERVIDOR não resolveria: o container roda em
 * UTC, não no fuso do usuário. A correção é estrutural — o cliente, que
 * conhece o fuso de verdade, informa a data —, não um ajuste de getter.
 *
 * Esta função é a ÚNICA fonte da data local no front: antes desta tarefa,
 * `FolhaLancamento.vue` já calculava certo (fuso local — RN-15 da API já
 * lê essa data do corpo), mas com uma cópia própria. Ela é a única extraída
 * aqui; `metas.vue` (guardar) e `faturas.vue` (pagar, listar) passam a usá-la
 * também, para que as três nunca divirjam.
 */

/** `AAAA-MM-DD` de hoje, no fuso LOCAL do navegador — nunca UTC. */
export function hojeLocal(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
}
