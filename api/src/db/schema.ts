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
import { relations, sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { atualizadoEm, criadoEm, dinheiroCentavos } from './tipos';

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

/**
 * O tipo de uma conta (EF-02 §1). STRING no banco e no contrato, mesmo motivo
 * de `provedorIdentidade` acima: enum inteiro serializado vira número na tela
 * e o gate de contrato reprova.
 */
export const tipoConta = pgEnum('tipo_conta', ['DEBITO', 'CREDITO', 'RESERVA']);

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
  t => [
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
    /**
     * O CÓDIGO de 6 dígitos que confirma o cadastro (RN-06/RN-09/RN-10). Nulo
     * em toda identidade que já nasceu confirmada — Google, que traz o email
     * verificado do provedor, e quem entrou por convite, cujo email o próprio
     * convite já provou.
     *
     * Sem índice único, e isso é deliberado: 6 dígitos colidem entre linhas
     * diferentes. Quem valida busca por EMAIL + código, nunca só pelo código.
     *
     * Fica aqui, e não em tabela própria, porque o que se confirma É a
     * identidade: um estado dela, não uma entidade nova.
     */
    tokenConfirmacao: text('token_confirmacao'),
    confirmacaoExpiraEm: timestamp('confirmacao_expira_em', { withTimezone: true }),
    /**
     * RN-11 — erros acumulados neste código. Ao chegar no teto, o código é
     * invalidado. É o ÚNICO obstáculo à força bruta desde que o token virou
     * 6 dígitos (RN-10): sem ele, ~1 milhão de combinações caem em segundos.
     */
    tentativasConfirmacao: integer('tentativas_confirmacao').notNull().default(0),
    /**
     * O CÓDIGO de 6 dígitos que troca a senha esquecida (RN-12). Mora aqui
     * pelo mesmo motivo que `tokenConfirmacao`: o que se recupera É o segredo
     * DESTA identidade — um estado dela, não uma entidade nova.
     *
     * Só o provedor `senha` chega a ter um. Numa identidade `google` a coluna
     * fica sempre nula: não há segredo nosso a trocar (RN-15 resolve isso
     * criando a identidade de senha, não recuperando a do Google).
     *
     * Sem índice único, como os outros códigos: 6 dígitos colidem entre
     * linhas, e quem valida busca por EMAIL + código.
     */
    tokenRecuperacao: text('token_recuperacao'),
    recuperacaoExpiraEm: timestamp('recuperacao_expira_em', { withTimezone: true }),
    /** RN-11 aplicada à recuperação — ver o comentário gêmeo acima. */
    tentativasRecuperacao: integer('tentativas_recuperacao').notNull().default(0),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  t => [
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
    /** O CÓDIGO de 6 dígitos (RN-10). Sem índice único: colide entre linhas. */
    token: text('token').notNull(),
    expiraEm: timestamp('expira_em', { withTimezone: true }).notNull(),
    usadoEm: timestamp('usado_em', { withTimezone: true }),
    /**
     * Quando o convidado RECUSOU (RN-08). Separado de `usadoEm` de propósito:
     * os dois encerram o convite, mas só a recusa libera aquele email para
     * criar a própria família — e quem lê a tabela depois precisa distinguir
     * "entrou" de "não quis".
     */
    recusadoEm: timestamp('recusado_em', { withTimezone: true }),
    /** RN-11 — ver o comentário gêmeo em `identidades`. */
    tentativas: integer('tentativas').notNull().default(0),
    criadoEm: criadoEm(),
  },
  t => [
    index('convites_por_familia').on(t.familiaId),
    index('convites_por_email').on(t.email),
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
  t => [
    uniqueIndex('sessoes_token_unico').on(t.tokenHash),
    index('sessoes_por_membro').on(t.membroId),
  ],
);

// ---------------------------------------------------------------------------
// Conta — onde o dinheiro está (EF-02). DEBITO · CREDITO · RESERVA.
// ---------------------------------------------------------------------------

/**
 * O saldo NÃO mora aqui: é derivado na leitura como `saldoInicialCentavos +
 * Σ lançamentos da conta` (EF-02 §1). Materializar saldo em coluna criaria uma
 * segunda verdade que diverge no primeiro lançamento retroativo — por isso não
 * existe `saldo_centavos` nesta tabela, e não é omissão.
 *
 * Os quatro CHECKs abaixo impõem RN-08 e a regra "campo só existe no tipo
 * certo" (EF-02 §1) no próprio banco — a validação Zod (`modulos/contas/esquemas.ts`)
 * impõe a mesma regra na borda, antes de a escrita sequer tentar o banco.
 */
export const contas = pgTable(
  'contas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Todo dado do produto pende da família (R1). Vem sempre do token. */
    familiaId: uuid('familia_id')
      .notNull()
      .references(() => familias.id, { onDelete: 'cascade' }),
    tipo: tipoConta('tipo').notNull(),
    nome: text('nome').notNull(),
    icone: text('icone').notNull(),
    cor: text('cor').notNull(),
    /** Só `DEBITO`/`RESERVA` (EF-02 §1); nulo em `CREDITO`. */
    saldoInicialCentavos: dinheiroCentavos('saldo_inicial_centavos'),
    /** Só `CREDITO` (EF-02 §1); nulo em `DEBITO`/`RESERVA`. */
    limiteCentavos: dinheiroCentavos('limite_centavos'),
    /** RN-08 — só `CREDITO`, 1–28 (dia 29–31 não existe em todo mês). */
    diaFechamento: integer('dia_fechamento'),
    /** RN-08 — só `CREDITO`, 1–28. */
    diaVencimento: integer('dia_vencimento'),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  t => [
    index('contas_por_familia').on(t.familiaId),
    // RN-08 — a faixa vale só quando o campo está presente; ausência (NULL) é
    // legítima em DEBITO/RESERVA e é outro CHECK, abaixo, que garante isso.
    check(
      'contas_dia_fechamento_intervalo',
      sql`${t.diaFechamento} is null or (${t.diaFechamento} between 1 and 28)`,
    ),
    check(
      'contas_dia_vencimento_intervalo',
      sql`${t.diaVencimento} is null or (${t.diaVencimento} between 1 and 28)`,
    ),
    // RN-08 + EF-02 §1 — fechamento, vencimento e limite só existem em CREDITO.
    check(
      'contas_campos_de_credito_apenas_em_credito',
      sql`${t.tipo} = 'CREDITO' or (${t.limiteCentavos} is null and ${t.diaFechamento} is null and ${t.diaVencimento} is null)`,
    ),
    // EF-02 §1 — saldo inicial só existe em DEBITO/RESERVA, nunca em CREDITO.
    check(
      'contas_saldo_inicial_nao_em_credito',
      sql`${t.tipo} <> 'CREDITO' or ${t.saldoInicialCentavos} is null`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Relações
// ---------------------------------------------------------------------------

export const familiasRelacoes = relations(familias, ({ many }) => ({
  membros: many(membros),
  convites: many(convites),
  contas: many(contas),
}));

export const contasRelacoes = relations(contas, ({ one }) => ({
  familia: one(familias, {
    fields: [contas.familiaId],
    references: [familias.id],
  }),
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
export type Conta = typeof contas.$inferSelect;
export type NovaContaDb = typeof contas.$inferInsert;
