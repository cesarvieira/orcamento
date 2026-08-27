/**
 * COMPETÊNCIA — o mês de referência, em `AAAA-MM`.
 *
 * Funções puras, sem estado. O mês ATIVO do app é estado compartilhado e vive
 * em `composables/useCompetencia.ts`; aqui ficam só as contas.
 *
 * ⚠️ A competência é `char(7)` no banco (`api/src/db/tipos.ts`) e string no
 * contrato — ela NUNCA vira `Date` no caminho da API. Estas funções existem
 * para que ninguém precise fazer aritmética de data na mão, que é onde nasce o
 * clássico "dezembro + 1 = mês 13".
 *
 * Não é assunto da EF-03: a EF-04 (visão do mês) e a EF-08 (fechamento) leem a
 * mesma competência. Por isso mora em `utils/`, e não dentro de `useOrcamento`.
 */

/** A competência corrente, no formato que a API exige (`esquemas.ts#PADRAO_COMPETENCIA`). */
export function competenciaAtual(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}`;
}

/** `AAAA-MM` → `{ ano, mes }`, com `mes` de 1 a 12. */
export function partesDaCompetencia(competencia: string): { ano: number; mes: number } {
  const [ano, mes] = competencia.split('-');
  return { ano: Number(ano), mes: Number(mes) };
}

/** `{ ano, mes }` → `AAAA-MM`. `mes` fora de 1–12 é normalizado (mês 13 vira janeiro do ano seguinte). */
export function competenciaDe(ano: number, mes: number): string {
  const anoNormalizado = ano + Math.floor((mes - 1) / 12);
  const mesNormalizado = ((((mes - 1) % 12) + 12) % 12) + 1;
  return `${anoNormalizado}-${String(mesNormalizado).padStart(2, '0')}`;
}

/** A competência N meses adiante (ou atrás, com N negativo). Sem limite: passado e futuro são livres. */
export function deslocarCompetencia(competencia: string, meses: number): string {
  const { ano, mes } = partesDaCompetencia(competencia);
  return competenciaDe(ano, mes + meses);
}

/**
 * Os doze meses em pt-BR, com inicial maiúscula.
 *
 * Fixos em vez de `toLocaleDateString`: a tela roda em SSR, e o locale do
 * servidor não é o do navegador — o mesmo mês sairia "August" no render do
 * servidor e "agosto" na hidratação, que é divergência de conteúdo.
 */
export const MESES_DO_ANO = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const;

/** `2026-08` → `Agosto 2026`. */
export function rotuloDaCompetencia(competencia: string): string {
  const { ano, mes } = partesDaCompetencia(competencia);
  return `${MESES_DO_ANO[mes - 1] ?? competencia} ${ano}`;
}
