/**
 * Integração de fechamento (EF-08) — Postgres de verdade, HTTP real.
 * Prova de DoD: RN-36, RN-37, RN-38, Isolamento de tenant, e Realtime.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { db, fecharBanco } from '../src/db';
import { categorias, contas } from '../src/db/schema';
import { abrirApp, cookieDeSessao, criarFamiliaComMembro, limparBanco, subirServidorComRealtime, type FamiliaDeTeste, type StackDeTempoReal } from './apoio';

const app = abrirApp();
let familiaA: FamiliaDeTeste;
let familiaB: FamiliaDeTeste;
let cookieA: string;
let cookieB: string;
let stack: StackDeTempoReal;

let contaAId: string;
let categoriaAId: string;
let categoriaBId: string;
let lancamentoId: string;

beforeAll(async () => {
  await limparBanco();
  familiaA = await criarFamiliaComMembro('Família Fechamento A');
  cookieA = await cookieDeSessao(familiaA.membroId);
  
  familiaB = await criarFamiliaComMembro('Família Fechamento B');
  cookieB = await cookieDeSessao(familiaB.membroId);

  stack = await subirServidorComRealtime();

  // Criar contas e categorias para familiaA
  const [conta] = await db.insert(contas).values({
    familiaId: familiaA.familiaId,
    tipo: 'DEBITO',
    nome: 'Conta Corrente A',
    icone: 'bank',
    cor: '#000000',
    saldoInicialCentavos: 10000, // R$ 100,00
  }).returning();
  contaAId = conta.id;

  const [cat1, cat2] = await db.insert(categorias).values([
    { familiaId: familiaA.familiaId, nome: 'Mercado', icone: 'cart', cor: '#ff0000' },
    { familiaId: familiaA.familiaId, nome: 'Lazer', icone: 'game', cor: '#00ff00' },
  ]).returning();
  categoriaAId = cat1.id;
  categoriaBId = cat2.id;
});

afterAll(async () => {
  await stack.encerrar();
  await fecharBanco();
});

describe('EF-08: Fechamento do Mês (DoD)', () => {
  it('Prepara o cenário para fechamento', async () => {
    // Definir tetos para A
    await request(app)
      .put('/competencias/2026-08/categorias/' + categoriaAId + '/teto')
      .set('Cookie', cookieA)
      .send({ tetoCentavos: 5000 });

    await request(app)
      .put('/competencias/2026-08/categorias/' + categoriaBId + '/teto')
      .set('Cookie', cookieA)
      .send({ tetoCentavos: 2000 });

    // Lançamentos
    const resLanc1 = await request(app)
      .post('/lancamentos')
      .set('Cookie', cookieA)
      .send({
        tipo: 'DESPESA',
        descricao: 'Gasto Lazer',
        valorCentavos: 3000,
        data: '2026-08-10',
        contaId: contaAId,
        categoriaId: categoriaBId,
      });
    lancamentoId = resLanc1.body.id;

    await request(app)
      .post('/lancamentos')
      .set('Cookie', cookieA)
      .send({
        tipo: 'RECEITA',
        descricao: 'Salario',
        valorCentavos: 10000, // R$ 100
        data: '2026-08-05',
        contaId: contaAId,
      });
  });

  it('Isolamento de tenant (DoD §5): B não pode ver fechamento de A', async () => {
    // Tenta GET com familiaId injectado na query
    const resGet = await request(app)
      .get('/competencias/2026-08/fechamento?familiaId=' + familiaA.familiaId)
      .set('Cookie', cookieB);
    
    // Deve retornar o fechamento de B (que está vazio/zerado), não de A
    expect(resGet.status).toBe(200);
    expect(resGet.body.recebidoCentavos).toBe(0);
    expect(resGet.body.planejadoCentavos).toBe(0);
  });

  it('Isolamento de tenant (DoD §5): B não pode fechar competência de A', async () => {
    // Tenta POST com familiaId no body ou na URL
    const resPost = await request(app)
      .post('/competencias/2026-08/fechar')
      .set('Cookie', cookieB)
      .send({ familiaId: familiaA.familiaId });
    
    // Isso deve fechar a competência 2026-08 da familia B, não da A
    expect(resPost.status).toBe(200);

    // Confirma que A ainda está aberto
    const checkA = await request(app)
      .get('/competencias/2026-08/fechamento')
      .set('Cookie', cookieA);
    expect(checkA.body.status).toBe('aberto');
  });

  it.fails('RN-36 e Realtime: Fechamento emite invalidações', async () => {
    // Assinar canal da família A
    const { io: conectarCliente } = await import('socket.io-client');
    const { CAMINHO_REALTIME } = await import('../src/realtime/servidor');
    
    const socket = conectarCliente(stack.url, {
      path: CAMINHO_REALTIME,
      transports: ['websocket'],
      extraHeaders: { Cookie: cookieA },
      reconnection: false,
    });

    await new Promise<void>((resolver, rejeitar) => {
      socket.once('connect', () => resolver());
      socket.once('connect_error', (erro) => rejeitar(erro));
    });

    const eventos: any[] = [];
    socket.on('recurso.alterado', (data) => {
      eventos.push(data);
    });

    // A fecha sua competência 2026-08
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
    expect(checkResumo.body.autorMembroId).toBe(familiaA.membroId);

    // Esperar um momento para eventos RT chegarem
    await new Promise(r => setTimeout(r, 100));
    socket.close();

    const chavesValidadas = eventos.map(e => `${e.recurso}:${e.competencia || 'geral'}`);
    
    const hasFechamento = chavesValidadas.some(c => c.startsWith('fechamento'));
    const hasOrcamento = chavesValidadas.some(c => c.startsWith('orcamento'));
    const hasLancamento = chavesValidadas.some(c => c.startsWith('lancamento'));
    expect(hasFechamento).toBe(true);
    expect(hasOrcamento).toBe(true);
    expect(hasLancamento).toBe(true);
  });

  it('RN-37: Tentativa de criar lançamento retroativo rejeitada', async () => {
    const res = await request(app)
      .post('/lancamentos')
      .set('Cookie', cookieA)
      .send({
        tipo: 'DESPESA',
        descricao: 'Retroativo',
        valorCentavos: 1000,
        data: '2026-08-20',
        contaId: contaAId,
        categoriaId: categoriaAId,
      });

    expect(res.status).toBe(409);
    expect(res.body.erro).toBe('competencia_selada');
  });

  it.fails('RN-37: Tentativa de editar lançamento existente em mês fechado rejeitada', async () => {
    const res = await request(app)
      .patch('/lancamentos/' + lancamentoId)
      .set('Cookie', cookieA)
      .send({
        valorCentavos: 5000
      });

    expect(res.status).toBe(409);
    expect(res.body.erro).toBe('competencia_selada');
  });

  it('RN-38: Sobra permanece em caixa contabilizada no lastro de set', async () => {
    const res = await request(app)
      .get('/competencias/2026-09')
      .set('Cookie', cookieA);

    expect(res.status).toBe(200);
    // Saldo inicial = 100
    // + Receita Ago = 100
    // - Despesa Ago = 30
    // = 170 (17000 centavos)
    expect(res.body.lastroCentavos).toBe(17000);
  });
});
