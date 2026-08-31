/**
 * O SEMEADOR de `contas` (EF-02) — o ponto de extensão que `db/semear.ts`
 * abriu em `SEMEADORES_DE_MODULO`.
 *
 * Semeia um ambiente de contas realista: 2 débitos, 2 créditos (o seletor de
 * cartão em `/faturas` só aparece com 2+) e 1 reserva de emergência. Sem isto
 * o gate de navegação abre `/contas` vazio, e tela vazia não prova render.
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
          nome: 'Itaú',
          icone: 'banco',
          cor: '#2563eb',
          saldoInicialCentavos: 450000,
        },
        {
          familiaId: contexto.familiaId,
          tipo: 'DEBITO',
          nome: 'Nubank',
          icone: 'carteira',
          cor: '#8b5cf6',
          saldoInicialCentavos: 120000,
        },
        {
          familiaId: contexto.familiaId,
          tipo: 'CREDITO',
          nome: 'Cartão Nubank',
          icone: 'cartao',
          cor: '#820ad1',
          limiteCentavos: 500000,
          diaFechamento: 10,
          diaVencimento: 17,
        },
        {
          familiaId: contexto.familiaId,
          tipo: 'CREDITO',
          nome: 'Cartão Inter',
          icone: 'cartao',
          cor: '#ff7a00',
          limiteCentavos: 300000,
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
