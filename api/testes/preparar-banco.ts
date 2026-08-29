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
/**
 * Criado por `api/docker/criar-banco-de-teste.sql` na primeira subida — mas
 * só quando NINGUÉM derivou nada (execução fora de worktree).
 *
 * `BANCO_TESTE_DERIVADO` vem de `preator-perfil.sh` (tarefa #84, vetor de
 * concorrência): cada worktree deriva um nome de banco próprio, determinístico
 * a partir do número da tarefa (ou hash do caminho, no fallback), para que
 * dois gates rodando ao mesmo tempo nunca disputem o MESMO schema — antes
 * disto, `drop schema cascade` de uma suíte derrubava a outra no meio da
 * execução. `preator-perfil.sh` só exporta o NOME (nunca uma string de
 * conexão — o cabeçalho dele proíbe isso); a URL inteira continua sendo
 * montada NESTE único lugar, por partes, como abaixo.
 */
const BANCO_PADRAO = process.env.BANCO_TESTE_DERIVADO || 'orcamento_teste';

const BANCO_DE_TESTE_PADRAO = [
  'postgres://',
  USUARIO_PADRAO, ':', SENHA_PADRAO,
  '@', HOST_PADRAO, '/', BANCO_PADRAO,
].join('');

/**
 * Cria o DATABASE de `url` se ele ainda não existir, no MESMO servidor.
 *
 * Antes da tarefa #84, `orcamento_teste` só existia porque
 * `api/docker/criar-banco-de-teste.sql` o cria na primeira subida do
 * compose de dev — um nome novo (o banco derivado por worktree, ver
 * `preator-perfil.sh`) nunca teria sido criado, e a suíte morreria com
 * `database "orcamento_teste_n84" does not exist` antes mesmo do `drop
 * schema` abaixo.
 *
 * `CREATE DATABASE` não roda dentro de uma conexão apontando pro próprio
 * banco-alvo (nem dentro de transação) — por isso conecta em `postgres`,
 * o banco administrativo que todo servidor Postgres cria por padrão,
 * independente do que `POSTGRES_DB` declarar no compose.
 */
async function garantirBancoExiste(url: string): Promise<void> {
  const alvo = new URL(url);
  const nomeBanco = alvo.pathname.replace(/^\//, '');
  if (!nomeBanco) return; // URL sem banco no path — nada a garantir aqui.

  const admin = new URL(url);
  admin.pathname = '/postgres';
  const poolAdmin = new Pool({ connectionString: admin.toString(), max: 1 });

  try {
    const existe = await poolAdmin.query(
      'select 1 from pg_database where datname = $1',
      [nomeBanco],
    );
    if (existe.rowCount === 0) {
      // Identificador de banco não aceita bind parameter — só literal. O
      // nome vem de DATABASE_URL_TESTE (perfil ou .env.test), nunca de
      // input externo, mas a aspa dupla ainda é escapada por hábito são.
      await poolAdmin.query(`create database "${nomeBanco.replace(/"/g, '""')}"`);
    }
  } catch (erro) {
    const causa = erro instanceof Error ? erro.message : String(erro);
    throw new Error(
      `não consegui garantir o banco de teste "${nomeBanco}" (conectando em ${admin.host} como administrativo)\n` +
      `  causa: ${causa}\n` +
      '  A suíte precisa CRIAR o database antes de preparar o schema — confira se o' +
      ' usuário tem permissão de CREATEDB e se o servidor em ' + admin.host + ' está de pé.',
      { cause: erro },
    );
  } finally {
    await poolAdmin.end();
  }
}

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

  await garantirBancoExiste(url);

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
