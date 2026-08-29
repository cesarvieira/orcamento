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

export interface CategoriaRateada {
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
 * pseudocódigo condensado da EF-06 §2. Sem o piso por categoria, uma
 * categoria já estourada (disponível negativo) entraria com peso negativo no
 * rateio e poderia produzir `bloqueado` negativo noutra categoria — violando
 * o DoD "o bloqueado de uma categoria nunca excede o disponível dela".
 *
 * RN-32/D-06 — a divisão é INTEIRA (`Math.floor`, nunca float — D-06). O
 * resíduo (sempre ≥ 0 e sempre menor que a quantidade de categorias) vai
 * para a categoria de MAIOR saldo disponível: "saldo" aqui é o mesmo
 * `disponível` do glossário — o próprio SKILL.md usa os dois como sinônimo
 * no seu edge case ("categoria com saldo R$ 50 (1/2 do total de
 * disponível)"). Assim a SOMA dos bloqueados fecha EXATAMENTE no déficit,
 * nunca um centavo a mais nem a menos.
 *
 * 🔀 FORK declarado ao humano (tarefa #76): quando `restanteTotalCentavos`
 * é 0 (nenhuma categoria com disponível positivo — inclusive "nenhuma
 * categoria existe") e ainda assim `lastroCentavos` é NEGATIVO (um cartão
 * pode ficar over-limit hoje: nenhum módulo trava DESPESA além do limite),
 * a fórmula `déficit = max(0, restanteTotal − lastro)` dá déficit > 0 com
 * `restanteTotal / 0` indefinido — e mesmo que se evitasse a divisão, as duas
 * invariantes do DoD ("soma dos bloqueados == déficit" e "bloqueado nunca
 * excede o disponível da categoria") ficam matematicamente incompatíveis
 * quando `déficit > restanteTotal` (soma de parcelas cada uma ≤ seu
 * disponível não pode superar a soma dos disponíveis). A EF-06 §2 e o
 * SKILL.md descrevem só o caso `lastro ≥ 0` (o edge case do SKILL.md fala
 * em "o caso extremo em que o lastro é ZERO", nunca negativo). Esta função
 * escolhe o piso mais conservador — nenhuma categoria bloqueada quando não
 * há base nenhuma para ratear — em vez de inventar qual das duas invariantes
 * ceder; ver o relatório da tarefa para a decisão do humano.
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
  // Piso de segurança contra divisão por zero — ver o FORK no comentário
  // acima: sem categoria com disponível nenhum, não há base para ratear.
  const deficitCentavos =
    restanteTotalCentavos === 0 ? 0 : Math.max(0, restanteTotalCentavos - lastroCentavos);
  const liberadoTotalCentavos = Math.max(0, restanteTotalCentavos - deficitCentavos);

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

  const comBloqueioBruto = disponiveis.map(c => ({
    id: c.id,
    disponivelCentavos: c.disponivelCentavos,
    bloqueadoCentavos: Math.floor((c.disponivelCentavos * deficitCentavos) / restanteTotalCentavos),
  }));

  const somaBrutaCentavos = comBloqueioBruto.reduce((soma, c) => soma + c.bloqueadoCentavos, 0);
  const residuoCentavos = deficitCentavos - somaBrutaCentavos;

  if (residuoCentavos > 0) {
    let indiceDoMaiorSaldo = 0;
    for (let indice = 1; indice < comBloqueioBruto.length; indice += 1) {
      const atual = comBloqueioBruto[indice];
      const maiorAteAgora = comBloqueioBruto[indiceDoMaiorSaldo];
      if (atual && maiorAteAgora && atual.disponivelCentavos > maiorAteAgora.disponivelCentavos) {
        indiceDoMaiorSaldo = indice;
      }
    }
    const alvoDoResiduo = comBloqueioBruto[indiceDoMaiorSaldo];
    if (alvoDoResiduo) alvoDoResiduo.bloqueadoCentavos += residuoCentavos;
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
