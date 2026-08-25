/**
 * A conexão. Um pool por processo, um `drizzle(pool)` por pool.
 *
 * Não abra outro pool em lugar nenhum: cada pool novo é um teto de conexões
 * novo, e o Postgres do compose tem um só.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { ambiente } from '../config/ambiente';
import * as schema from './schema';

/** @fundacao acesso direto ao pool — `db` já cobre toda leitura/escrita normal. */
export const pool = new Pool({
  connectionString: ambiente.DATABASE_URL,
  max: 10,
});

export const db = drizzle(pool, { schema });

export type Db = typeof db;

/** Fecha o pool. Chamado no encerramento gracioso e ao fim da suíte. */
export async function fecharBanco(): Promise<void> {
  await pool.end();
}

/** @fundacao reexportado para quem precisar do schema cru, fora do `db`. */
export { schema };
