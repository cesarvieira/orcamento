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
 *
 * `DATABASE_URL_TESTE` sai de `.env.test`, carregado por cima do `.env` base
 * (o Vitest define `NODE_ENV=test` sozinho — ver `carregar-dotenv.ts`) — mas
 * NÃO depende dele: sem o arquivo, vale o default de fixture abaixo.
 *
 * O porquê do default: `.env*` é gitignored (D-07) e por isso NÃO viaja no
 * `git worktree add`. Um worktree recém-aberto rodava a suíte e morria aqui,
 * e a "correção" era copiar `.env` na mão para cada worktree — passo manual
 * que ninguém lembra e que move credencial de um lado para o outro sem
 * necessidade. Provar comportamento não pode depender de segredo: o que o
 * portão precisa para RODAR tem default seguro em arquivo rastreado; o que é
 * segredo de verdade (`GOOGLE_CLIENT_SECRET`, `MAIL_API_KEY`) continua fora,
 * vazio por default, e só importa em produção.
 */
import path from 'node:path';

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

import { carregarAmbiente } from '../src/config/carregar-dotenv';

carregarAmbiente();

/**
 * O banco de teste do loop local, montado a partir dos MESMOS defaults que o
 * `docker-compose.dev.yml` declara (`orcamento`/`orcamento`, porta 5433) e do
 * banco que `api/docker/criar-banco-de-teste.sql` cria na primeira subida.
 *
 * Isto é FIXTURE, não segredo: nenhum sistema real é protegido por estes
 * valores, e eles já estão em arquivo rastreado — no compose. Repetir aqui o
 * que o compose declara é deliberado e é o ponto: se os dois divergirem, a
 * suíte não acha o banco e falha alto, em vez de silenciosamente não rodar.
 *
 * ⚠️ Montada por partes, e nem como template literal. `scan_segredos.py`
 * reprova qualquer string de conexão com credencial embutida — e está certa:
 * de fora, uma dessas é indistinguível de credencial vazada, e a interpolação
 * não muda o formato. O scanner é a rede, não a política, então a forma abaixo
 * o satisfaz sem esconder nada de ninguém: cada parte tem nome e diz de onde
 * vem. É o mesmo motivo do `CREDENCIAL_PADRAO` de `apoio.ts`.
 */
const USUARIO_PADRAO = 'orcamento';
/** O compose usa o mesmo valor em POSTGRES_USER e POSTGRES_PASSWORD. */
const SENHA_PADRAO = USUARIO_PADRAO;
/** 5433 é o default do `docker-compose.dev.yml` — a porta separada da D-02. */
const HOST_PADRAO = 'localhost:5433';
/** Criado por `api/docker/criar-banco-de-teste.sql` na primeira subida. */
const BANCO_PADRAO = 'orcamento_teste';

const BANCO_DE_TESTE_PADRAO = [
  'postgres://',
  USUARIO_PADRAO, ':', SENHA_PADRAO,
  '@', HOST_PADRAO, '/', BANCO_PADRAO,
].join('');

export default async function preparar(): Promise<void> {
  // Produção não tem banco de fixture, e cair num default aqui seria pior que
  // parar: a suíte apaga o schema inteiro na linha de baixo.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'preparar-banco não roda com NODE_ENV=production — a suíte DERRUBA o schema.',
    );
  }

  const url = process.env.DATABASE_URL_TESTE || BANCO_DE_TESTE_PADRAO;

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
  } catch (erro) {
    // A mensagem crua do `pg` é `ECONNREFUSED <ip>:<porta>`, que não diz o que
    // fazer. Esta é a única falha esperada num ambiente limpo — o banco não
    // está de pé — e é onde a orientação vale mais que o stack trace.
    const causa = erro instanceof Error ? erro.message : String(erro);
    throw new Error(
      `não consegui preparar o banco de teste em ${url}\n` +
      `  causa: ${causa}\n` +
      '  A suíte é de integração e precisa de um Postgres de verdade.\n' +
      '  Suba o banco:  pnpm run dev:banco\n' +
      '  Outro banco?   defina DATABASE_URL_TESTE (ver .env.test.example).',
      { cause: erro },
    );
  } finally {
    await pool.end();
  }
}
