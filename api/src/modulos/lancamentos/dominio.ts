/**
 * O DOMÍNIO de `lancamentos` (EF-04) — competência e o motor de parcelamento.
 * Funções puras, sem banco: o serviço (`servico.ts`) só orquestra I/O em
 * torno delas.
 *
 * ⛔ Regra #0: as regras abaixo (RN-15, RN-18, RN-20, RN-21) vêm de
 * `.preator/skills/negocio/lancamentos-e-parcelamento/SKILL.md` — citando
 * `docs/especificacoes/EF-04-lancamentos.md` §1/§2 e
 * `docs/decisoes/D-06-dinheiro-em-centavos.md` (tabela "Divisão → Destino do
 * resíduo") como fonte primária. Nada aqui foi decidido de memória.
 *
 * ⚠️ O parcelamento deste produto é SEM JUROS — divisão inteira de um total
 * em N parcelas. `preator/conhecimento/negocio/financeiro/credito/SKILL.md`
 * (Price/SAC/CET/IOF) NÃO se aplica: dela só se aproveita o PRINCÍPIO do
 * resíduo de arredondamento (repetido três vezes naquela skill: "ajuste a
 * última [parcela] para fechar em zero"), que é o mesmo princípio de D-06.
 * Nenhuma fórmula de juros, CET ou IOF entra aqui.
 */

// ---------------------------------------------------------------------------
// Competência — RN-15/RN-18: calculada na escrita, a partir de `data`.
// ---------------------------------------------------------------------------

/**
 * RN-15 — um lançamento retroativo consome o teto do mês DA PRÓPRIA DATA,
 * nunca o do mês corrente. RN-18 — uma compra no crédito consome a categoria
 * NA DATA DA COMPRA, não na data de fechamento/vencimento da fatura (a
 * fatura, e o caixa, são da EF-05 — RN-19). As duas regras convergem na MESMA
 * fórmula: a competência é sempre o mês civil da própria `data`, sem exceção
 * de tipo de conta nem de fechamento de fatura.
 *
 * `data` é `AAAA-MM-DD` (D-06/`db/tipos.ts#dataDoFato`); a competência é os
 * 7 primeiros caracteres — `AAAA-MM`.
 */
export function competenciaDaData(data: string): string {
  return data.slice(0, 7);
}

// ---------------------------------------------------------------------------
// Aritmética de meses — usada só para posicionar cada parcela no calendário
// (uma competência por parcela). Não é regra de negócio: é o mesmo problema
// de "que dia é 31/janeiro + 1 mês" que qualquer calendário Gregoriano
// resolve por convenção (aqui: cravar no último dia do mês de destino quando
// o dia de origem não existe nele — ex.: 31/jan + 1 mês = 28 ou 29/fev).
// ---------------------------------------------------------------------------

function anoBissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

const DIAS_POR_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function ultimoDiaDoMes(ano: number, mesUmBaseado: number): number {
  if (mesUmBaseado === 2 && anoBissexto(ano)) return 29;
  return DIAS_POR_MES[mesUmBaseado - 1] as number;
}

/**
 * Soma `meses` (pode ser 0) a `data` (`AAAA-MM-DD`), cravando o dia no
 * último dia do mês de destino quando necessário.
 */
export function adicionarMeses(data: string, meses: number): string {
  const [anoStr, mesStr, diaStr] = data.split('-');
  const ano = Number(anoStr);
  const mes = Number(mesStr);
  const dia = Number(diaStr);

  const totalDeMesesBaseZero = ano * 12 + (mes - 1) + meses;
  const novoAno = Math.floor(totalDeMesesBaseZero / 12);
  const novoMes = (totalDeMesesBaseZero % 12) + 1;
  const novoDia = Math.min(dia, ultimoDiaDoMes(novoAno, novoMes));

  return `${String(novoAno).padStart(4, '0')}-${String(novoMes).padStart(2, '0')}-${String(novoDia).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// O motor de parcelamento — RN-20/RN-21.
// ---------------------------------------------------------------------------

export interface ParcelaGerada {
  /** 1-baseado. */
  numero: number;
  data: string;
  competencia: string;
  valorCentavos: number;
}

/**
 * Gera as `quantidade` parcelas de uma compra de `totalCentavos`, uma por
 * competência subsequente a partir de `dataDaCompra` (skill, fluxo 3: "o
 * serviço gera N lançamentos, um por competência subsequente").
 *
 *   parcelaCentavos = totalCentavos DIV quantidade      (divisão inteira, trunca)
 *   residuoCentavos = totalCentavos MOD quantidade
 *   parcela[1..quantidade-1] = parcelaCentavos
 *   parcela[quantidade]      = parcelaCentavos + residuoCentavos
 *
 * RN-21 — o resíduo vai para a ÚLTIMA parcela; por construção,
 * `Σ parcela[1..quantidade] === totalCentavos` sempre (D-06, tabela "Divisão
 * → Destino do resíduo": "Parcelamento → a última parcela — a soma das
 * parcelas é sempre exatamente o total").
 *
 * RN-20 é validado na BORDA (`esquemas.ts` — `quantidadeParcelas` 2..48), não
 * aqui: esta função não impõe o teto, só divide o que recebe.
 */
export function gerarParcelas(
  totalCentavos: number,
  quantidade: number,
  dataDaCompra: string,
): ParcelaGerada[] {
  const parcelaCentavos = Math.trunc(totalCentavos / quantidade);
  const residuoCentavos = totalCentavos - parcelaCentavos * quantidade;

  const parcelas: ParcelaGerada[] = [];
  for (let numero = 1; numero <= quantidade; numero += 1) {
    const data = adicionarMeses(dataDaCompra, numero - 1);
    const ehUltima = numero === quantidade;
    parcelas.push({
      numero,
      data,
      competencia: competenciaDaData(data),
      valorCentavos: ehUltima ? parcelaCentavos + residuoCentavos : parcelaCentavos,
    });
  }
  return parcelas;
}
