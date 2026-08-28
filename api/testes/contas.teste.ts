/**
 * Integração de `contas` (EF-02/tarefa #39) — Postgres de verdade, HTTP real.
 *
 * ⛔ Regra #0: as regras RN-06, RN-07 e RN-08 testadas aqui vêm de
 * `.preator/skills/negocio/contas-e-lastro/SKILL.md` (tabela "Regras de
 * negócio"), que cita `docs/especificacoes/EF-02-contas.md` §1/§2 como fonte
 * primária. Nenhuma regra testada aqui foi inventada.
 */
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { db, fecharBanco } from '../src/db';
import { contas } from '../src/db/schema';
import { contaPodeSerExcluida } from '../src/modulos/contas/servico';
import {
  abrirApp,
  cookieDeSessao,
  criarFamiliaComMembro,
  limparBanco,
  subirServidorComRealtime,
  type FamiliaDeTeste,
  type StackDeTempoReal,
} from './apoio';

const app = abrirApp();

let familiaA: FamiliaDeTeste;
let familiaB: FamiliaDeTeste;
let cookieA: string;
let cookieB: string;
// Toda mutação de contas emite invalidação (D-04/R3), e o emissor exige o
// servidor de tempo real DE PÉ — mesmo padrão de `testes/convites.teste.ts`.
let stack: StackDeTempoReal;

beforeAll(async () => {
  await limparBanco();
  familiaA = await criarFamiliaComMembro('Família A das contas');
  familiaB = await criarFamiliaComMembro('Família B das contas');
  cookieA = await cookieDeSessao(familiaA.membroId);
  cookieB = await cookieDeSessao(familiaB.membroId);
  stack = await subirServidorComRealtime();
});

afterAll(async () => {
  await stack.encerrar();
  await fecharBanco();
});

const contaDebito = {
  tipo: 'DEBITO' as const,
  nome: 'Conta corrente',
  icone: 'banco',
  cor: '#2563eb',
  saldoInicialCentavos: 150000,
};

const contaReserva = {
  tipo: 'RESERVA' as const,
  nome: 'Reserva de emergência',
  icone: 'cofre',
  cor: '#16a34a',
  saldoInicialCentavos: 900000,
};

const contaCredito = {
  tipo: 'CREDITO' as const,
  nome: 'Cartão',
  icone: 'cartao',
  cor: '#dc2626',
  limiteCentavos: 500000,
  diaFechamento: 20,
  diaVencimento: 27,
};

describe('contas — cadastro e leitura', () => {
  it('cria uma conta DEBITO e devolve o saldo derivado = saldo inicial (sem lançamentos)', async () => {
    const resposta = await request(app).post('/contas').set('Cookie', cookieA).send(contaDebito);

    expect(resposta.status).toBe(201);
    expect(resposta.body.tipo).toBe('DEBITO');
    expect(resposta.body.saldoInicialCentavos).toBe(150000);
    expect(resposta.body.saldoCentavos).toBe(150000);
    // Campos exclusivos de CREDITO vêm nulos numa conta DEBITO.
    expect(resposta.body.limiteCentavos).toBeNull();
    expect(resposta.body.diaFechamento).toBeNull();
    expect(resposta.body.diaVencimento).toBeNull();
  });

  it('cria uma conta CREDITO — saldo inicial não se aplica, saldo derivado começa em zero', async () => {
    const resposta = await request(app).post('/contas').set('Cookie', cookieA).send(contaCredito);

    expect(resposta.status).toBe(201);
    expect(resposta.body.tipo).toBe('CREDITO');
    expect(resposta.body.limiteCentavos).toBe(500000);
    expect(resposta.body.diaFechamento).toBe(20);
    expect(resposta.body.diaVencimento).toBe(27);
    expect(resposta.body.saldoInicialCentavos).toBeNull();
    expect(resposta.body.saldoCentavos).toBe(0);
  });

  it('GET /contas lista as contas da família da sessão, com saldo derivado em cada uma', async () => {
    const resposta = await request(app).get('/contas').set('Cookie', cookieA);

    expect(resposta.status).toBe(200);
    expect(resposta.body.contas.length).toBeGreaterThanOrEqual(2);
    for (const conta of resposta.body.contas as { saldoCentavos: number }[]) {
      expect(typeof conta.saldoCentavos).toBe('number');
    }
  });

  it('sem sessão, GET /contas responde 401', async () => {
    const resposta = await request(app).get('/contas');
    expect(resposta.status).toBe(401);
  });
});

describe('RN-08 — diaFechamento/diaVencimento só em CREDITO, e valem 1–28', () => {
  it('1 e 28 são aceitos (limites da faixa)', async () => {
    const resposta = await request(app)
      .post('/contas')
      .set('Cookie', cookieA)
      .send({ ...contaCredito, nome: 'Cartão faixa', diaFechamento: 1, diaVencimento: 28 });

    expect(resposta.status).toBe(201);
  });

  it('0 é recusado — dia do mês começa em 1', async () => {
    const resposta = await request(app)
      .post('/contas')
      .set('Cookie', cookieA)
      .send({ ...contaCredito, nome: 'Cartão inválido', diaFechamento: 0 });

    expect(resposta.status).toBe(422);
  });

  it('29 é recusado — dia 29–31 não existe em todo mês', async () => {
    const resposta = await request(app)
      .post('/contas')
      .set('Cookie', cookieA)
      .send({ ...contaCredito, nome: 'Cartão inválido', diaVencimento: 29 });

    expect(resposta.status).toBe(422);
  });

  it('o CHECK do banco também recusa fora da faixa — defesa em profundidade', async () => {
    await expect(
      db.insert(contas).values({
        familiaId: familiaA.familiaId,
        tipo: 'CREDITO',
        nome: 'Cartão direto no banco',
        icone: 'cartao',
        cor: '#000000',
        limiteCentavos: 1000,
        diaFechamento: 31,
        diaVencimento: 10,
      }),
    ).rejects.toThrow();
  });

  it('o CHECK do banco recusa limite/fechamento/vencimento fora de CREDITO', async () => {
    await expect(
      db.insert(contas).values({
        familiaId: familiaA.familiaId,
        tipo: 'DEBITO',
        nome: 'Débito com campo de cartão',
        icone: 'banco',
        cor: '#000000',
        saldoInicialCentavos: 0,
        diaFechamento: 10,
      }),
    ).rejects.toThrow();
  });

  it('uma conta DEBITO/RESERVA não persiste diaFechamento nem diaVencimento mesmo se o cliente tentar mandar', async () => {
    // Mandando de propósito um campo que não pertence ao tipo DEBITO, para
    // provar que ele é ignorado (não é erro de validação, nem persiste).
    const corpoComLixo: Record<string, unknown> = { ...contaDebito, nome: 'Débito com lixo', diaFechamento: 15 };

    const resposta = await request(app).post('/contas').set('Cookie', cookieA).send(corpoComLixo);

    expect(resposta.status).toBe(201);
    expect(resposta.body.diaFechamento).toBeNull();
  });
});

describe('RN-07 — RESERVA fica fora do total "em conta hoje"', () => {
  it('o total soma DEBITO e CREDITO, mas não soma RESERVA', async () => {
    // Uma família nova e isolada, para o total ser previsível.
    const familia = await criarFamiliaComMembro('Família do total RN-07');
    const cookie = await cookieDeSessao(familia.membroId);

    await request(app)
      .post('/contas')
      .set('Cookie', cookie)
      .send({ ...contaDebito, saldoInicialCentavos: 10000 });
    await request(app)
      .post('/contas')
      .set('Cookie', cookie)
      .send({ ...contaReserva, saldoInicialCentavos: 999999 });
    await request(app).post('/contas').set('Cookie', cookie).send(contaCredito);

    const resposta = await request(app).get('/contas').set('Cookie', cookie);

    expect(resposta.status).toBe(200);
    // DEBITO (10000) + CREDITO (saldo derivado 0, sem lançamentos) — a
    // RESERVA (999999) fica de fora, não importa quão grande seja.
    expect(resposta.body.totalEmContaHojeCentavos).toBe(10000);
  });
});

describe('saldo derivado — soma real de lançamentos (EF-04, tarefa #52)', () => {
  it('RECEITA soma, DESPESA subtrai, numa conta DEBITO', async () => {
    const familia = await criarFamiliaComMembro('Família saldo derivado A');
    const cookie = await cookieDeSessao(familia.membroId);
    const conta = await request(app)
      .post('/contas')
      .set('Cookie', cookie)
      .send({ ...contaDebito, saldoInicialCentavos: 100000 });
    const categoria = await request(app)
      .post('/categorias')
      .set('Cookie', cookie)
      .send({ nome: 'Categoria saldo', icone: 'x', cor: '#000' });

    await request(app).post('/lancamentos').set('Cookie', cookie).send({
      tipo: 'RECEITA',
      descricao: 'Salário',
      valorCentavos: 50000,
      data: '2026-08-01',
      contaId: conta.body.id,
    });
    await request(app).post('/lancamentos').set('Cookie', cookie).send({
      tipo: 'DESPESA',
      descricao: 'Mercado',
      valorCentavos: 20000,
      data: '2026-08-02',
      contaId: conta.body.id,
      categoriaId: categoria.body.id,
    });

    const leitura = await request(app).get('/contas').set('Cookie', cookie);
    const linha = leitura.body.contas.find((c: { id: string }) => c.id === conta.body.id);
    expect(linha.saldoCentavos).toBe(100000 + 50000 - 20000);
  });

  it('TRANSFERENCIA move as duas pontas: origem perde, destino ganha (RN-17 — não é despesa)', async () => {
    const familia = await criarFamiliaComMembro('Família saldo derivado B');
    const cookie = await cookieDeSessao(familia.membroId);
    const origem = await request(app)
      .post('/contas')
      .set('Cookie', cookie)
      .send({ ...contaDebito, nome: 'Origem', saldoInicialCentavos: 30000 });
    const destino = await request(app)
      .post('/contas')
      .set('Cookie', cookie)
      .send({ ...contaReserva, nome: 'Destino', saldoInicialCentavos: 0 });

    await request(app).post('/lancamentos').set('Cookie', cookie).send({
      tipo: 'TRANSFERENCIA',
      descricao: 'Guardar em meta',
      valorCentavos: 12000,
      data: '2026-08-03',
      contaId: origem.body.id,
      contaDestinoId: destino.body.id,
    });

    const leitura = await request(app).get('/contas').set('Cookie', cookie);
    const linhaOrigem = leitura.body.contas.find((c: { id: string }) => c.id === origem.body.id);
    const linhaDestino = leitura.body.contas.find((c: { id: string }) => c.id === destino.body.id);
    expect(linhaOrigem.saldoCentavos).toBe(30000 - 12000);
    expect(linhaDestino.saldoCentavos).toBe(0 + 12000);
  });

  it('RN-18 — DESPESA numa conta CREDITO NÃO move o saldo derivado dela (fica 0)', async () => {
    const familia = await criarFamiliaComMembro('Família saldo derivado C');
    const cookie = await cookieDeSessao(familia.membroId);
    const cartao = await request(app).post('/contas').set('Cookie', cookie).send(contaCredito);
    const categoria = await request(app)
      .post('/categorias')
      .set('Cookie', cookie)
      .send({ nome: 'Categoria RN-18', icone: 'x', cor: '#000' });

    await request(app).post('/lancamentos').set('Cookie', cookie).send({
      tipo: 'DESPESA',
      descricao: 'Compra no crédito',
      valorCentavos: 15000,
      data: '2026-08-04',
      contaId: cartao.body.id,
      categoriaId: categoria.body.id,
    });

    const leitura = await request(app).get('/contas').set('Cookie', cookie);
    const linha = leitura.body.contas.find((c: { id: string }) => c.id === cartao.body.id);
    // RN-19: quem move o saldo é a fatura paga (EF-05, ainda não construída).
    expect(linha.saldoCentavos).toBe(0);
  });
});

describe('RN-06 — conta com lançamento não pode ser excluída (EF-02 §2, tarefa #52)', () => {
  it('contaPodeSerExcluida devolve false quando a conta é ORIGEM/afetada de um lançamento', async () => {
    const familia = await criarFamiliaComMembro('Família RN-06 origem');
    const cookie = await cookieDeSessao(familia.membroId);
    const conta = await request(app)
      .post('/contas')
      .set('Cookie', cookie)
      .send({ ...contaDebito, nome: 'RN-06 conta com lançamento' });
    const categoria = await request(app)
      .post('/categorias')
      .set('Cookie', cookie)
      .send({ nome: 'RN-06 categoria', icone: 'x', cor: '#000' });

    await request(app).post('/lancamentos').set('Cookie', cookie).send({
      tipo: 'DESPESA',
      descricao: 'RN-06 gasto',
      valorCentavos: 100,
      data: '2026-08-01',
      contaId: conta.body.id,
      categoriaId: categoria.body.id,
    });

    await expect(contaPodeSerExcluida(db, conta.body.id as string)).resolves.toBe(false);
  });

  it('contaPodeSerExcluida devolve false quando a conta é DESTINO de uma transferência', async () => {
    const familia = await criarFamiliaComMembro('Família RN-06 destino');
    const cookie = await cookieDeSessao(familia.membroId);
    const origem = await request(app)
      .post('/contas')
      .set('Cookie', cookie)
      .send({ ...contaDebito, nome: 'RN-06 origem' });
    const destino = await request(app)
      .post('/contas')
      .set('Cookie', cookie)
      .send({ ...contaReserva, nome: 'RN-06 destino' });

    await request(app).post('/lancamentos').set('Cookie', cookie).send({
      tipo: 'TRANSFERENCIA',
      descricao: 'RN-06 transferência',
      valorCentavos: 100,
      data: '2026-08-01',
      contaId: origem.body.id,
      contaDestinoId: destino.body.id,
    });

    // A conta ORIGEM também não pode ser excluída — a checagem cobre as duas.
    await expect(contaPodeSerExcluida(db, origem.body.id as string)).resolves.toBe(false);
    // E a conta DESTINO — o cascade de `conta_destino_id` apagaria o mesmo
    // lançamento em silêncio se esta checagem não existisse.
    await expect(contaPodeSerExcluida(db, destino.body.id as string)).resolves.toBe(false);
  });

  it('DELETE /contas/:id de uma conta COM lançamento responde 409, e o lançamento continua lá', async () => {
    const familia = await criarFamiliaComMembro('Família RN-06 HTTP');
    const cookie = await cookieDeSessao(familia.membroId);
    const conta = await request(app)
      .post('/contas')
      .set('Cookie', cookie)
      .send({ ...contaDebito, nome: 'RN-06 conta HTTP' });
    const categoria = await request(app)
      .post('/categorias')
      .set('Cookie', cookie)
      .send({ nome: 'RN-06 categoria HTTP', icone: 'x', cor: '#000' });
    const lancamento = await request(app).post('/lancamentos').set('Cookie', cookie).send({
      tipo: 'DESPESA',
      descricao: 'RN-06 gasto HTTP',
      valorCentavos: 100,
      data: '2026-08-01',
      contaId: conta.body.id,
      categoriaId: categoria.body.id,
    });
    const idDoLancamento = (lancamento.body.lancamentos as { id: string }[])[0]?.id;

    const exclusao = await request(app).delete(`/contas/${conta.body.id}`).set('Cookie', cookie);
    expect(exclusao.status).toBe(409);
    expect(exclusao.body.erro).toBe('conta_com_lancamentos');

    // A conta continua lá...
    const contas = await request(app).get('/contas').set('Cookie', cookie);
    expect((contas.body.contas as { id: string }[]).map(c => c.id)).toContain(conta.body.id);
    // ...e o lançamento também — o cascade NÃO rodou.
    const detalhe = await request(app).get(`/lancamentos/${idDoLancamento}`).set('Cookie', cookie);
    expect(detalhe.status).toBe(200);
  });

  it('DELETE /contas/:id de uma conta que é DESTINO de transferência também responde 409', async () => {
    const familia = await criarFamiliaComMembro('Família RN-06 HTTP destino');
    const cookie = await cookieDeSessao(familia.membroId);
    const origem = await request(app)
      .post('/contas')
      .set('Cookie', cookie)
      .send({ ...contaDebito, nome: 'RN-06 HTTP origem' });
    const destino = await request(app)
      .post('/contas')
      .set('Cookie', cookie)
      .send({ ...contaReserva, nome: 'RN-06 HTTP destino' });
    await request(app).post('/lancamentos').set('Cookie', cookie).send({
      tipo: 'TRANSFERENCIA',
      descricao: 'RN-06 transferência HTTP',
      valorCentavos: 100,
      data: '2026-08-01',
      contaId: origem.body.id,
      contaDestinoId: destino.body.id,
    });

    const exclusao = await request(app).delete(`/contas/${destino.body.id}`).set('Cookie', cookie);
    expect(exclusao.status).toBe(409);
    expect(exclusao.body.erro).toBe('conta_com_lancamentos');
  });

  it('uma conta sem lançamentos é excluída com 204', async () => {
    const criada = await request(app)
      .post('/contas')
      .set('Cookie', cookieA)
      .send({ ...contaDebito, nome: 'Conta para excluir' });

    const exclusao = await request(app)
      .delete(`/contas/${criada.body.id}`)
      .set('Cookie', cookieA);
    expect(exclusao.status).toBe(204);

    const depois = await request(app).get('/contas').set('Cookie', cookieA);
    const ids = (depois.body.contas as { id: string }[]).map(c => c.id);
    expect(ids).not.toContain(criada.body.id);
  });

  it('excluir uma conta inexistente responde 404', async () => {
    const resposta = await request(app)
      .delete('/contas/00000000-0000-0000-0000-000000000000')
      .set('Cookie', cookieA);
    expect(resposta.status).toBe(404);
  });
});

describe('PATCH /contas/:id', () => {
  it('atualiza nome e saldo inicial de uma conta DEBITO', async () => {
    const criada = await request(app)
      .post('/contas')
      .set('Cookie', cookieA)
      .send({ ...contaDebito, nome: 'Antes de editar' });

    const editada = await request(app)
      .patch(`/contas/${criada.body.id}`)
      .set('Cookie', cookieA)
      .send({ ...contaDebito, nome: 'Depois de editar', saldoInicialCentavos: 5000 });

    expect(editada.status).toBe(200);
    expect(editada.body.nome).toBe('Depois de editar');
    expect(editada.body.saldoCentavos).toBe(5000);
  });

  it('editar uma conta inexistente responde 404', async () => {
    const resposta = await request(app)
      .patch('/contas/00000000-0000-0000-0000-000000000000')
      .set('Cookie', cookieA)
      .send(contaDebito);
    expect(resposta.status).toBe(404);
  });
});

describe('isolamento entre famílias', () => {
  it('a família B não vê a conta da família A em GET /contas', async () => {
    const criada = await request(app)
      .post('/contas')
      .set('Cookie', cookieA)
      .send({ ...contaDebito, nome: 'Só de A' });

    const listaDeB = await request(app).get('/contas').set('Cookie', cookieB);
    const ids = (listaDeB.body.contas as { id: string }[]).map(c => c.id);
    expect(ids).not.toContain(criada.body.id);
  });

  it('a família B não consegue editar uma conta da família A (404, não 200 nem 403)', async () => {
    const criada = await request(app)
      .post('/contas')
      .set('Cookie', cookieA)
      .send({ ...contaDebito, nome: 'De A, tentativa de editar por B' });

    const resposta = await request(app)
      .patch(`/contas/${criada.body.id}`)
      .set('Cookie', cookieB)
      .send({ ...contaDebito, nome: 'Sequestrada por B' });

    expect(resposta.status).toBe(404);

    // E o dado de A continua intacto.
    const [linha] = await db.select().from(contas).where(eq(contas.id, criada.body.id));
    expect(linha?.nome).toBe('De A, tentativa de editar por B');
  });

  it('a família B não consegue excluir uma conta da família A', async () => {
    const criada = await request(app)
      .post('/contas')
      .set('Cookie', cookieA)
      .send({ ...contaDebito, nome: 'De A, tentativa de excluir por B' });

    const resposta = await request(app)
      .delete(`/contas/${criada.body.id}`)
      .set('Cookie', cookieB);
    expect(resposta.status).toBe(404);

    const [linha] = await db.select().from(contas).where(eq(contas.id, criada.body.id));
    expect(linha).toBeDefined();
  });
});
