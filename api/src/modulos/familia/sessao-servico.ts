/**
 * O serviço de sessão. É a ÚNICA origem de `familiaId` em toda a aplicação.
 *
 * REGRA R1 (D-05): o `familiaId` vem do token, nunca do request. Quem quiser
 * saber de que família é a requisição chama `resolverSessao` (HTTP) ou
 * `resolverSessaoPorToken` (handshake do socket) — e não existe caminho que
 * aceite o valor vindo do cliente.
 */
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

import { and, eq, gt, isNull } from 'drizzle-orm';

import { ambiente } from '../../config/ambiente';
import type { Db } from '../../db';
import { familias, membros, sessoes } from '../../db/schema';

/** O nome do cookie `httpOnly` que carrega a sessão. */
export const COOKIE_SESSAO = 'orcamento_sessao';

/**
 * O que uma requisição autenticada sabe sobre si. É o único objeto de onde o
 * resto do sistema pode ler `familiaId`.
 */
export interface ContextoDaSessao {
  sessaoId: string;
  membroId: string;
  familiaId: string;
  membroNome: string;
  membroEmail: string;
  familiaNome: string;
}

/**
 * O token em claro nunca toca o banco: guardamos o HMAC dele. Vazamento de
 * dump de banco não vira sessão válida.
 */
function hashDoToken(token: string): string {
  return createHmac('sha256', ambiente.SESSAO_SEGREDO).update(token).digest('hex');
}

/**
 * O token do cookie de sessão: 32 bytes de aleatoriedade real.
 *
 * Já foi compartilhado com o convite, quando o convite também viajava como
 * segredo longo. Desde RN-10 o convite é um código de 6 dígitos digitado
 * (`gerarCodigo`, abaixo) e os dois não têm mais nada em comum além do nome —
 * este aqui é inadivinhável por construção; aquele depende do teto de
 * tentativas para ser seguro.
 */
function gerarToken(): string {
  return randomBytes(32).toString('base64url');
}

export interface SessaoCriada {
  token: string;
  expiraEm: Date;
  contexto: ContextoDaSessao;
}

export async function abrirSessao(
  db: Db,
  membroId: string,
): Promise<SessaoCriada> {
  const [membro] = await db
    .select({
      id: membros.id,
      nome: membros.nome,
      email: membros.email,
      familiaId: membros.familiaId,
      familiaNome: familias.nome,
    })
    .from(membros)
    .innerJoin(familias, eq(familias.id, membros.familiaId))
    .where(eq(membros.id, membroId))
    .limit(1);

  if (!membro) throw new Error(`membro inexistente: ${membroId}`);

  const token = gerarToken();
  const expiraEm = new Date(Date.now() + ambiente.SESSAO_TTL_HORAS * 3600_000);

  const [linha] = await db
    .insert(sessoes)
    .values({
      tokenHash: hashDoToken(token),
      membroId: membro.id,
      // Desnormalizado a partir do MEMBRO, não de nada que o cliente mandou.
      familiaId: membro.familiaId,
      expiraEm,
    })
    .returning({ id: sessoes.id });

  if (!linha) throw new Error('falha ao abrir sessão');

  return {
    token,
    expiraEm,
    contexto: {
      sessaoId: linha.id,
      membroId: membro.id,
      familiaId: membro.familiaId,
      membroNome: membro.nome,
      membroEmail: membro.email,
      familiaNome: membro.familiaNome,
    },
  };
}

/**
 * Traduz um token de cookie no contexto da sessão. Retorna `null` quando o
 * token não existe, expirou ou foi encerrado — nunca lança por token ruim.
 */
export async function resolverSessaoPorToken(
  db: Db,
  token: string | undefined | null,
): Promise<ContextoDaSessao | null> {
  if (!token) return null;

  const alvo = hashDoToken(token);

  const [linha] = await db
    .select({
      sessaoId: sessoes.id,
      tokenHash: sessoes.tokenHash,
      membroId: membros.id,
      membroNome: membros.nome,
      membroEmail: membros.email,
      familiaId: familias.id,
      familiaNome: familias.nome,
    })
    .from(sessoes)
    .innerJoin(membros, eq(membros.id, sessoes.membroId))
    .innerJoin(familias, eq(familias.id, sessoes.familiaId))
    .where(
      and(
        eq(sessoes.tokenHash, alvo),
        isNull(sessoes.encerradaEm),
        gt(sessoes.expiraEm, new Date()),
      ),
    )
    .limit(1);

  if (!linha) return null;

  // Confirmação em tempo constante — o índice já fez a busca por igualdade,
  // esta comparação existe para não abrir canal lateral no caminho quente.
  const a = Buffer.from(linha.tokenHash);
  const b = Buffer.from(alvo);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return {
    sessaoId: linha.sessaoId,
    membroId: linha.membroId,
    familiaId: linha.familiaId,
    membroNome: linha.membroNome,
    membroEmail: linha.membroEmail,
    familiaNome: linha.familiaNome,
  };
}

export async function encerrarSessao(db: Db, sessaoId: string): Promise<void> {
  await db
    .update(sessoes)
    .set({ encerradaEm: new Date() })
    .where(eq(sessoes.id, sessaoId));
}

/**
 * RN-14 — derruba TODA sessão daquele membro, em todo dispositivo. É o que
 * separa "esqueci a senha" de "tomaram minha conta": sem isto, quem tivesse
 * entrado indevidamente continuaria dentro depois da troca, e a recuperação
 * seria teatro.
 *
 * Só mexe nas ainda abertas — reescrever `encerradaEm` de uma sessão já
 * encerrada falsificaria quando ela acabou.
 */
export async function encerrarSessoesDoMembro(db: Db, membroId: string): Promise<void> {
  await db
    .update(sessoes)
    .set({ encerradaEm: new Date() })
    .where(and(eq(sessoes.membroId, membroId), isNull(sessoes.encerradaEm)));
}

/** As opções do cookie. `httpOnly` é exigência do SSR e de segurança (D-01). */
export function opcoesDoCookie(expiraEm: Date) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: ambiente.NODE_ENV === 'production' && ambiente.ORIGEM_WEB.startsWith('https://'),
    path: '/',
    expires: expiraEm,
  };
}

/**
 * O CÓDIGO de 6 dígitos que vai por email (RN-10) — convite e confirmação.
 *
 * `randomInt` do `node:crypto`, não `Math.random`: o segundo é previsível e
 * aqui o que está atrás do código é a conta de uma família.
 *
 * Seis dígitos são ~1 milhão de combinações, o que só é seguro porque RN-11
 * limita as tentativas. Quem trocar isto por algo menor, ou remover o teto,
 * devolve a força bruta ao jogo.
 */
export function gerarCodigo(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** RN-11 — quantos erros um código tolera antes de ser invalidado. */
export const TENTATIVAS_MAXIMAS = 5;
