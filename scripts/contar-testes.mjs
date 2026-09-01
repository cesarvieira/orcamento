/**
 * Imprime quantos testes REALMENTE rodaram, somando TODOS os workspaces.
 *
 * O gate `test` exige N > 0 executados — suíte que não achou teste é FAIL, não
 * aprovação. Ele sabe ler alguns runners, mas o formato do vitest não bate com
 * nenhum dos padrões dele por acidente feliz (ele acabaria somando "Test Files"
 * com "Tests" e inflando a conta).
 *
 * Aqui a resposta vem do relatório JSON do próprio vitest, que é o número real
 * — um por workspace, porque cada um roda sua própria suíte (ver `teste` em
 * `api/package.json` e `web/package.json`, mesmo formato de reporter nos
 * dois). É o `TEST_COUNT_CMD` do `preator-perfil.sh`.
 *
 * Tarefa #107 (história #63) acrescentou `web/relatorio-testes.json` a esta
 * lista — antes só `api/` contava para `GATE_TEST_EXECUTADOS`.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));

const relatorios = [
  path.join(aqui, '..', 'api', 'relatorio-testes.json'),
  path.join(aqui, '..', 'web', 'relatorio-testes.json'),
];

let total = 0;
for (const relatorio of relatorios) {
  try {
    const dados = JSON.parse(readFileSync(relatorio, 'utf8'));
    total += dados.numTotalTests ?? 0;
  } catch {
    // Sem relatório é zero PARA ESTE workspace — não derruba a soma dos
    // demais. Se NENHUM relatório existir, o total é zero, e zero é FAIL no
    // gate: o veredito honesto de que a suíte não chegou a escrever nada.
  }
}

console.log(total);
