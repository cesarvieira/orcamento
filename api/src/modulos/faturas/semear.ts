/**
 * O SEMEADOR de `faturas` (EF-05) — materializa os ciclos dos cartões e paga
 * as faturas já fechadas dos meses passados (RN-24: pagar é transferência).
 *
 * Depende de `semeadorDeLancamentos` (despesas no crédito) e de contas
 * DEBITO com saldo. O seletor de cartão (MC-05) já tem 2 CREDITO no seed de
 * contas; este semeador garante faturas `PAGA` + `ABERTA`/`FECHADA` reais.
 *
 * ⛔ Regra #0: RN-23..RN-26 em
 * `.preator/skills/negocio/faturas-e-ciclo-do-cartao/SKILL.md`.
 */
import { and, eq, inArray } from 'drizzle-orm';

import { hojeIsoUtc } from '../../db/semear-datas';
import type { ContextoDoSeed, SemeadorDeModulo } from '../../db/semear';
import { contas, faturas } from '../../db/schema';
import { listarFaturasDoCartao, pagarFatura } from './servico';

export const semeadorDeFaturas: SemeadorDeModulo = {
  modulo: 'faturas',
  async semear(db, contexto: ContextoDoSeed): Promise<number> {
    const pagas = await db
      .select({ id: faturas.id })
      .from(faturas)
      .where(and(eq(faturas.familiaId, contexto.familiaId), eq(faturas.status, 'PAGA')));

    // Idempotente: se já pagamos alguma, o ambiente de fatura já foi semeado.
    if (pagas.length > 0) return pagas.length;

    const cartoes = await db
      .select({ id: contas.id, nome: contas.nome })
      .from(contas)
      .where(and(eq(contas.familiaId, contexto.familiaId), eq(contas.tipo, 'CREDITO')));

    const [debito] = await db
      .select({ id: contas.id })
      .from(contas)
      .where(
        and(
          eq(contas.familiaId, contexto.familiaId),
          eq(contas.tipo, 'DEBITO'),
          eq(contas.nome, 'Itaú'),
        ),
      )
      .limit(1);
    if (!debito) throw new Error('semear faturas: conta Itaú não encontrada');

    const hoje = hojeIsoUtc();

    let pagasAgora = 0;
    for (const cartao of cartoes) {
      const lista = await listarFaturasDoCartao(db, contexto.familiaId, cartao.id, hoje);
      if (!lista) continue;

      for (const fatura of lista.faturas) {
        // Só quita ciclo fechado com valor — deixa a fatura aberta do ciclo
        // corrente para a tela `/faturas` exercer o fluxo de pagamento.
        if (fatura.status !== 'FECHADA' || fatura.totalCentavos <= 0) continue;

        // Paga no vencimento do próprio ciclo (D6 — data do fato do cliente).
        const resultado = await pagarFatura(db, {
          familiaId: contexto.familiaId,
          autorMembroId: contexto.membroId,
          faturaId: fatura.id,
          pagaComContaId: debito.id,
          data: fatura.venceEm,
        });
        if (resultado.tipo !== 'ok') {
          throw new Error(
            `semear faturas: pagar ${cartao.nome} ${fatura.fechaEm} falhou (${resultado.tipo})`,
          );
        }
        pagasAgora += 1;
      }
    }

    // Conta também as faturas materializadas (ABERTA/FECHADA remanescentes).
    const todas = await db
      .select({ id: faturas.id })
      .from(faturas)
      .where(
        and(
          eq(faturas.familiaId, contexto.familiaId),
          inArray(
            faturas.contaId,
            cartoes.map(c => c.id),
          ),
        ),
      );

    return todas.length > 0 ? todas.length : pagasAgora;
  },
};
