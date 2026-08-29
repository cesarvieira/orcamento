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

import {
  atualizadoEm,
  competencia as colunaCompetencia,
  criadoEm,
  dataDoFato,
  dinheiroCentavos,
} from './tipos';

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

/**
 * O tipo de um lançamento (EF-04 §1). STRING no banco e no contrato, mesmo
 * motivo de `tipoConta` acima.
 *
 * TIPO EXPLÍCITO, NÃO SINAL: o protótipo representa receita como valor
 * negativo com categoria nula — funciona para somar e falha para relatar,
 * filtrar e validar, e torna `TRANSFERENCIA` inexprimível (EF-04 §1/§4).
 */
export const tipoLancamento = pgEnum('tipo_lancamento', [
  'RECEITA',
  'DESPESA',
  'TRANSFERENCIA',
]);

/**
 * O estado do ciclo de uma fatura (EF-05 §1). STRING no banco e no contrato,
 * mesmo motivo de `tipoConta` acima.
 *
 * ⚠️ CUIDADO DE NOMENCLATURA (D1, `.preator/skills/negocio/faturas-e-ciclo-do-cartao/SKILL.md`):
 * este enum NÃO é sinônimo do termo de negócio "fatura em aberto". Uma fatura
 * `FECHADA` (aguardando pagamento) TAMBÉM está "em aberto" no sentido do
 * produto — só `PAGA` sai da soma de RN-25/RN-26. Ver
 * `modulos/faturas/dominio.ts#statusDoCiclo` e `modulos/faturas/servico.ts`.
 */
export const statusFatura = pgEnum('status_fatura', ['ABERTA', 'FECHADA', 'PAGA']);

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
// Categoria — envelope de gasto (EF-03 §1). SEM VALOR: o teto NÃO é atributo
// desta tabela, é do par categoria × competência (`orcamentosMes`, abaixo).
// ---------------------------------------------------------------------------

/**
 * ⛔ RN-09: se o teto fosse coluna aqui, remanejar em agosto mudaria setembro
 * também, e o histórico de agosto seria reescrito toda vez que alguém
 * ajustasse o mês seguinte — é o único ponto do mockup que, copiado, quebra o
 * produto (EF-03 §1/§4). Por isso `Categoria` só guarda nome, ícone e cor.
 */
export const categorias = pgTable(
  'categorias',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Todo dado do produto pende da família (R1). Vem sempre do token. */
    familiaId: uuid('familia_id')
      .notNull()
      .references(() => familias.id, { onDelete: 'cascade' }),
    nome: text('nome').notNull(),
    icone: text('icone').notNull(),
    cor: text('cor').notNull(),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  t => [index('categorias_por_familia').on(t.familiaId)],
);

// ---------------------------------------------------------------------------
// OrcamentoMes — categoria × competência × teto (EF-03 §1). A tabela que
// torna o remanejo mensal possível: mexer no teto de agosto não toca a linha
// de setembro, porque são LINHAS DIFERENTES desta tabela.
// ---------------------------------------------------------------------------

/**
 * RN-40 — categoria sem linha aqui, NA COMPETÊNCIA lida, lê como teto ZERO.
 * Não é omissão: a leitura da competência faz LEFT JOIN e usa
 * `coalesce(teto_centavos, 0)` (`modulos/orcamento/servico.ts`) — por isso
 * não existe (nem faz falta) um valor default na coluna.
 *
 * `tetoCentavos` PODE ficar negativo (RN-14: sem categoria com sobra para
 * financiar o remanejamento, o app oferece deixar o destino negativo em vez
 * de recusar) — por isso, ao contrário de `contas.saldoInicialCentavos`, não
 * há CHECK de não-negatividade nesta coluna.
 */
export const orcamentosMes = pgTable(
  'orcamentos_mes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    familiaId: uuid('familia_id')
      .notNull()
      .references(() => familias.id, { onDelete: 'cascade' }),
    categoriaId: uuid('categoria_id')
      .notNull()
      .references(() => categorias.id, { onDelete: 'cascade' }),
    /** `AAAA-MM` (EF-03 §1). Junto de `categoriaId` forma a chave do teto. */
    competencia: colunaCompetencia('competencia').notNull(),
    tetoCentavos: dinheiroCentavos('teto_centavos').notNull(),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  t => [
    // RN-09 — um teto só por categoria×competência; é este índice que faz o
    // upsert de `definirTeto`/`criarRemanejamento` (servico.ts) ser seguro.
    uniqueIndex('orcamentos_mes_categoria_competencia_unico').on(
      t.categoriaId,
      t.competencia,
    ),
    index('orcamentos_mes_por_familia_competencia').on(t.familiaId, t.competencia),
  ],
);

// ---------------------------------------------------------------------------
// Remanejamento — histórico de quem moveu teto entre categorias (EF-03 §1).
// RN-13: altera só a competência corrente, e registra o autor.
// ---------------------------------------------------------------------------

export const remanejamentos = pgTable(
  'remanejamentos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    familiaId: uuid('familia_id')
      .notNull()
      .references(() => familias.id, { onDelete: 'cascade' }),
    competencia: colunaCompetencia('competencia').notNull(),
    categoriaOrigemId: uuid('categoria_origem_id')
      .notNull()
      .references(() => categorias.id, { onDelete: 'cascade' }),
    categoriaDestinoId: uuid('categoria_destino_id')
      .notNull()
      .references(() => categorias.id, { onDelete: 'cascade' }),
    valorCentavos: dinheiroCentavos('valor_centavos').notNull(),
    /** RN-13 — o autor, e é imutável: nunca se atualiza esta linha. */
    autorMembroId: uuid('autor_membro_id')
      .notNull()
      .references(() => membros.id),
    criadoEm: criadoEm(),
  },
  t => [
    index('remanejamentos_por_familia_competencia').on(t.familiaId, t.competencia),
    // Defesa em profundidade — a mesma validação já vive no Zod da rota
    // (`modulos/orcamento/esquemas.ts`): valor precisa ser positivo, e mover
    // teto de uma categoria para ELA MESMA não é remanejamento nenhum.
    check('remanejamentos_valor_positivo', sql`${t.valorCentavos} > 0`),
    check(
      'remanejamentos_origem_diferente_destino',
      sql`${t.categoriaOrigemId} <> ${t.categoriaDestinoId}`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Competencia — hoje existe só para guardar `RendaPrevista` (EF-03 §1),
// atributo da competência, não da categoria. Uma linha por família×mês;
// ausência de linha lê como renda prevista ZERO (mesmo espírito de RN-40:
// nenhuma RN exige outro default, e RN-12 já garante que renda prevista não
// entra na fórmula de teto nenhum — só é referência de planejamento).
// ---------------------------------------------------------------------------

export const competencias = pgTable(
  'competencias',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    familiaId: uuid('familia_id')
      .notNull()
      .references(() => familias.id, { onDelete: 'cascade' }),
    competencia: colunaCompetencia('competencia').notNull(),
    rendaPrevistaCentavos: dinheiroCentavos('renda_prevista_centavos').notNull().default(0),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  t => [
    uniqueIndex('competencias_familia_competencia_unico').on(t.familiaId, t.competencia),
  ],
);

// ---------------------------------------------------------------------------
// SerieParcelas — agrupa as N parcelas de uma compra parcelada (EF-04 §1).
// Guarda `totalCentavos`/`quantidade` da COMPRA ORIGINAL.
// ---------------------------------------------------------------------------

/**
 * Suposição declarada pelo condutor (issue #52, fork 1): `totalCentavos` e
 * `quantidade` são a compra ORIGINAL e NUNCA são reescritos por exclusão de
 * parcela — mesmo motivo de `lancamentos.criadoPorMembroId` ser imutável
 * (RN-16). RN-21 (soma == total) vale na GERAÇÃO da série
 * (`modulos/lancamentos/dominio.ts`), não depois: excluir parcelas (`esta` ·
 * `todas` · `a partir desta`) não é obrigado a manter essa igualdade, porque
 * o total guardado é o da compra, não da série remanescente.
 *
 * `quantidade` mínima é 2: quantidade 1 não é parcelamento — é um
 * `Lancamento` avulso, sem `SerieParcelas` (RN-20 fala em "até 48×", nunca em
 * "1×").
 */
export const seriesParcelas = pgTable(
  'series_parcelas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Todo dado do produto pende da família (R1). Vem sempre do token. */
    familiaId: uuid('familia_id')
      .notNull()
      .references(() => familias.id, { onDelete: 'cascade' }),
    totalCentavos: dinheiroCentavos('total_centavos').notNull(),
    quantidade: integer('quantidade').notNull(),
    criadoEm: criadoEm(),
  },
  t => [
    index('series_parcelas_por_familia').on(t.familiaId),
    check('series_parcelas_total_positivo', sql`${t.totalCentavos} > 0`),
    // RN-20 — até 48×; mínimo 2 (ver comentário acima sobre por que 1 não é série).
    check('series_parcelas_quantidade_intervalo', sql`${t.quantidade} between 2 and 48`),
  ],
);

// ---------------------------------------------------------------------------
// Lancamento — um movimento (EF-04 §1). RECEITA · DESPESA · TRANSFERENCIA.
// ---------------------------------------------------------------------------

/**
 * `data` (quando aconteceu) e `competencia` (que mês de orçamento consome)
 * são colunas DISTINTAS de propósito (RN-15) — `competencia` é calculada na
 * escrita a partir de `data` (`modulos/lancamentos/dominio.ts`), nunca
 * derivada na leitura.
 *
 * Os CHECKs abaixo impõem no banco a mesma forma que o Zod
 * (`modulos/lancamentos/esquemas.ts`) já impõe na borda: `categoriaId` só em
 * `DESPESA`; `contaDestinoId` só em `TRANSFERENCIA`, e nunca igual a
 * `contaId` (fork 3 da issue #52 trata isto TAMBÉM na entrada, com 400 — este
 * CHECK é defesa em profundidade, mesmo padrão de
 * `remanejamentos_origem_diferente_destino`).
 *
 * `criadoPorMembroId` é imutável (RN-16): nunca há UPDATE nesta tabela, só
 * INSERT e DELETE — por isso não há `atualizadoEm`, mesmo padrão de
 * `remanejamentos`.
 */
export const lancamentos = pgTable(
  'lancamentos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Todo dado do produto pende da família (R1). Vem sempre do token. */
    familiaId: uuid('familia_id')
      .notNull()
      .references(() => familias.id, { onDelete: 'cascade' }),
    tipo: tipoLancamento('tipo').notNull(),
    descricao: text('descricao').notNull(),
    valorCentavos: dinheiroCentavos('valor_centavos').notNull(),
    data: dataDoFato('data').notNull(),
    /** `AAAA-MM` — calculada na escrita a partir de `data` (RN-15/RN-18). */
    competencia: colunaCompetencia('competencia').notNull(),
    /** Obrigatório em `DESPESA`; nulo em `RECEITA`/`TRANSFERENCIA` (EF-04 §1). */
    categoriaId: uuid('categoria_id').references(() => categorias.id, { onDelete: 'cascade' }),
    /** A conta afetada — origem, em `TRANSFERENCIA`. */
    contaId: uuid('conta_id')
      .notNull()
      .references(() => contas.id, { onDelete: 'cascade' }),
    /** Só em `TRANSFERENCIA` (EF-04 §1); nulo em `RECEITA`/`DESPESA`. */
    contaDestinoId: uuid('conta_destino_id').references(() => contas.id, { onDelete: 'cascade' }),
    /** RN-16 — imutável: nunca atualizado depois do INSERT. */
    criadoPorMembroId: uuid('criado_por_membro_id')
      .notNull()
      .references(() => membros.id),
    /** Nulo quando o lançamento não é parcela de nada (RN-20/RN-21). */
    serieParcelaId: uuid('serie_parcela_id').references(() => seriesParcelas.id, {
      onDelete: 'cascade',
    }),
    /** 1-baseado; nulo quando `serieParcelaId` é nulo. */
    numeroParcela: integer('numero_parcela'),
    criadoEm: criadoEm(),
  },
  t => [
    index('lancamentos_por_familia_competencia').on(t.familiaId, t.competencia),
    index('lancamentos_por_conta').on(t.contaId),
    index('lancamentos_por_categoria_competencia').on(t.categoriaId, t.competencia),
    index('lancamentos_por_serie').on(t.serieParcelaId),
    check('lancamentos_valor_positivo', sql`${t.valorCentavos} > 0`),
    check(
      'lancamentos_categoria_somente_em_despesa',
      sql`(${t.tipo} = 'DESPESA' and ${t.categoriaId} is not null) or (${t.tipo} <> 'DESPESA' and ${t.categoriaId} is null)`,
    ),
    check(
      'lancamentos_conta_destino_somente_em_transferencia',
      sql`(${t.tipo} = 'TRANSFERENCIA' and ${t.contaDestinoId} is not null) or (${t.tipo} <> 'TRANSFERENCIA' and ${t.contaDestinoId} is null)`,
    ),
    check(
      'lancamentos_conta_destino_diferente_da_origem',
      sql`${t.contaDestinoId} is null or ${t.contaDestinoId} <> ${t.contaId}`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Fatura — cartão × ciclo (EF-05 §1). RN-23 (ciclo de fechamento) · RN-24
// (pagar é transferência) · RN-25/RN-26 (fatura em aberto, D1).
// ---------------------------------------------------------------------------

/**
 * NÃO guarda total: o total de uma fatura é sempre a soma, na leitura, dos
 * lançamentos `DESPESA` da conta cujo ciclo (RN-23) cai em
 * `[abreEm, fechaEm]` (`modulos/faturas/servico.ts`) — materializar o total
 * criaria uma segunda verdade que diverge se um lançamento daquele ciclo for
 * excluído depois de a fatura fechar. `abreEm`/`fechaEm`/`venceEm` SÃO
 * persistidos porque são a identidade do ciclo em si (a mecânica de RN-23),
 * não um valor derivável de outra coluna sem prática de mercado, e servem de
 * limite para a soma acima.
 *
 * Uma linha só existe quando o ciclo foi de fato materializado — na leitura,
 * por `modulos/faturas/servico.ts#garantirFaturaDoCiclo` (find-or-create de
 * UM ciclo). `listarFaturasDoCartao` chama essa função uma vez para o ciclo
 * CORRENTE (sempre) e uma vez para cada ciclo JÁ FECHADO que tem despesa e
 * ainda não tem linha (encontrados varrendo `lancamentos` da conta). Não
 * existe uma linha por ciclo desde a criação do cartão — seria trabalho
 * antecipado sem uso, e o índice único (contaId, fechaEm) mais o
 * find-or-create tornam a criação tardia segura.
 *
 * O CHECK abaixo é a mesma forma de `contas_campos_de_credito_apenas_em_credito`:
 * os três campos de pagamento (status/pagaEm/pagaComContaId) só coexistem
 * quando `status = 'PAGA'` — RN-24 nunca deixa a fatura "meio paga".
 */
export const faturas = pgTable(
  'faturas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Todo dado do produto pende da família (R1). Vem sempre do token. */
    familiaId: uuid('familia_id')
      .notNull()
      .references(() => familias.id, { onDelete: 'cascade' }),
    /** O cartão (uma `Conta` do tipo `CREDITO`) dono deste ciclo. */
    contaId: uuid('conta_id')
      .notNull()
      .references(() => contas.id, { onDelete: 'cascade' }),
    /** Primeiro dia do ciclo — dia seguinte ao `fechaEm` do ciclo anterior do mesmo cartão. */
    abreEm: dataDoFato('abre_em').notNull(),
    /** RN-23 — dia em que o ciclo encerra; a IDENTIDADE do ciclo (com `contaId`). */
    fechaEm: dataDoFato('fecha_em').notNull(),
    /** Primeira ocorrência de `diaVencimento` estritamente depois de `fechaEm`. */
    venceEm: dataDoFato('vence_em').notNull(),
    /** ⚠️ NÃO confundir com o termo de negócio "fatura em aberto" (D1) — ver o enum acima. */
    status: statusFatura('status').notNull().default('ABERTA'),
    /** RN-24 — só preenchido quando `status = 'PAGA'`. */
    pagaEm: timestamp('paga_em', { withTimezone: true }),
    /** RN-24/D3 — a conta ESCOLHIDA PELO USUÁRIO no pedido de pagamento; nunca a primeira de débito. */
    pagaComContaId: uuid('paga_com_conta_id').references(() => contas.id),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  t => [
    // A identidade de um ciclo é (cartão, fechaEm) — encontra-la-ou-cria-la
    // (`servico.ts`) depende deste índice para ser seguro sob concorrência.
    uniqueIndex('faturas_conta_fecha_em_unico').on(t.contaId, t.fechaEm),
    index('faturas_por_familia').on(t.familiaId),
    index('faturas_por_conta').on(t.contaId),
    check(
      'faturas_pagamento_completo_ou_ausente',
      sql`(${t.status} = 'PAGA' and ${t.pagaEm} is not null and ${t.pagaComContaId} is not null)
          or (${t.status} <> 'PAGA' and ${t.pagaEm} is null and ${t.pagaComContaId} is null)`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Meta — cofrinho de poupança (EF-07 §1). Alvo + conta RESERVA própria, 1:1.
// ---------------------------------------------------------------------------

/**
 * ⛔ Regra #0: `.preator/skills/negocio/metas-e-reservas/SKILL.md` — glossário
 * ("Cofrinho (= Meta)", "Acumulado", "Conta RESERVA do cofrinho") e decisão
 * D3, citando `docs/especificacoes/EF-07-metas.md` §1 como fonte primária.
 *
 * O ACUMULADO NÃO mora aqui: é a soma, na leitura, das transferências
 * (`TRANSFERENCIA`) cujo `contaDestinoId` é a conta `RESERVA` vinculada
 * (`modulos/metas/servico.ts`) — materializar um `atual` criaria a segunda
 * verdade que o produto evita em toda entidade derivada (mesmo motivo de
 * saldo de conta e de lastro).
 *
 * D3 — cada cofrinho tem a PRÓPRIA conta `RESERVA`, criada junto (saldo
 * inicial 0), em vínculo 1:1 ÚNICO — por isso `contaReservaId` carrega
 * `uniqueIndex` abaixo; sem essa restrição, duas metas apontando para a
 * mesma conta leriam o MESMO acumulado (o edge case que D3 rejeita — ver a
 * skill, seção "Edge cases").
 */
export const metas = pgTable(
  'metas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Todo dado do produto pende da família (R1). Vem sempre do token. */
    familiaId: uuid('familia_id')
      .notNull()
      .references(() => familias.id, { onDelete: 'cascade' }),
    nome: text('nome').notNull(),
    alvoCentavos: dinheiroCentavos('alvo_centavos').notNull(),
    /**
     * D3 — a conta `RESERVA` própria deste cofrinho. `ON DELETE cascade`: se
     * a conta some, o cofrinho some junto (a conta é dona da existência
     * dele, não o contrário).
     */
    contaReservaId: uuid('conta_reserva_id')
      .notNull()
      .references(() => contas.id, { onDelete: 'cascade' }),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  t => [
    index('metas_por_familia').on(t.familiaId),
    // D3 — o vínculo 1:1: UMA conta RESERVA nunca serve a mais de um cofrinho.
    uniqueIndex('metas_conta_reserva_unica').on(t.contaReservaId),
    check('metas_alvo_positivo', sql`${t.alvoCentavos} > 0`),
  ],
);

// ---------------------------------------------------------------------------
// Relações
// ---------------------------------------------------------------------------

export const familiasRelacoes = relations(familias, ({ many }) => ({
  membros: many(membros),
  convites: many(convites),
  contas: many(contas),
  categorias: many(categorias),
}));

export const categoriasRelacoes = relations(categorias, ({ one, many }) => ({
  familia: one(familias, {
    fields: [categorias.familiaId],
    references: [familias.id],
  }),
  orcamentosMes: many(orcamentosMes),
}));

export const orcamentosMesRelacoes = relations(orcamentosMes, ({ one }) => ({
  familia: one(familias, {
    fields: [orcamentosMes.familiaId],
    references: [familias.id],
  }),
  categoria: one(categorias, {
    fields: [orcamentosMes.categoriaId],
    references: [categorias.id],
  }),
}));

export const remanejamentosRelacoes = relations(remanejamentos, ({ one }) => ({
  familia: one(familias, {
    fields: [remanejamentos.familiaId],
    references: [familias.id],
  }),
  categoriaOrigem: one(categorias, {
    fields: [remanejamentos.categoriaOrigemId],
    references: [categorias.id],
  }),
  categoriaDestino: one(categorias, {
    fields: [remanejamentos.categoriaDestinoId],
    references: [categorias.id],
  }),
  autor: one(membros, {
    fields: [remanejamentos.autorMembroId],
    references: [membros.id],
  }),
}));

export const competenciasRelacoes = relations(competencias, ({ one }) => ({
  familia: one(familias, {
    fields: [competencias.familiaId],
    references: [familias.id],
  }),
}));

export const contasRelacoes = relations(contas, ({ one }) => ({
  familia: one(familias, {
    fields: [contas.familiaId],
    references: [familias.id],
  }),
}));

export const seriesParcelasRelacoes = relations(seriesParcelas, ({ one, many }) => ({
  familia: one(familias, {
    fields: [seriesParcelas.familiaId],
    references: [familias.id],
  }),
  lancamentos: many(lancamentos),
}));

export const lancamentosRelacoes = relations(lancamentos, ({ one }) => ({
  familia: one(familias, {
    fields: [lancamentos.familiaId],
    references: [familias.id],
  }),
  categoria: one(categorias, {
    fields: [lancamentos.categoriaId],
    references: [categorias.id],
  }),
  conta: one(contas, {
    fields: [lancamentos.contaId],
    references: [contas.id],
  }),
  contaDestino: one(contas, {
    fields: [lancamentos.contaDestinoId],
    references: [contas.id],
  }),
  autor: one(membros, {
    fields: [lancamentos.criadoPorMembroId],
    references: [membros.id],
  }),
  serieParcela: one(seriesParcelas, {
    fields: [lancamentos.serieParcelaId],
    references: [seriesParcelas.id],
  }),
}));

export const faturasRelacoes = relations(faturas, ({ one }) => ({
  familia: one(familias, {
    fields: [faturas.familiaId],
    references: [familias.id],
  }),
  conta: one(contas, {
    fields: [faturas.contaId],
    references: [contas.id],
  }),
  pagaComConta: one(contas, {
    fields: [faturas.pagaComContaId],
    references: [contas.id],
  }),
}));

export const metasRelacoes = relations(metas, ({ one }) => ({
  familia: one(familias, {
    fields: [metas.familiaId],
    references: [familias.id],
  }),
  contaReserva: one(contas, {
    fields: [metas.contaReservaId],
    references: [contas.id],
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
export type Categoria = typeof categorias.$inferSelect;
export type OrcamentoMes = typeof orcamentosMes.$inferSelect;
export type Remanejamento = typeof remanejamentos.$inferSelect;
export type CompetenciaDb = typeof competencias.$inferSelect;
export type SerieParcelas = typeof seriesParcelas.$inferSelect;
export type LancamentoDb = typeof lancamentos.$inferSelect;
export type FaturaDb = typeof faturas.$inferSelect;
export type MetaDb = typeof metas.$inferSelect;
