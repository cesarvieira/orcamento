/**
 * Configuração do drizzle-kit.
 *
 * `pnpm --filter @orcamento/api run migracao:gerar` lê `src/db/schema.ts` e ESCREVE o SQL em
 * `drizzle/`. O SQL é versionado e nunca editado à mão — quem muda o banco
 * muda o schema e regenera.
 */
import { defineConfig } from 'drizzle-kit';

// Sem default: credencial vem do ambiente, nunca de arquivo versionado (D-07).
// Falhar aqui é melhor que gerar migration contra o banco errado.
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    'DATABASE_URL não está no ambiente. Copie .env.example para .env e preencha.',
  );
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
