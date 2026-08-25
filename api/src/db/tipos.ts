/**
 * Os tipos de coluna que TODOS os módulos usam. Definidos aqui uma vez, na
 * EF-00, porque cada um deles é uma decisão registrada — não uma preferência.
 *
 * Nada aqui é entidade de domínio: são as formas que as entidades dos outros
 * módulos vão assumir.
 */
import { char, date, integer, timestamp } from 'drizzle-orm/pg-core';

/**
 * DINHEIRO — inteiro em CENTAVOS, em toda a pilha (D-06).
 *
 * `integer` no Postgres é de 32 bits: o teto é 2.147.483.647 centavos, ou
 * ~R$ 21,4 milhões. A escolha é EXPLÍCITA e suficiente para orçamento
 * familiar; ela não é inferida pelo ORM. Se algum dia um valor puder passar
 * disso, a troca para `bigint` é uma decisão nova, com migration própria.
 *
 * Nunca use `numeric`, `real` ou `double`: o rateio pró-rata do lastro e o
 * parcelamento dividem valores, e com float a soma das partes deixa de fechar
 * com o todo.
 *
 *   valorCentavos: 31240  →  R$ 312,40
 *
 * A formatação para exibição acontece só na borda, no componente.
 *
 * @fundacao ninguém usa ainda — a EF-00 não tem entidade de domínio. É pra
 * EF-02 em diante.
 */
export const dinheiroCentavos = (nome: string) => integer(nome);

/**
 * DATA DO FATO — quando aconteceu. `DATE`, sem hora e sem fuso.
 *
 * É deliberadamente distinta da competência: uma compra do dia 31 pode
 * pertencer à competência do mês seguinte. Ver `competencia` abaixo.
 *
 * @fundacao ninguém usa ainda — a EF-00 não tem entidade de domínio. É pra
 * EF-02 em diante.
 */
export const dataDoFato = (nome: string) => date(nome);

/**
 * COMPETÊNCIA — a que mês do orçamento o fato pertence. `CHAR(7)`, `AAAA-MM`.
 *
 * É CALCULADA NA ESCRITA e PERSISTIDA, nunca derivada na leitura: o mês de
 * competência de uma compra no cartão depende do fechamento da fatura vigente
 * naquele dia, e esse fechamento pode mudar depois. Recalcular na leitura
 * reescreveria o passado.
 *
 * @fundacao ninguém usa ainda — a EF-00 não tem entidade de domínio. É pra
 * EF-02 em diante.
 */
export const competencia = (nome: string) => char(nome, { length: 7 });

/** Carimbo de criação — `timestamptz`, sempre em UTC no banco. */
export const criadoEm = (nome = 'criado_em') =>
  timestamp(nome, { withTimezone: true }).notNull().defaultNow();

/** Carimbo de atualização — `timestamptz`, sempre em UTC no banco. */
export const atualizadoEm = (nome = 'atualizado_em') =>
  timestamp(nome, { withTimezone: true }).notNull().defaultNow();
