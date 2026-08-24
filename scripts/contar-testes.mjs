/**
 * Imprime quantos testes REALMENTE rodaram.
 *
 * O gate `test` exige N > 0 executados — suíte que não achou teste é FAIL, não
 * aprovação. Ele sabe ler alguns runners, mas o formato do vitest não bate com
 * nenhum dos padrões dele por acidente feliz (ele acabaria somando "Test Files"
 * com "Tests" e inflando a conta).
 *
 * Aqui a resposta vem do relatório JSON do próprio vitest, que é o número real.
 * É o `TEST_COUNT_CMD` do `preator-perfil.sh`.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const relatorio = path.join(aqui, '..', 'api', 'relatorio-testes.json');

try {
  const dados = JSON.parse(readFileSync(relatorio, 'utf8'));
  console.log(dados.numTotalTests ?? 0);
} catch {
  // Sem relatório é zero — e zero é FAIL no gate, que é o veredito honesto:
  // a suíte não chegou a escrever nada.
  console.log(0);
}
