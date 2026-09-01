/**
 * `pnpm --filter @orcamento/api run sentry:teste`
 *
 * A porta de teste que funciona A QUALQUER MOMENTO, sem stack no ar e sem
 * ligar chave nenhuma (D-08). Manda dois eventos de verdade — uma mensagem e
 * uma exceção —, ESPERA a confirmação de entrega e imprime o `event_id`.
 *
 * O que ela prova, e que nenhum teste automatizado prova: o caminho até a
 * instância. DNS, TLS, certificado próprio, quota, rota de saída, rede do
 * compose. É por isso que ela **sai com código diferente de zero** quando não
 * confirma a entrega: um teste de integração que não pode falhar não é teste.
 *
 * Dentro do contêiner, depois do build:
 *
 *     docker compose exec api node dist/scripts/sentry-teste.js
 */
import { ambiente } from '../config/ambiente';
import {
  Sentry,
  ambienteDoSentry,
  descarregar,
  sentryLigado,
} from '../instrumentacao';

const MARCA = '[sentry-teste]';

/** O DSN sem a chave pública — o que se pode imprimir num terminal compartilhado. */
function dsnSemSegredo(dsn: string): string {
  try {
    const u = new URL(dsn);
    return `${u.protocol}//***@${u.host}${u.pathname}`;
  } catch {
    return '<SENTRY_DSN não é uma URL válida>';
  }
}

/**
 * O link direto do evento na instância self-hosted. Precisa do slug da
 * organização, que o DSN não carrega — sem `SENTRY_ORG`, devolve a raiz da
 * instância e o `event_id` continua sendo o que se procura na busca.
 */
function ondeVer(dsn: string, eventId: string): string {
  try {
    const u = new URL(dsn);
    const base = `${u.protocol}//${u.host}`;
    if (!ambiente.SENTRY_ORG) return `${base} (busque por ${eventId})`;
    return `${base}/organizations/${ambiente.SENTRY_ORG}/issues/?query=${eventId}`;
  } catch {
    return '<SENTRY_DSN não é uma URL válida>';
  }
}

async function principal(): Promise<number> {
  if (!sentryLigado()) {
    console.error(`${MARCA} SENTRY_DSN está vazio — o SDK está inerte e nada será enviado.`);
    console.error(`${MARCA} Preencha SENTRY_DSN no ambiente. Ver .preator/playbooks/sentry.md`);
    return 1;
  }

  console.log(`${MARCA} dsn      ${dsnSemSegredo(ambiente.SENTRY_DSN)}`);
  console.log(`${MARCA} ambiente ${ambienteDoSentry()}`);
  console.log(`${MARCA} release  ${ambiente.SENTRY_RELEASE || '<vazio>'}`);

  const idDaMensagem = Sentry.captureMessage(
    `Teste de integração do Sentry — ${new Date().toISOString()}`,
    'info',
  );

  // Uma exceção também, e não só a mensagem: os dois caminhos do SDK são
  // diferentes por dentro, e é o de exceção que importa no dia do incidente.
  const idDaExcecao = Sentry.captureException(
    new Error('Exceção de teste do sentry:teste — não é incidente.'),
  );

  const entregue = await descarregar();
  if (!entregue) {
    console.error(`${MARCA} FALHOU — o flush não confirmou a entrega em 5s.`);
    console.error(`${MARCA} Instância inalcançável, TLS recusado ou quota estourada.`);
    console.error(`${MARCA} A tabela de diagnóstico está em .preator/playbooks/sentry.md`);
    return 1;
  }

  console.log(`${MARCA} enviado  mensagem event_id=${idDaMensagem}`);
  console.log(`${MARCA} enviado  exceção  event_id=${idDaExcecao}`);
  console.log(`${MARCA} veja     ${ondeVer(ambiente.SENTRY_DSN, idDaExcecao)}`);
  return 0;
}

/**
 * `process.exit` explícito, e não `process.exitCode`: o SDK mantém timer
 * próprio no laço de eventos, e um script de diagnóstico que não termina
 * sozinho é um script que ninguém roda duas vezes. O `flush` já confirmou a
 * entrega antes daqui.
 */
async function executar(): Promise<void> {
  let codigo = 1;
  try {
    codigo = await principal();
  } catch (erro: unknown) {
    console.error(`${MARCA} FALHOU — ${erro instanceof Error ? erro.message : String(erro)}`);
  }
  process.exit(codigo);
}

void executar();
