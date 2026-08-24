/**
 * Aplica as migrations versionadas em `api/drizzle/`.
 *
 * É o comando do serviço `migrate` do compose de produção — um one-shot que
 * roda ANTES da API subir, e cujo código de saída o gate `deploy-fresh` lê para
 * distinguir "migration falhou" de "API demorou".
 *
 * Com `SEMEAR=true`, semeia depois de migrar: é o que faz a área logada existir
 * para o gate de navegação.
 */
import path from 'node:path';

import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { db, fecharBanco } from './index';
import { semear } from './semear';

/** A pasta do SQL, resolvida a partir DESTE arquivo — nunca do cwd. */
function pastaDasMigrations(): string {
  // Em desenvolvimento roda de `src/db/`; compilado, de `dist/db/`.
  // Em ambos os casos `../../drizzle` cai em `api/drizzle`.
  return path.resolve(__dirname, '..', '..', 'drizzle');
}

async function principal(): Promise<void> {
  const pasta = pastaDasMigrations();
  console.log(`[migrar] aplicando migrations de ${pasta}`);
  await migrate(db, { migrationsFolder: pasta });
  console.log('[migrar] migrations aplicadas');

  if (process.env.SEMEAR === 'true') {
    console.log('[migrar] SEMEAR=true — semeando');
    const resumo = await semear(db);
    console.log(`[migrar] ${resumo}`);
  }
}

principal()
  .then(async () => {
    await fecharBanco();
    process.exit(0);
  })
  .catch(async (erro) => {
    console.error('[migrar] FALHOU:', erro);
    await fecharBanco().catch(() => undefined);
    process.exit(1);
  });
