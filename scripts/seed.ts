/**
 * `scripts/seed.ts` — a porta de entrada do seed pela linha de comando.
 *
 *   npm run semear
 *
 * A lógica vive em `api/src/db/semear.ts` porque ela precisa estar DENTRO da
 * imagem da API: o serviço `migrate` do compose semeia logo depois de migrar,
 * e o que não é compilado para `api/dist` não existe no container.
 *
 * As credenciais da família de teste vêm de `PREATOR_TEST_USER` e
 * `PREATOR_TEST_PASS`, do ambiente.
 */
import { db, fecharBanco } from '../api/src/db';
import { semear } from '../api/src/db/semear';

async function principal(): Promise<void> {
  const resumo = await semear(db);
  console.log(`[seed] ${resumo}`);
}

principal()
  .then(async () => {
    await fecharBanco();
    process.exit(0);
  })
  .catch(async (erro) => {
    console.error('[seed] FALHOU:', erro);
    await fecharBanco().catch(() => undefined);
    process.exit(1);
  });
