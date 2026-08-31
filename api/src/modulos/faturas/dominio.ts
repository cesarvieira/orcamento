/**
 * O DOMÍNIO de `faturas` (EF-05) — a matemática do ciclo do cartão. Funções
 * puras, sem banco: o serviço (`servico.ts`) só orquestra I/O em torno delas.
 *
 * ⛔ Regra #0: RN-23 e a derivação abre/fecha/vence vêm de
 * `.preator/skills/negocio/faturas-e-ciclo-do-cartao/SKILL.md` (seção "Abre,
 * fecha, vence — como os três campos produzem um ciclo concreto"), citando
 * `docs/especificacoes/EF-05-faturas.md` §2 e `EF-02-contas.md` RN-08 (a
 * faixa 1–28 de `diaFechamento`/`diaVencimento`) como fonte primária. Nada
 * aqui foi decidido de memória.
 *
 * ⚠️ Por que não há `ultimoDiaDoMes` aqui (ao contrário de
 * `modulos/lancamentos/dominio.ts#adicionarMeses`): `diaFechamento` e
 * `diaVencimento` são SEMPRE 1–28 (RN-08) — ao contrário do dia de uma
 * COMPRA, que pode ser 29/30/31. Um dia 1–28 existe em TODO mês, então somar
 * meses a ele nunca precisa cravar em "o último dia do mês de destino": essa
 * complexidade do módulo irmão não se aplica aqui.
 */

function partesDeData(data: string): { ano: number; mes: number; dia: number } {
  const [anoStr, mesStr, diaStr] = data.split('-');
  return { ano: Number(anoStr), mes: Number(mesStr), dia: Number(diaStr) };
}

function formatarData(ano: number, mes: number, dia: number): string {
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/**
 * `ano`/`mes` (1-baseado) deslocados por `meses` (pode ser negativo), com
 * `dia` FIXO — seguro porque quem chama só passa `diaFechamento`/`diaVencimento`
 * (1–28, RN-08), que existe em todo mês resultante.
 */
function comMesDeslocado(ano: number, mes: number, dia: number, meses: number): string {
  const totalDeMesesBaseZero = ano * 12 + (mes - 1) + meses;
  const novoAno = Math.floor(totalDeMesesBaseZero / 12);
  const novoMes = (totalDeMesesBaseZero % 12) + 1;
  return formatarData(novoAno, novoMes, dia);
}

/** `data` (`AAAA-MM-DD`, calendário real, dia 1–31) mais 1 dia — aritmética de calendário genuína, via `Date` UTC. */
function diaSeguinte(data: string): string {
  const { ano, mes, dia } = partesDeData(data);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  d.setUTCDate(d.getUTCDate() + 1);
  return formatarData(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * RN-23 — `fechaEm` do ciclo que CONTÉM a data `d`. "Menor ou igual" cai no
 * MESMO mês; "maior" cai no mês SEGUINTE. É esta comparação — nunca o mês
 * civil de `d` — que decide em qual fatura uma compra entra.
 *
 * Skill, seção "Os três casos obrigatórios do DoD": compra NO dia do
 * fechamento cai na fatura que fecha hoje (dia-do-mês igual a
 * `diaFechamento`, ramo "menor ou igual"); compra no dia SEGUINTE cai na
 * fatura seguinte (dia-do-mês estritamente maior).
 */
export function fechaEmDoCiclo(diaFechamento: number, data: string): string {
  const { ano, mes, dia } = partesDeData(data);
  const deslocamento = dia <= diaFechamento ? 0 : 1;
  return comMesDeslocado(ano, mes, diaFechamento, deslocamento);
}

/**
 * `abreEm` — dia seguinte ao `fechaEm` do ciclo ANTERIOR do mesmo cartão.
 * Como `diaFechamento` é sempre 1–28 (existe em todo mês), o `fechaEm` do
 * ciclo anterior é sempre exatamente `fechaEm − 1 mês` (mesmo dia-do-mês) —
 * não precisa de uma segunda consulta ao ciclo anterior de verdade.
 *
 * 🔀 FORK declarado ao humano (não decidido pela skill/EF — ela registra a
 * lacuna do "primeiro ciclo de um cartão recém-cadastrado" e deixa para quem
 * construir o serviço decidir): uso esta MESMA fórmula uniforme para todo
 * ciclo, inclusive o primeiro de um cartão. Ela produz uma data bem-definida
 * mesmo quando cai antes do cadastro do cartão (não há lançamento legítimo
 * ali, então é inofensivo), evitando um caso especial "cartão novo" sem
 * fonte. Se o produto precisar de um corte diferente (ex.: `abreEm` = data
 * de cadastro do cartão), é decisão nova — sinalizo, não decido sozinho além
 * deste ponto.
 */
export function abreEmDoCiclo(fechaEm: string): string {
  const { ano, mes, dia } = partesDeData(fechaEm);
  const fechaEmDoCicloAnterior = comMesDeslocado(ano, mes, dia, -1);
  return diaSeguinte(fechaEmDoCicloAnterior);
}

/**
 * `venceEm` — primeira ocorrência de `diaVencimento` ESTRITAMENTE depois de
 * `fechaEm`. `diaVencimento > diaFechamento` cai no MESMO mês de `fechaEm`;
 * senão (inclusive iguais) cai no mês SEGUINTE — a única forma de nunca
 * produzir vencimento no mesmo dia ou antes do fechamento.
 */
export function venceEmDoCiclo(
  diaFechamento: number,
  diaVencimento: number,
  fechaEm: string,
): string {
  const { ano, mes } = partesDeData(fechaEm);
  const deslocamento = diaVencimento > diaFechamento ? 0 : 1;
  return comMesDeslocado(ano, mes, diaVencimento, deslocamento);
}

export type StatusFatura = 'ABERTA' | 'FECHADA' | 'PAGA';

/**
 * O status EFETIVO de um ciclo, hoje. `PAGA` é o único estado que só o
 * PAGAMENTO (RN-24) produz — nunca a passagem do tempo. Sem pagamento, o
 * ciclo é `ABERTA` enquanto `hoje < fechaEm` e `FECHADA` a partir de
 * `hoje >= fechaEm` (comparação lexicográfica de `AAAA-MM-DD`, válida porque
 * o formato é largura fixa).
 *
 * ⚠️ D1 (`.preator/skills/negocio/faturas-e-ciclo-do-cartao/SKILL.md`):
 * `ABERTA` e `FECHADA` são AMBOS "fatura em aberto" no sentido de negócio —
 * esta distinção de enum não afeta RN-25/RN-26, só a exibição do ciclo.
 */
export function statusDoCiclo(
  fechaEm: string,
  hoje: string,
  pagaEm: Date | string | null,
): StatusFatura {
  if (pagaEm) return 'PAGA';
  return hoje >= fechaEm ? 'FECHADA' : 'ABERTA';
}
