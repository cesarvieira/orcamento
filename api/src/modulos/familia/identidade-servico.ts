/**
 * RN-44 (EF-01) — mesmo email via Google e via senha é a MESMA pessoa.
 *
 * `Identidade` é separada de `Membro` de propósito (ver comentário do schema):
 * o mesmo email pode chegar por dois provedores, e os dois precisam resolver
 * para UM SÓ `Membro`. Este arquivo é o único lugar que decide isso — quem
 * cria `Identidade` fora daqui reabre o furo que RN-44 fecha.
 *
 * Uma função só, duas fachadas com escopo deliberadamente diferente:
 *   - `resolverMembroExistente` — login. NUNCA cria família nem pessoa. Sem
 *     conta prévia (nenhuma `Identidade` no provedor, nenhum `Membro` com o
 *     email) não há o que resolver — D-05 não admite autocadastro livre, e
 *     login não é convite.
 *   - `resolverOuCriarMembroDaFamilia` — aceite de convite. A `familiaId` já
 *     é conhecida (a do convite), e criar um `Membro` novo é exatamente o
 *     comportamento esperado quando ninguém com aquele email existia ainda.
 */
import { and, eq } from 'drizzle-orm';

import type { Db } from '../../db';
import { identidades, membros } from '../../db/schema';
import type { Membro } from '../../db/schema';

type Provedor = 'google' | 'senha';

export interface DadosDeIdentidade {
  email: string;
  provedor: Provedor;
  emailVerificado: boolean;
  nome: string;
  /** Só preenchido no provedor `senha` — hash, nunca a senha em claro. */
  segredo?: string | null;
}

/** Erro de negócio da resolução de identidade — não é exceção de infra. */
export class ErroDeIdentidade extends Error {
  constructor(
    public readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ErroDeIdentidade';
  }
}

async function identidadePorProvedorEEmail(db: Db, provedor: Provedor, email: string) {
  const [linha] = await db
    .select()
    .from(identidades)
    .where(and(eq(identidades.provedor, provedor), eq(identidades.email, email)))
    .limit(1);
  return linha ?? null;
}

async function membroPorEmail(db: Db, email: string): Promise<Membro | null> {
  const [linha] = await db.select().from(membros).where(eq(membros.email, email)).limit(1);
  return linha ?? null;
}

async function vincularIdentidade(db: Db, membroId: string, dados: DadosDeIdentidade): Promise<void> {
  await db.insert(identidades).values({
    membroId,
    provedor: dados.provedor,
    email: dados.email,
    emailVerificado: dados.emailVerificado ? new Date() : null,
    segredo: dados.segredo ?? null,
  });
}

/**
 * O núcleo de RN-44. `familiaIdParaCriar` decide se um `Membro` novo pode
 * nascer aqui: `null` para login (nunca cria), um id para aceite de convite
 * (cria dentro DAQUELA família quando ninguém com o email existia).
 */
async function resolver(
  db: Db,
  dados: DadosDeIdentidade,
  familiaIdParaCriar: string | null,
): Promise<Membro | null> {
  const identidadeExistente = await identidadePorProvedorEEmail(db, dados.provedor, dados.email);

  const membroExistente = identidadeExistente
    ? ((await db.select().from(membros).where(eq(membros.id, identidadeExistente.membroId)).limit(1))[0] ?? null)
    : await membroPorEmail(db, dados.email);

  if (membroExistente) {
    if (familiaIdParaCriar && membroExistente.familiaId !== familiaIdParaCriar) {
      throw new ErroDeIdentidade(
        'membro_de_outra_familia',
        'Este email já pertence a uma pessoa de outra família.',
      );
    }
    // RN-44: o provedor É NOVO para esta pessoa (achamos o Membro por outro
    // caminho) — vincula em vez de duplicar.
    if (!identidadeExistente) {
      await vincularIdentidade(db, membroExistente.id, dados);
    }
    return membroExistente;
  }

  if (!familiaIdParaCriar) return null;

  const [novo] = await db
    .insert(membros)
    .values({ familiaId: familiaIdParaCriar, nome: dados.nome, email: dados.email })
    .returning();
  if (!novo) throw new Error('não consegui criar o membro ao aceitar convite');

  await vincularIdentidade(db, novo.id, dados);
  return novo;
}

/** Login (Google ou senha): resolve para um `Membro` JÁ EXISTENTE, ou `null`. */
export async function resolverMembroExistente(
  db: Db,
  dados: DadosDeIdentidade,
): Promise<Membro | null> {
  return resolver(db, dados, null);
}

/** Aceite de convite: resolve para o `Membro` existente OU cria um, na família do convite. */
export async function resolverOuCriarMembroDaFamilia(
  db: Db,
  familiaId: string,
  dados: DadosDeIdentidade,
): Promise<Membro> {
  const membro = await resolver(db, dados, familiaId);
  if (!membro) throw new Error('resolver() com familiaId nunca deveria devolver null');
  return membro;
}
