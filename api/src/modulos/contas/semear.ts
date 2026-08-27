/**
 * O SEMEADOR de `contas` (EF-02) — o ponto de extensão que `db/semear.ts`
 * abriu em `SEMEADORES_DE_MODULO`.
 *
 * Semeia as TRÊS contas (uma de cada tipo): sem isto o gate de navegação abre
 * a tela `/contas` vazia, e tela vazia não prova render.
 */
import { eq } from 'drizzle-orm';

import type { ContextoDoSeed, SemeadorDeModulo } from '../../db/semear';
import { contas } from '../../db/schema';

export const semeadorDeContas: SemeadorDeModulo = {
  modulo: 'contas',
  async semear(db, contexto: ContextoDoSeed): Promise<number> {
    const existentes = await db
      .select({ id: contas.id })
      .from(contas)
      .where(eq(contas.familiaId, contexto.familiaId));

    // Idempotente: já semeado, não duplica.
    if (existentes.length > 0) return existentes.length;

    const linhas = await db
      .insert(contas)
      .values([
        {
          familiaId: contexto.familiaId,
          tipo: 'DEBITO',
          nome: 'Conta corrente',
          icone: 'banco',
          cor: '#2563eb',
          saldoInicialCentavos: 250000,
        },
        {
          familiaId: contexto.familiaId,
          tipo: 'CREDITO',
          nome: 'Cartão de crédito',
          icone: 'cartao',
          cor: '#dc2626',
          limiteCentavos: 500000,
          diaFechamento: 20,
          diaVencimento: 27,
        },
        {
          familiaId: contexto.familiaId,
          tipo: 'RESERVA',
          nome: 'Reserva de emergência',
          icone: 'cofre',
          cor: '#16a34a',
          saldoInicialCentavos: 1000000,
        },
      ])
      .returning({ id: contas.id });

    return linhas.length;
  },
};
