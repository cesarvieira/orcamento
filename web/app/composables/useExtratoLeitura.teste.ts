/**
 * Prova da corrida da tarefa #105 (história #63) e do conserto.
 *
 * ⚠️ ESTE PROJETO NÃO TEM RUNNER DE TESTE PARA O FRONT (`web/package.json`
 * não declara `vitest`/`@vue/test-utils`; `TEST_CMD` do `preator-perfil.sh`
 * só cobre `@orcamento/api`). Montar a SFC de verdade exigiria instalar essa
 * infraestrutura inteira — decisão de plataforma (EF-00), fora do escopo
 * desta tarefa (`web/app/pages/extrato.vue`).
 *
 * Por isso este arquivo usa só o RUNNER NATIVO do Node (`node:test` +
 * `node:assert/strict`) sobre `useExtratoLeitura` — o MESMO composable que
 * `extrato.vue` importa e usa (não uma cópia da lógica): `ref`/`computed` do
 * Vue rodam em Node puro, sem bundler, e nenhuma dependência nova entrou.
 *
 * Rodar (de dentro de `web/`):
 *   node --test app/composables/useExtratoLeitura.teste.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
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
    assert.ok(chamada, `esperava uma chamada de listar() pendente no índice ${indice}, só há ${pendentes.length}`);
    chamada.resolver(resposta);
  }

  return { listar, resolverChamada };
}

test('corrida: a resposta ATRASADA de verificarSeFamiliaTemHistorico() da chamada MAIS ANTIGA não pode vencer a MAIS NOVA', async () => {
  const { listar, resolverChamada } = criarListarControlavel();
  const leitura = useExtratoLeitura({ listar });

  // ── DISPARO 1 (mais antigo): carregar('2026-08') ─────────────────────────
  // listar(filtro) → pendente[0].
  const chamadaMaisAntiga = leitura.carregar({ competencia: '2026-08' });

  // Resolve a leitura filtrada vazia → carregar() entra no caminho vazio e chama
  // verificarSeFamiliaTemHistorico, que dispara SEU PRÓPRIO listar({}) → pendente[1].
  // Essa segunda chamada fica pendente (não resolvida ainda) — é a "resposta atrasada".
  resolverChamada(0, { lancamentos: [] });
  await aguardarMicrotarefas();

  // ── DISPARO 2 (mais novo): carregar('2026-09'), disparado DEPOIS do disparo 1 ────
  // listar(filtro) → pendente[2].
  const chamadaMaisNova = leitura.carregar({ competencia: '2026-09' });

  // A leitura filtrada da chamada mais nova volta com lançamento (não é vazia) —
  // decide a tela direto, sem precisar de verificarSeFamiliaTemHistorico.
  resolverChamada(2, { lancamentos: [lancamentoFalso('mais-novo')] });
  await chamadaMaisNova;

  assert.equal(
    leitura.familiaSemHistorico.value,
    false,
    'a chamada mais nova (disparo 2) tem lançamento — não deveria mostrar o vazio de família nova',
  );

  // ── A RESPOSTA ATRASADA chega por último: o histórico do disparo 1 (o mais ANTIGO) ──
  // era vazio — sozinha ela diria "família sem histórico". Mas o disparo 1 já está
  // OBSOLETO: o disparo 2 (mais novo) já decidiu a tela.
  resolverChamada(1, { lancamentos: [] });
  await aguardarMicrotarefas();
  await chamadaMaisAntiga;

  // A ORDEM DE DISPARO (2 depois de 1) deve vencer, não a ordem de resposta
  // (a resposta do disparo 1 chegou por último). Antes da tarefa #105,
  // `verificarSeFamiliaTemHistorico()` não tinha o carimbo `minhaOrdem` e esta
  // resposta atrasada sobrescrevia `familiaSemHistorico` para `true` — a corrida.
  assert.equal(
    leitura.familiaSemHistorico.value,
    false,
    'a resposta atrasada da chamada MAIS ANTIGA sobrescreveu o estado da MAIS NOVA — corrida presente',
  );
});

test('sem corrida: uma única chamada de carregar() ainda decide corretamente o vazio de família nova', async () => {
  const { listar, resolverChamada } = criarListarControlavel();
  const leitura = useExtratoLeitura({ listar });

  const chamada = leitura.carregar({ competencia: '2026-08' });
  resolverChamada(0, { lancamentos: [] }); // filtrada vazia → dispara o histórico
  await aguardarMicrotarefas();
  resolverChamada(1, { lancamentos: [] }); // histórico também vazio → família nova
  await chamada;

  assert.equal(leitura.familiaSemHistorico.value, true);
  assert.equal(leitura.carregando.value, false);
  assert.equal(leitura.erro.value, null);
});
