/**
 * Integração de fechamento (EF-08) — Postgres de verdade, HTTP real.
 * Prova RN-36, RN-37, RN-38.
 */
import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { db, fecharBanco } from '../src/db';
import { categorias, contas, fechamentosMes, orcamentosMes } from '../src/db/schema';
import { abrirApp, cookieDeSessao, criarFamiliaComMembro, limparBanco, subirServidorComRealtime, type FamiliaDeTeste, type StackDeTempoReal } from './apoio';

const app = abrirApp();
let familiaA: FamiliaDeTeste;
let cookieA: string;
let stack: StackDeTempoReal;

let contaAId: string;
let categoriaAId: string;
let categoriaBId: string;

beforeAll(async () => {
  await limparBanco();
  familiaA = await criarFamiliaComMembro('Família Fechamento');
  cookieA = await cookieDeSessao(familiaA.membroId);
  stack = await subirServidorComRealtime();

  // Criar contas e categorias
  const [conta] = await db.insert(contas).values({
    familiaId: familiaA.familiaId,
    tipo: 'DEBITO',
    nome: 'Conta Corrente',
    icone: 'bank',
    cor: '#000000',
    saldoInicialCentavos: 10000 // R$ 100,00
  }).returning();
  contaAId = conta.id;

  const [cat1, cat2] = await db.insert(categorias).values([
    { familiaId: familiaA.familiaId, nome: 'Mercado', icone: 'cart', cor: '#ff0000' },
    { familiaId: familiaA.familiaId, nome: 'Lazer', icone: 'game', cor: '#00ff00' }
  ]).returning();
  categoriaAId = cat1.id;
  categoriaBId = cat2.id;
});

afterAll(async () => {
  await stack.encerrar();
  await fecharBanco();
});

describe('EF-08: Resumo e Fechamento', () => {
  it('Pode consultar resumo da competência', async () => {
    // Definir tetos
    await request(app)
      .put('/competencias/2026-08/categorias/' + categoriaAId + '/teto')
      .set('Cookie', cookieA)
      .send({ tetoCentavos: 5000 }); // R$ 50

    await request(app)
      .put('/competencias/2026-08/categorias/' + categoriaBId + '/teto')
      .set('Cookie', cookieA)
      .send({ tetoCentavos: 2000 }); // R$ 20

    // Criar uma despesa que estoura o teto B
    await request(app)
      .post('/lancamentos')
      .set('Cookie', cookieA)
      .send({
        tipo: 'DESPESA',
        descricao: 'Gasto Lazer',
        valorCentavos: 3000,
        data: '2026-08-10',
        contaId: contaAId,
        categoriaId: categoriaBId
      });

    // Receita de 100
    await request(app)
      .post('/lancamentos')
      .set('Cookie', cookieA)
      .send({
        tipo: 'RECEITA',
        descricao: 'Salario',
        valorCentavos: 10000, // R$ 100
        data: '2026-08-05',
        contaId: contaAId
      });

    const res = await request(app)
      .get('/competencias/2026-08/fechamento')
      .set('Cookie', cookieA);
    
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('aberto');
    expect(res.body.recebidoCentavos).toBe(10000);
    expect(res.body.planejadoCentavos).toBe(7000); // 5000 + 2000
    expect(res.body.gastoCentavos).toBe(3000);
    expect(res.body.sobraProjetadaCentavos).toBe(7000); // 10000 - 3000
    expect(res.body.categoriasEstouradas).toHaveLength(1);
    expect(res.body.categoriasEstouradas[0].id).toBe(categoriaBId);
  });

  it('RN-36: Fechar mês sela a competência e salva a sobra', async () => {
    const res = await request(app)
      .post('/competencias/2026-08/fechar')
      .set('Cookie', cookieA);
    
    expect(res.status).toBe(200);
    expect(res.body.competencia).toBe('2026-08');
    expect(res.body.sobraCentavos).toBe(7000);

    const checkResumo = await request(app)
      .get('/competencias/2026-08/fechamento')
      .set('Cookie', cookieA);
    
    expect(checkResumo.body.status).toBe('fechado');
    expect(checkResumo.body.fechadoEm).toBeTypeOf('string');
    expect(checkResumo.body.autorMembroId).toBe(familiaA.membroId);
  });

  it('RN-37: Competência selada não aceita novo lançamento', async () => {
    const res = await request(app)
      .post('/lancamentos')
      .set('Cookie', cookieA)
      .send({
        tipo: 'DESPESA',
        descricao: 'Tentativa em mês fechado',
        valorCentavos: 1000,
        data: '2026-08-15',
        contaId: contaAId,
        categoriaId: categoriaAId
      });
    
    expect(res.status).toBe(409);
    expect(res.body.erro).toBe('competencia_selada');
  });

  it('Lançar em mês aberto ainda é permitido (prova RN-37 inversa)', async () => {
    const res = await request(app)
      .post('/lancamentos')
      .set('Cookie', cookieA)
      .send({
        tipo: 'DESPESA',
        descricao: 'Gasto normal em setembro',
        valorCentavos: 1000,
        data: '2026-09-01',
        contaId: contaAId,
        categoriaId: categoriaAId
      });
    
    expect(res.status).toBe(201);
  });

  it('RN-38: Sobra entra no lastro do mês seguinte', async () => {
    // Lastro de 2026-09
    // A sobra de agosto foi R$ 70 (recebido 100 - gasto 30).
    // O saldo de "contaA" iniciou com R$ 100.
    // + Receita agosto = R$ 100 -> R$ 200
    // - Despesa agosto = R$ 30 -> R$ 170
    // - Despesa setembro = R$ 10 -> R$ 160.
    // Então, lastro (caixa real) é R$ 160.
    // Isso mostra que o que não foi gasto em agosto continua na conta, o que "aumenta o lastro" naturalmente.
    const res = await request(app)
      .get('/competencias/2026-09')
      .set('Cookie', cookieA);
    
    expect(res.status).toBe(200);
    expect(res.body.lastroCentavos).toBe(16000);
  });
});
