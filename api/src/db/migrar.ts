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

import { ambiente } from '../config/ambiente';
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

  if (ambiente.SEMEAR) {
    console.log('[migrar] SEMEAR=true — semeando');
    const resumo = await semear(db);
    console.log(`[migrar] ${resumo}`);
  }
}

// IIFE, não top-level await: este arquivo compila em CommonJS (`tsc`), que
// não aceita top-level await.
void (async () => {
  try {
    await principal();
    await fecharBanco();
    process.exit(0);
  } catch (erro) {
    console.error('[migrar] FALHOU:', erro);
    try {
      await fecharBanco();
    } catch {
      // banco já pode estar inacessível — o processo sai de qualquer forma
    }
    process.exit(1);
  }
})();
