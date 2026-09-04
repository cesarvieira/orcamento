/**
 * Prova da corrida da tarefa #105 (história #63) e do conserto.
 *
 * Roda sob o runner OFICIAL de `web/` — vitest, introduzido pela tarefa #107
 * (história #63) — em vez do `node --test` puro que a primeira rodada desta
 * tarefa usou: naquele momento `web/` ainda não tinha nenhum runner de teste
 * (decisão de plataforma fora do escopo desta tarefa de tela), então este
 * arquivo usava só o runner nativo do Node como ponte. Com #107 mesclado, a
 * ponte deixou de ser necessária — a lógica do teste é a MESMA, só a sintaxe
 * de import/assert mudou para `describe`/`it`/`expect`.
 *
 * Exercita `useExtratoLeitura` — o MESMO composable que `extrato.vue` importa
 * e usa (não uma cópia da lógica).
 *
 * Rodar (de dentro de `web/`):
 *   pnpm run teste -- app/composables/useExtratoLeitura.teste.ts
 */
import { describe, expect, it } from 'vitest';
import { useExtratoLeitura, type RespostaDeLancamentos } from './useExtratoLeitura.ts';

type LancamentoFalso = RespostaDeLancamentos['lancamentos'][number];

/** Um `Lancamento` mínimo — só a forma, o composable não olha os outros campos. */
function lancamentoFalso(id: string): LancamentoFalso {
  return {
    id,
    tipo: 'DESPESA',
    descricao: `lançamento ${id}`,
    valorCentavos: 1000,
    data: '2026-08-20',
    criadoEm: '2026-08-20T00:00:00.000Z',
    categoriaId: null,
    contaDestinoId: null,
  } as LancamentoFalso;
}

/**
 * Uma resposta do extrato. `saldosPorDia` entrou no contrato com o saldo
 * acumulado por dia; estes testes são sobre a CORRIDA de leitura, não sobre o
 * saldo, então o dublê devolve a lista vazia — o que importa aqui é a forma.
 */
function resposta(lancamentos: LancamentoFalso[]): RespostaDeLancamentos {
  return { lancamentos, saldosPorDia: [] };
}

async function aguardarMicrotarefas(voltas = 4): Promise<void> {
  for (let i = 0; i < voltas; i++) await Promise.resolve();
}

/**
 * Um `listar` controlável de fora: cada chamada fica PENDENTE até o teste
 * mandar resolver, na ORDEM em que `carregar()`/`verificarSeFamiliaTemHistorico`
 * de fato a disparam — é o que permite fazer respostas voltarem fora de ordem.
 */
function criarListarControlavel() {
  const pendentes: { resolver: (r: RespostaDeLancamentos) => void }[] = [];

  async function listar(): Promise<RespostaDeLancamentos> {
    return new Promise<RespostaDeLancamentos>((resolver) => {
      pendentes.push({ resolver });
    });
  }

  /** Resolve a chamada pendente no índice `indice` (ordem de disparo real de `listar()`). */
  function resolverChamada(indice: number, resposta: RespostaDeLancamentos): void {
    const chamada = pendentes[indice];
    if (!chamada) {
      throw new Error(`esperava uma chamada de listar() pendente no índice ${indice}, só há ${pendentes.length}`);
    }
    chamada.resolver(resposta);
  }

  return { listar, resolverChamada };
}

describe('useExtratoLeitura', () => {
  it('corrida: a resposta ATRASADA de verificarSeFamiliaTemHistorico() da chamada MAIS ANTIGA não pode vencer a MAIS NOVA', async () => {
    const { listar, resolverChamada } = criarListarControlavel();
    const leitura = useExtratoLeitura({ listar });

    // ── DISPARO 1 (mais antigo): carregar('2026-08') ─────────────────────────
    // listar(filtro) → pendente[0].
    const chamadaMaisAntiga = leitura.carregar({ competencia: '2026-08' });

    // Resolve a leitura filtrada vazia → carregar() entra no caminho vazio e chama
    // verificarSeFamiliaTemHistorico, que dispara SEU PRÓPRIO listar({}) → pendente[1].
    // Essa segunda chamada fica pendente (não resolvida ainda) — é a "resposta atrasada".
    resolverChamada(0, resposta([]));
    await aguardarMicrotarefas();

    // ── DISPARO 2 (mais novo): carregar('2026-09'), disparado DEPOIS do disparo 1 ────
    // listar(filtro) → pendente[2].
    const chamadaMaisNova = leitura.carregar({ competencia: '2026-09' });

    // A leitura filtrada da chamada mais nova volta com lançamento (não é vazia) —
    // decide a tela direto, sem precisar de verificarSeFamiliaTemHistorico.
    resolverChamada(2, resposta([lancamentoFalso('mais-novo')]));
    await chamadaMaisNova;

    expect(
      leitura.familiaSemHistorico.value,
      'a chamada mais nova (disparo 2) tem lançamento — não deveria mostrar o vazio de família nova',
    ).toBe(false);

    // ── A RESPOSTA ATRASADA chega por último: o histórico do disparo 1 (o mais ANTIGO) ──
    // era vazio — sozinha ela diria "família sem histórico". Mas o disparo 1 já está
    // OBSOLETO: o disparo 2 (mais novo) já decidiu a tela.
    resolverChamada(1, resposta([]));
    await aguardarMicrotarefas();
    await chamadaMaisAntiga;

    // A ORDEM DE DISPARO (2 depois de 1) deve vencer, não a ordem de resposta
    // (a resposta do disparo 1 chegou por último). Antes da tarefa #105,
    // `verificarSeFamiliaTemHistorico()` não tinha o carimbo `minhaOrdem` e esta
    // resposta atrasada sobrescrevia `familiaSemHistorico` para `true` — a corrida.
    expect(
      leitura.familiaSemHistorico.value,
      'a resposta atrasada da chamada MAIS ANTIGA sobrescreveu o estado da MAIS NOVA — corrida presente',
    ).toBe(false);
  });

  it('sem corrida: uma única chamada de carregar() ainda decide corretamente o vazio de família nova', async () => {
    const { listar, resolverChamada } = criarListarControlavel();
    const leitura = useExtratoLeitura({ listar });

    const chamada = leitura.carregar({ competencia: '2026-08' });
    resolverChamada(0, resposta([])); // filtrada vazia → dispara o histórico
    await aguardarMicrotarefas();
    resolverChamada(1, resposta([])); // histórico também vazio → família nova
    await chamada;

    expect(leitura.familiaSemHistorico.value).toBe(true);
    expect(leitura.carregando.value).toBe(false);
    expect(leitura.erro.value).toBe(null);
  });
});
