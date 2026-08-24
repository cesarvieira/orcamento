/**
 * SCHEMA — a fonte única do modelo. TypeScript, não uma DSL própria (D-01).
 *
 * As migrations saem DAQUI, geradas por `drizzle-kit generate` e versionadas
 * em `api/drizzle/*.sql`. Nunca escreva SQL de migration à mão: o gate
 * `deploy-fresh` aplica tudo do zero em banco limpo, e é lá que o drift
 * aparece.
 *
 * ⚠️ ESCOPO: a EF-00 é a PLATAFORMA. Aqui vive apenas o mínimo para
 * autenticar — família, membro, identidade, convite, sessão. Nenhuma entidade
 * financeira: contas, categorias, orçamento, lançamentos, faturas e metas são
 * de EF-02 a EF-08 e cada uma acrescenta as suas tabelas a este arquivo.
 *
 * Ao acrescentar entidade financeira, use os tipos de `./tipos.ts`:
 * dinheiro é `dinheiroCentavos` (D-06), e quem tem data tem também
 * competência — duas colunas distintas.
 */
import { relations } from 'drizzle-orm';
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { atualizadoEm, criadoEm } from './tipos';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * O provedor de uma credencial. STRING no banco e no contrato — nunca inteiro:
 * enum inteiro serializado vira número na tela e o gate de contrato reprova.
 */
export const provedorIdentidade = pgEnum('provedor_identidade', [
  'google',
  'senha',
]);

// ---------------------------------------------------------------------------
// Familia — o tenant. Raiz de todo isolamento.
// ---------------------------------------------------------------------------

/**
 * Todo dado do produto pende daqui. Toda tabela dos módulos financeiros terá
 * `familia_id` referenciando esta, e o valor SEMPRE vem do token da sessão,
 * nunca do request (R1 · D-05).
 */
export const familias = pgTable('familias', {
  id: uuid('id').primaryKey().defaultRandom(),
  nome: text('nome').notNull(),
  criadoEm: criadoEm(),
  atualizadoEm: atualizadoEm(),
});

// ---------------------------------------------------------------------------
// Membro — pessoa com login numa família.
// ---------------------------------------------------------------------------

/**
 * Autor imutável de cada lançamento. Todo membro tem o MESMO poder sobre os
 * dados da família: não há papéis, e a ausência deles é a regra (RN-05/EF-01).
 */
export const membros = pgTable(
  'membros',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    familiaId: uuid('familia_id')
      .notNull()
      .references(() => familias.id, { onDelete: 'cascade' }),
    nome: text('nome').notNull(),
    /** Email canônico do membro — é a chave que liga as identidades (RN-04). */
    email: text('email').notNull(),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    uniqueIndex('membros_email_unico').on(t.email),
    index('membros_por_familia').on(t.familiaId),
  ],
);

// ---------------------------------------------------------------------------
// Identidade — credencial de um membro.
// ---------------------------------------------------------------------------

/**
 * Separada de `membros` de propósito: o mesmo email pode chegar por Google e
 * por senha e precisa resolver para A MESMA PESSOA. Guardar o provedor dentro
 * de `membros` obrigaria a duplicar a pessoa por provedor — que é exatamente o
 * furo de RN-04 (EF-01).
 *
 * `segredo` só é preenchido no provedor `senha` (hash scrypt + sal, nunca a
 * senha). No provedor `google` fica nulo: quem guarda a credencial é o Google.
 */
export const identidades = pgTable(
  'identidades',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    membroId: uuid('membro_id')
      .notNull()
      .references(() => membros.id, { onDelete: 'cascade' }),
    provedor: provedorIdentidade('provedor').notNull(),
    /** O email como o provedor o entregou. */
    email: text('email').notNull(),
    /** Com Google vale o email VERIFICADO do provedor, não o que o usuário digitar. */
    emailVerificado: timestamp('email_verificado', { withTimezone: true }),
    segredo: text('segredo'),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    uniqueIndex('identidades_provedor_email_unico').on(t.provedor, t.email),
    index('identidades_por_membro').on(t.membroId),
  ],
);

// ---------------------------------------------------------------------------
// Convite — convite pendente para entrar numa família.
// ---------------------------------------------------------------------------

/**
 * Expira e é de uso único (RN-03/EF-01). O prazo é parâmetro de ambiente
 * (`CONVITE_TTL_HORAS`), não regra — por isso mora no `.env`, não aqui.
 *
 * O fluxo de envio e aceite é da EF-01; a EF-00 só declara a forma.
 */
export const convites = pgTable(
  'convites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    familiaId: uuid('familia_id')
      .notNull()
      .references(() => familias.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    token: text('token').notNull(),
    expiraEm: timestamp('expira_em', { withTimezone: true }).notNull(),
    usadoEm: timestamp('usado_em', { withTimezone: true }),
    criadoEm: criadoEm(),
  },
  (t) => [
    uniqueIndex('convites_token_unico').on(t.token),
    index('convites_por_familia').on(t.familiaId),
  ],
);

// ---------------------------------------------------------------------------
// Sessao — o token. É DELA que sai o familiaId, em toda superfície.
// ---------------------------------------------------------------------------

/**
 * A sessão vive em cookie `httpOnly` porque o render de servidor não enxerga
 * `localStorage` (D-01) — e porque é mais seguro de qualquer forma.
 *
 * `familiaId` está desnormalizado aqui de propósito: é o valor que o
 * middleware de tenant e o handshake do socket leem em toda requisição, e ele
 * precisa vir do token sem uma segunda consulta que alguém possa esquecer.
 */
export const sessoes = pgTable(
  'sessoes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Hash do token do cookie. O token em claro nunca toca o banco. */
    tokenHash: text('token_hash').notNull(),
    membroId: uuid('membro_id')
      .notNull()
      .references(() => membros.id, { onDelete: 'cascade' }),
    familiaId: uuid('familia_id')
      .notNull()
      .references(() => familias.id, { onDelete: 'cascade' }),
    expiraEm: timestamp('expira_em', { withTimezone: true }).notNull(),
    encerradaEm: timestamp('encerrada_em', { withTimezone: true }),
    criadoEm: criadoEm(),
  },
  (t) => [
    uniqueIndex('sessoes_token_unico').on(t.tokenHash),
    index('sessoes_por_membro').on(t.membroId),
  ],
);

// ---------------------------------------------------------------------------
// Relações
// ---------------------------------------------------------------------------

export const familiasRelacoes = relations(familias, ({ many }) => ({
  membros: many(membros),
  convites: many(convites),
}));

export const membrosRelacoes = relations(membros, ({ one, many }) => ({
  familia: one(familias, {
    fields: [membros.familiaId],
    references: [familias.id],
  }),
  identidades: many(identidades),
  sessoes: many(sessoes),
}));

export const identidadesRelacoes = relations(identidades, ({ one }) => ({
  membro: one(membros, {
    fields: [identidades.membroId],
    references: [membros.id],
  }),
}));

export const convitesRelacoes = relations(convites, ({ one }) => ({
  familia: one(familias, {
    fields: [convites.familiaId],
    references: [familias.id],
  }),
}));

export const sessoesRelacoes = relations(sessoes, ({ one }) => ({
  membro: one(membros, {
    fields: [sessoes.membroId],
    references: [membros.id],
  }),
  familia: one(familias, {
    fields: [sessoes.familiaId],
    references: [familias.id],
  }),
}));

export type Familia = typeof familias.$inferSelect;
export type Membro = typeof membros.$inferSelect;
export type Identidade = typeof identidades.$inferSelect;
export type Convite = typeof convites.$inferSelect;
export type Sessao = typeof sessoes.$inferSelect;
