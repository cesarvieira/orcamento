/**
 * Aritmética de competência/`AAAA-MM-DD` usada pelos semeadores.
 *
 * Mesma convenção de `modulos/lancamentos/dominio.ts#adicionarMeses`: dia
 * cravado no último dia do mês de destino quando o dia de origem não existe
 * nele (ex.: 31/jan + 1 mês → 28/29 fev).
 */

const DIAS_POR_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function anoBissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

function ultimoDiaDoMes(ano: number, mesUmBaseado: number): number {
  if (mesUmBaseado === 2 && anoBissexto(ano)) return 29;
  return DIAS_POR_MES[mesUmBaseado - 1] as number;
}

/** Soma `meses` a uma competência `AAAA-MM` (pode ser negativo). */
export function deslocarCompetencia(competencia: string, meses: number): string {
  const [anoStr, mesStr] = competencia.split('-');
  const ano = Number(anoStr);
  const mes = Number(mesStr);
  const total = ano * 12 + (mes - 1) + meses;
  const novoAno = Math.floor(total / 12);
  const novoMes = (total % 12) + 1;
  return `${String(novoAno).padStart(4, '0')}-${String(novoMes).padStart(2, '0')}`;
}

/**
 * Monta `AAAA-MM-DD` dentro da competência, cravando o dia no último dia do
 * mês quando necessário.
 */
export function dataNaCompetencia(competencia: string, dia: number): string {
  const [anoStr, mesStr] = competencia.split('-');
  const ano = Number(anoStr);
  const mes = Number(mesStr);
  const diaSeguro = Math.min(Math.max(1, dia), ultimoDiaDoMes(ano, mes));
  return `${competencia}-${String(diaSeguro).padStart(2, '0')}`;
}

/** `AAAA-MM-DD` de hoje em UTC — mesma base de `competenciaDeHoje` no seed. */
export function hojeIsoUtc(): string {
  return new Date().toISOString().slice(0, 10);
}
