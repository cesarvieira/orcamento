/**
 * As decisões da plataforma, provadas: dinheiro em centavos e o seed.
 *
 * D-06 diz que dinheiro é `integer` em centavos em toda a pilha. O jeito de
 * provar isso na EF-00, que ainda não tem entidade financeira, é provar que o
 * TIPO que os módulos vão usar se comporta como se espera — inclusive nos dois
 * lugares onde a soma das partes tem de fechar com o todo.
 */
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { db, fecharBanco } from '../src/db';
import { semear } from '../src/db/semear';
import { conferirSenha, gerarHashDeSenha } from '../src/modulos/familia/senha';
import { limparBanco } from './apoio';

afterAll(async () => {
  await fecharBanco();
});

describe('dinheiro em centavos (D-06)', () => {
  it('o Postgres guarda e devolve centavos como INTEIRO, sem perder nada', async () => {
    const resultado = await db.execute<{ valor: number }>(
      sql`select cast(31240 as integer) as valor`,
    );
    expect(resultado.rows[0]?.valor).toBe(31240);
  });

  it('o teto de 32 bits é o que a decisão diz: ~R$ 21,4 milhões', async () => {
    const resultado = await db.execute<{ teto: number }>(
      sql`select cast(2147483647 as integer) as teto`,
    );
    const teto = resultado.rows[0]?.teto ?? 0;
    expect(teto).toBe(2_147_483_647);
    // Em reais: acima de vinte milhões. Suficiente para orçamento familiar, e
    // registrado para que a troca por `bigint` seja decisão nova, não surpresa.
    expect(teto / 100).toBeGreaterThan(21_000_000);
  });

  it('dividir em centavos fecha exatamente; em float, não', () => {
    // O caso mínimo que a decisão exige: R$ 100,00 em 3×.
    const totalCentavos = 10_000;
    const partes = 3;
    const base = Math.floor(totalCentavos / partes);
    const parcelas = Array.from({ length: partes }, () => base);
    // O resíduo tem destino explícito: a ÚLTIMA parcela.
    parcelas[partes - 1] = (parcelas[partes - 1] as number) + (totalCentavos - base * partes);

    expect(parcelas).toEqual([3333, 3333, 3334]);
    expect(parcelas.reduce((a, b) => a + b, 0)).toBe(totalCentavos);

    // O mesmo em reais, com float e arredondamento na borda — que é o que o
    // protótipo faz. A soma das partes deixa de fechar com o todo.
    const emReais = Array.from({ length: partes }, () => Math.round((100 / 3) * 100) / 100);
    expect(emReais.reduce((a, b) => a + b, 0)).not.toBe(100);
  });
});

describe('senha', () => {
  it('o hash confere com a senha certa e recusa a errada', async () => {
    const hash = await gerarHashDeSenha('uma senha qualquer');
    await expect(conferirSenha('uma senha qualquer', hash)).resolves.toBe(true);
    await expect(conferirSenha('outra senha', hash)).resolves.toBe(false);
  });

  it('nunca confere contra segredo ausente', async () => {
    await expect(conferirSenha('qualquer coisa', null)).resolves.toBe(false);
  });
});

describe('seed', () => {
  beforeAll(async () => {
    await limparBanco();
    process.env.PREATOR_TEST_USER = 'semeada@exemplo.test';
    process.env.PREATOR_TEST_PASS = 'senha-da-semeada';
  });

  it('cria a família de teste com um membro ACEITO', async () => {
    const resumo = await semear(db);
    expect(resumo).toContain('semeada@exemplo.test');
    expect(resumo).toContain('Bruno');
    expect(resumo).toMatch(/contas: \d+/);
    expect(resumo).toMatch(/orcamento: \d+/);
    expect(resumo).toMatch(/metas: \d+/);
    expect(resumo).toMatch(/lancamentos: \d+/);
    expect(resumo).toMatch(/faturas: \d+/);
    expect(resumo).toMatch(/fechamento: \d+/);

    const contagem = await db.execute<{ quantos: string }>(
      sql`select count(*)::text as quantos from membros where email = 'semeada@exemplo.test'`,
    );
    expect(Number(contagem.rows[0]?.quantos)).toBe(1);
  });

  it('semeia lançamentos em competências passadas, atual e futuras', async () => {
    await limparBanco();
    process.env.PREATOR_TEST_USER = 'semeada@exemplo.test';
    process.env.PREATOR_TEST_PASS = 'senha-da-semeada';
    await semear(db);

    const porCompetencia = await db.execute<{ competencia: string; quantos: string }>(
      sql`select competencia, count(*)::text as quantos from lancamentos group by competencia order by competencia`,
    );
    expect(porCompetencia.rows.length).toBeGreaterThanOrEqual(4);

    const tipos = await db.execute<{ tipo: string; quantos: string }>(
      sql`select tipo, count(*)::text as quantos from lancamentos group by tipo`,
    );
    const mapa = Object.fromEntries(tipos.rows.map(r => [r.tipo, Number(r.quantos)]));
    expect(mapa.RECEITA).toBeGreaterThan(0);
    expect(mapa.DESPESA).toBeGreaterThan(0);
    expect(mapa.TRANSFERENCIA).toBeGreaterThan(0);

    const cartoes = await db.execute<{ quantos: string }>(
      sql`select count(*)::text as quantos from contas where tipo = 'CREDITO'`,
    );
    expect(Number(cartoes.rows[0]?.quantos)).toBeGreaterThanOrEqual(2);

    const fechados = await db.execute<{ quantos: string }>(
      sql`select count(*)::text as quantos from fechamentos_mes`,
    );
    expect(Number(fechados.rows[0]?.quantos)).toBe(1);
  });

  it('é idempotente: rodar de novo não duplica a família', async () => {
    await semear(db);

    const familias = await db.execute<{ quantos: string }>(
      sql`select count(*)::text as quantos from familias`,
    );
    expect(Number(familias.rows[0]?.quantos)).toBe(1);
  });

  it('recusa rodar sem as credenciais de teste no ambiente', async () => {
    const usuario = process.env.PREATOR_TEST_USER;
    delete process.env.PREATOR_TEST_USER;
    try {
      await expect(semear(db)).rejects.toThrow(/PREATOR_TEST_USER/);
    } finally {
      process.env.PREATOR_TEST_USER = usuario;
    }
  });
});
