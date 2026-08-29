/**
 * O módulo `lastro` (EF-06, tarefa #76).
 *
 * ⛔ Escalada de Regra #0 — o lastro NÃO existe em skill nenhuma da fábrica:
 * `financeiro/` cobre conciliação de gateway e controladoria empresarial,
 * `controladoria-orcamento` cobre orçado × realizado; nenhuma cobre finanças
 * pessoais nem o conceito de lastro. É regra de PRODUTO, nascida no mockup e
 * fechada com o humano. A fonte é
 * `.preator/skills/negocio/contas-e-lastro/SKILL.md` — glossário ("Caixa
 * real", "Limite livre do cartão", "Lastro", "Deficit de lastro", "Gasto
 * bloqueado (categoria)") e a tabela de regras RN-27..RN-32 — citando
 * `docs/especificacoes/EF-06-lastro.md` §2 como fonte primária, e
 * `docs/decisoes/D-06-dinheiro-em-centavos.md` para o destino do resíduo do
 * rateio (RN-32). Nada aqui foi decidido de memória.
 *
 * §1 da EF-06: "Nenhuma entidade nova. O lastro é DERIVADO, sempre.
 * Materializá-lo criaria uma segunda verdade que diverge no primeiro
 * lançamento retroativo." — por isso este módulo não tem `esquemas.ts` de
 * ESCRITA nem tabela, e nenhuma rota própria: é só cálculo, composto dentro
 * da leitura de competência (`modulos/orcamento/servico.ts#lerCompetencia`).
 */
import type { Db } from '../../db';
import { listarContas } from '../contas/servico';
import { limiteLivreTotalCentavos } from '../faturas/servico';

export interface LastroLido {
  caixaRealCentavos: number;
  limiteLivreCentavos: number;
  lastroCentavos: number;
}

/**
 * Caixa real — RN-27, SKILL.md glossário: "soma dos saldos POSITIVOS das
 * contas de débito. `max(0, saldoDebito1) + max(0, saldoDebito2) + ...`;
 * reserva não entra." O filtro `tipo === 'DEBITO'` já exclui RESERVA e
 * CREDITO sozinho — CREDITO nunca teria saldo positivo mesmo (é dívida, ver
 * `modulos/contas/servico.ts#expressaoSaldoDerivado`), mas o filtro é
 * explícito por construção, não por coincidência (mesmo espírito do
 * comentário em `totalEmContaHoje` daquele arquivo).
 *
 * ⚠️ NÃO é o mesmo número que `listarContas(...).totalEmContaHojeCentavos`:
 * aquele soma o saldo BRUTO das contas DEBITO (pode ir negativo — é "quanto
 * tenho em conta hoje", inclusive no vermelho). O lastro exige o PISO em
 * zero CONTA A CONTA — edge case do SKILL.md: "conta de débito com saldo
 * negativo: o cálculo de caixa real usa `max(0, saldo)` — débito negativo
 * não conta como caixa (nem entra negativo no total)". Por isso esta função
 * soma de novo a partir das linhas de `listarContas`, em vez de reaproveitar
 * aquele total pronto.
 */
function caixaRealCentavos(contas: Awaited<ReturnType<typeof listarContas>>['contas']): number {
  return contas
    .filter(conta => conta.tipo === 'DEBITO')
    .reduce((soma, conta) => soma + Math.max(0, conta.saldoCentavos), 0);
}

/**
 * `lastro = caixaReal + limiteLivre` (EF-06 §2). `limiteLivre` estende
 * `modulos/faturas/servico.ts#limiteLivreTotalCentavos` (RN-26/D1 por
 * cartão, RN-28 agregado sobre todos os cartões da família).
 */
export async function calcularLastro(db: Db, familiaId: string): Promise<LastroLido> {
  const [{ contas }, limiteLivre] = await Promise.all([
    listarContas(db, familiaId),
    limiteLivreTotalCentavos(db, familiaId),
  ]);
  const caixaReal = caixaRealCentavos(contas);

  return {
    caixaRealCentavos: caixaReal,
    limiteLivreCentavos: limiteLivre,
    lastroCentavos: caixaReal + limiteLivre,
  };
}

// ---------------------------------------------------------------------------
// Rateio pró-rata do déficit — RN-29/RN-32. Função PURA: não toca banco,
// recebe só o `disponivelCentavos` de cada categoria (já lido por
// `modulos/orcamento/servico.ts#lerCompetencia`, RN-10) e o `lastroCentavos`
// (`calcularLastro` acima). Pura de propósito: é a peça mais fácil de testar
// isoladamente, e é exatamente onde mora o resíduo de RN-32/D-06.
// ---------------------------------------------------------------------------

export interface CategoriaParaRateio {
  id: string;
  disponivelCentavos: number;
}

interface CategoriaRateada {
  id: string;
  liberadoCentavos: number;
  bloqueadoCentavos: number;
}

export interface ResultadoDoRateio {
  restanteTotalCentavos: number;
  deficitCentavos: number;
  /** RN-30: o número em destaque. Nunca o plano cheio quando há déficit. */
  liberadoTotalCentavos: number;
  categorias: CategoriaRateada[];
}

/**
 * RN-29 — o déficit é rateado PRÓ-RATA pelo `disponível` de cada categoria;
 * não há categoria privilegiada. O piso `max(0, disponível)` é aplicado
 * tanto no AGREGADO (`restanteTotal`, EF-06 §2) quanto POR categoria — esta
 * segunda parte é a redação exata do corpo da issue #76 (`bloqueado =
 * max(0, disponível) × déficit / restanteTotal`), mais explícita que o
 * pseudocódigo condensado da EF-06 §2.
 *
 * ⛔ O TETO do déficit — EF-06 §5 (Definition of Done), retrabalho da
 * revisão de diff da tarefa #76. A EF-06 fecha DUAS invariantes, literais:
 *
 *   > "Soma dos bloqueados == déficit, com valores quebrados"
 *   > "O bloqueado de uma categoria nunca excede o disponível dela"
 *
 * As duas JUNTAS forçam `déficit ≤ restanteTotal`: se cada `bloqueado_i` ≤
 * `disponivel_i` (segunda invariante) e `Σ bloqueado_i == déficit` (primeira),
 * então `déficit ≤ Σ disponivel_i == restanteTotal` — é aritmética, não
 * escolha de implementação. `déficitCentavos` abaixo é por isso sempre
 * CAPADO em `restanteTotalCentavos`, nunca o `restanteTotal − lastro` cru:
 * quando `lastroCentavos` é negativo (um cartão pode ficar over-limit hoje —
 * nenhum módulo trava DESPESA além do limite), o cru ultrapassaria
 * `restanteTotal`, e as duas invariantes acima deixariam de caber juntas.
 * Capar o déficit em `restanteTotal` é a única leitura que preserva as DUAS
 * — nunca as duas violadas, nunca uma delas abandonada.
 *
 * 🔀 FORK F3 atualizado (tarefa #76, revisão de diff): o caso `déficit >
 * restanteTotal` NÃO é mais indefinido — a própria EF-06 §5 fecha o teto
 * acima, e o cálculo é determinístico em qualquer sinal de `lastroCentavos`.
 * O que PERMANECE aberto ao humano é outra pergunta, de OUTRA EF: hoje
 * nenhum módulo (`lancamentos`, `faturas`) impede uma `DESPESA` de deixar um
 * cartão além do `limiteCentavos` — é essa lacuna, não o rateio do lastro,
 * que decide se `lastroCentavos` chega negativo na prática.
 *

 * RN-32/D-06 — a divisão é INTEIRA (`Math.floor`, nunca float — D-06):
 *
 *   > "O resíduo do rateio vai para a categoria de maior saldo; a soma dos
 *   > bloqueados é exatamente o déficit"
 *
 * "Maior saldo" aqui é o mesmo `disponível` do glossário — o próprio
 * SKILL.md usa os dois como sinônimo no seu edge case ("categoria com saldo
 * R$ 50 (1/2 do total de disponível)"). O resíduo (sempre ≥ 0 e sempre menor
 * que a quantidade de categorias, porque é soma de frações cada uma < 1)
 * pode ultrapassar a FOLGA da maior categoria (`disponível − bloqueado`
 * bruto) quando o déficit está perto do restante total — jogar o resíduo
 * inteiro nela estouraria a segunda invariante (achado da revisão,
 * reproduzido com `disponíveis=[1,1,1], lastro=1`: déficit=2, bloqueado
 * bruto de cada é 0, resíduo=2, e dar os 2 a uma categoria de disponível 1
 * já extrapola). A LETRA de RN-32 ("maior saldo") e o PROPÓSITO dela ("a
 * soma é exatamente o déficit") continuam valendo juntos se, quando a maior
 * categoria não absorve o resíduo inteiro sem estourar o próprio disponível,
 * o EXCEDENTE segue para a PRÓXIMA maior, e assim por diante — é RN-32
 * aplicada por inteiro, não uma regra nova: a soma continua fechando exata,
 * e "maior saldo primeiro" continua sendo a prioridade, só que agora
 * respeitando o teto de cada categoria no caminho. Com `déficit ≤
 * restanteTotal` já garantido acima, a folga TOTAL (`Σ (disponivel_i −
 * bloqueado_i)` bruto) é sempre ≥ o resíduo — a distribuição em cascata
 * abaixo sempre termina de absorver o resíduo inteiro, nunca sobra nada.
 */
export function ratearDeficit(
  categorias: CategoriaParaRateio[],
  lastroCentavos: number,
): ResultadoDoRateio {
  const disponiveis = categorias.map(categoria => ({
    id: categoria.id,
    disponivelCentavos: Math.max(0, categoria.disponivelCentavos),
  }));

  const restanteTotalCentavos = disponiveis.reduce((soma, c) => soma + c.disponivelCentavos, 0);

  // EF-06 §5 — capado em restanteTotal (ver o comentário acima da função):
  // as duas invariantes do DoD só cabem juntas se déficit ≤ restanteTotal.
  // Quando restanteTotalCentavos é 0, min(0, ...) já dá 0 sozinho — cobre o
  // caso "nenhuma categoria com disponível" sem precisar de guarda à parte.
  const deficitBrutoCentavos = Math.max(0, restanteTotalCentavos - lastroCentavos);
  const deficitCentavos = Math.min(restanteTotalCentavos, deficitBrutoCentavos);
  const liberadoTotalCentavos = restanteTotalCentavos - deficitCentavos;

  if (deficitCentavos === 0) {
    return {
      restanteTotalCentavos,
      deficitCentavos,
      liberadoTotalCentavos,
      categorias: disponiveis.map(c => ({
        id: c.id,
        liberadoCentavos: c.disponivelCentavos,
        bloqueadoCentavos: 0,
      })),
    };
  }

  // Piso pró-rata por divisão inteira — cada bloqueado bruto é ≤ seu
  // disponível, porque déficit ≤ restanteTotal (ver acima) faz a razão
  // déficit/restanteTotal ≤ 1.
  const comBloqueioBruto = disponiveis.map(c => ({
    id: c.id,
    disponivelCentavos: c.disponivelCentavos,
    bloqueadoCentavos: Math.floor((c.disponivelCentavos * deficitCentavos) / restanteTotalCentavos),
  }));

  const somaBrutaCentavos = comBloqueioBruto.reduce((soma, c) => soma + c.bloqueadoCentavos, 0);
  const residuoCentavos = deficitCentavos - somaBrutaCentavos;

  // RN-32 aplicada por inteiro (ver o comentário da função): resíduo vai
  // para a MAIOR categoria primeiro, mas só até a folga dela (disponível −
  // bloqueado bruto); o que sobrar segue em cascata para a próxima maior.
  if (residuoCentavos > 0) {
    const ordemDecrescente = comBloqueioBruto
      .map((c, indiceOriginal) => ({ ...c, indiceOriginal }))
      .sort((a, b) => b.disponivelCentavos - a.disponivelCentavos || a.indiceOriginal - b.indiceOriginal);

    let residuoRestante = residuoCentavos;
    for (const candidato of ordemDecrescente) {
      if (residuoRestante === 0) break;
      const alvo = comBloqueioBruto[candidato.indiceOriginal];
      if (!alvo) continue;
      const folga = alvo.disponivelCentavos - alvo.bloqueadoCentavos;
      const parcela = Math.min(folga, residuoRestante);
      alvo.bloqueadoCentavos += parcela;
      residuoRestante -= parcela;
    }

    if (residuoRestante > 0) {
      // Não deveria acontecer: a folga total é sempre ≥ o resíduo quando
      // déficit ≤ restanteTotal (prova no comentário da função). Se isto
      // disparar, é sinal de que as duas invariantes do DoD §5 não cabem
      // juntas neste caso — FORK ao humano, não silenciar.
      throw new Error(
        'lastro: resíduo do rateio não coube na folga das categorias — invariante de RN-32/DoD §5 quebrada',
      );
    }
  }

  return {
    restanteTotalCentavos,
    deficitCentavos,
    liberadoTotalCentavos,
    categorias: comBloqueioBruto.map(c => ({
      id: c.id,
      bloqueadoCentavos: c.bloqueadoCentavos,
      liberadoCentavos: c.disponivelCentavos - c.bloqueadoCentavos,
    })),
  };
}
