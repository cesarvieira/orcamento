/**
 * Prepara o banco da suíte, uma vez, antes de tudo.
 *
 * A suíte é de INTEGRAÇÃO de propósito: handler com fake não prova fiação — foi
 * assim que controller sem dispatch e evento sem consumidor passaram verdes.
 * Aqui há Postgres de verdade, migration de verdade e HTTP de verdade.
 *
 * O banco é o `DATABASE_URL_TESTE`, separado do de desenvolvimento: a suíte
 * derruba o schema a cada execução, e derrubar o banco que o gate de navegação
 * acabou de semear transformaria um teste verde numa tela vazia.
 */
import path from 'node:path';

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

export default async function preparar(): Promise<void> {
  const url = process.env.DATABASE_URL_TESTE;

  if (!url) {
    throw new Error(
      'DATABASE_URL_TESTE não está no ambiente.\n' +
      '  A suíte é de integração e precisa de um Postgres de verdade.\n' +
      '  Suba o banco:  docker compose -f docker-compose.dev.yml up -d\n' +
      '  E exporte a URL do banco de teste (ver .env.example).',
    );
  }

  // A partir daqui a aplicação inteira fala com o banco de teste.
  process.env.DATABASE_URL = url;
  process.env.NODE_ENV = 'test';
  process.env.SESSAO_SEGREDO ??= 'segredo-da-suite';

  const pool = new Pool({ connectionString: url, max: 2 });
  const db = drizzle(pool);

  try {
    // Schema do zero, sempre. É a mesma exigência do gate `deploy-fresh`:
    // migration que só aplica sobre o que já existe esconde drift.
    //
    // ⚠️ São DOIS schemas, e esquecer o segundo custou uma suíte que passava em
    // execuções alternadas: o drizzle guarda o registro de migrations aplicadas
    // em `drizzle.__drizzle_migrations`, FORA do `public`. Derrubar só o
    // `public` apagava as tabelas e deixava o registro dizendo que a migration
    // já tinha rodado — o `migrate()` seguinte não fazia nada, e os testes
    // encontravam um banco vazio.
    await db.execute(sql`drop schema if exists public cascade`);
    await db.execute(sql`drop schema if exists drizzle cascade`);
    await db.execute(sql`create schema public`);

    await migrate(db, {
      migrationsFolder: path.resolve(__dirname, '..', 'drizzle'),
    });
  } finally {
    await pool.end();
  }
}
