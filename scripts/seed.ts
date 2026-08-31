/**
 * `scripts/seed.ts` — a porta de entrada do seed pela linha de comando.
 *
 *   pnpm run semear
 *
 * A lógica vive em `api/src/db/semear.ts` porque ela precisa estar DENTRO da
 * imagem da API: o serviço `migrate` do compose semeia logo depois de migrar,
 * e o que não é compilado para `api/dist` não existe no container.
 *
 * Gera um ambiente completo (2 meses passados + mês atual + futuros): contas,
 * orçamento, lançamentos, faturas, metas e fechamento. Idempotente — se a
 * família de teste já existir com dados antigos, não reconstrói; para forçar
 * o ambiente novo, limpe o banco antes (`truncate` em cascata a partir de
 * `familias`, ou `docker compose` down -v + up).
 *
 * As credenciais da família de teste vêm de `PREATOR_TEST_USER` e
 * `PREATOR_TEST_PASS`, do ambiente.
 */
import { db, fecharBanco } from '../api/src/db';
import { semear } from '../api/src/db/semear';

async function principal(): Promise<void> {
  try {
    const resumo = await semear(db);
    console.log(`[seed] ${resumo}`);
    await fecharBanco();
    process.exit(0);
  } catch (erro) {
    console.error('[seed] FALHOU:', erro);
    try {
      await fecharBanco();
    } catch {
      // banco já pode estar inacessível — o processo sai de qualquer forma
    }
    process.exit(1);
  }
}

// IIFE, não top-level await: nem a raiz nem `api/` declaram `"type": "module"`
// no `package.json`, e o `tsx` decide CJS/ESM por isso — top-level await
// quebra com "not supported with the cjs output format" (mesma causa do IIFE
// em `api/src/db/migrar.ts`).
void (async () => {
  await principal();
})();
