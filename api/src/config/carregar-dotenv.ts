/**
 * Carrega o .env em CAMADAS: primeiro o `.env` da raiz do monorepo (valores
 * compartilhados entre ambientes — a maioria comentada lá, coberta pelo
 * default do schema ou do compose), depois `.env.${NODE_ENV}` por cima, com
 * override.
 *
 * `NODE_ENV` decide o arquivo da segunda camada: development → `.env.dev`
 * (default quando a variável está ausente — mesmo default do schema em
 * `ambiente.ts`; "dev" é só o nome do arquivo, o valor de `NODE_ENV`
 * continua `development`), test → `.env.test` (o Vitest define sozinho), ou
 * production → não existe arquivo — produção não tem NENHUM dos dois na
 * imagem; carregar sempre é seguro.
 *
 * Resolvido a partir DESTE arquivo, nunca do cwd — mesma armadilha que
 * `pastaDasMigrations()` documenta em `db/migrar.ts`.
 */
import path from 'node:path';

import { config as carregarEnv } from 'dotenv';

const RAIZ = path.resolve(__dirname, '..', '..', '..');

/** NODE_ENV → sufixo de arquivo. Sem entrada, o próprio valor é o sufixo. */
const SUFIXO_DO_ARQUIVO: Record<string, string> = { development: 'dev' };

export function carregarAmbiente(): void {
  const ambiente = process.env.NODE_ENV || 'development';
  const sufixo = SUFIXO_DO_ARQUIVO[ambiente] ?? ambiente;
  carregarEnv({ path: path.join(RAIZ, '.env'), quiet: true });
  carregarEnv({
    path: path.join(RAIZ, `.env.${sufixo}`),
    quiet: true,
    override: true,
  });
}
