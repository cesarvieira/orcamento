/**
 * Integração do SALDO ACUMULADO POR DIA do extrato — Postgres de verdade,
 * HTTP real.
 *
 * 🟨 A regra é NOVA e não tem RN: não vem do mockup (que não tem a coluna) nem
 * de EF nenhuma. Foi decidida com o humano em 2026-09-03, a partir do pedido
 * de conferir o extrato do app contra o do banco. As três decisões estão
 * registradas em `api/src/modulos/lancamentos/servico.ts#saldosPorDiaDoExtrato`
 * — este arquivo as PROVA, uma a uma:
 *
 *   1. "todas as contas" soma TODAS as contas da família, e transferência
 *      entre contas próprias não move o número;
 *   2. em cartão o acumulado é a dívida acumulada;
 *   3. é saldo de FECHAMENTO do dia, e parte da história anterior à janela.
 *
 * As regras de onde o sinal vem NÃO são novas: são RN-17 (transferência move
 * as duas pontas) e EF-02 §1 (saldo derivado da conta), já provadas em
 * `contas.teste.ts`/`lancamentos.teste.ts`. O que se prova aqui é que o
 * acumulado do extrato usa EXATAMENTE as mesmas, e por isso fecha com
 * `saldoCentavos`.
 *
 * ⚠️ Cada teste cria a PRÓPRIA família. É obrigatório, não estilo: o cenário
 * "todas as contas" soma a família inteira, então uma família compartilhada
 * entre testes faria cada teste novo mudar o resultado dos anteriores.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { fecharBanco } from '../src/db';
import {
  abrirApp,
  cookieDeSessao,
  criarFamiliaComMembro,
  limparBanco,
  subirServidorComRealtime,
  type StackDeTempoReal,
} from './apoio';

const app = abrirApp();

/** Toda mutação de lancamentos emite invalidação (D-04/R3) — o emissor exige a stack de pé. */
let stack: StackDeTempoReal;

beforeAll(async () => {
  await limparBanco();
  stack = await subirServidorComRealtime();
});

afterAll(async () => {
  await stack.encerrar();
  await fecharBanco();
});

interface SaldoDoDia {
  data: string;
  saldoCentavos: number;
}

/** Uma família nova, com sessão aberta — o isolamento de que o cabeçalho fala. */
async function novoCenario(nome: string): Promise<string> {
  const familia = await criarFamiliaComMembro(nome);
  return cookieDeSessao(familia.membroId);
}

async function criarConta(
  cookie: string,
  tipo: 'DEBITO' | 'CREDITO' | 'RESERVA',
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const base =
    tipo === 'CREDITO'
      ? {
          tipo,
          nome: 'Cartão',
          icone: 'cartao',
          cor: '#dc2626',
          limiteCentavos: 500000,
          diaFechamento: 20,
          diaVencimento: 27,
        }
      : { tipo, nome: `Conta ${tipo}`, icone: 'banco', cor: '#2563eb', saldoInicialCentavos: 0 };

  const resposta = await request(app)
    .post('/contas')
    .set('Cookie', cookie)
    .send({ ...base, ...overrides });
  expect(resposta.status).toBe(201);
  return (resposta.body as { id: string }).id;
}

async function criarCategoria(cookie: string): Promise<string> {
  const resposta = await request(app)
    .post('/categorias')
    .set('Cookie', cookie)
    .send({ nome: 'Mercado', icone: 'ti-shopping-cart', cor: '#000000' });
  expect(resposta.status).toBe(201);
  return (resposta.body as { id: string }).id;
}

async function lancar(cookie: string, corpo: Record<string, unknown>): Promise<void> {
  const resposta = await request(app).post('/lancamentos').set('Cookie', cookie).send(corpo);
  expect(resposta.status).toBe(201);
}

async function lerExtrato(
  cookie: string,
  parametros: { competencia?: string; contaId?: string } = {},
): Promise<{ saldosPorDia: SaldoDoDia[]; quantidadeDeLancamentos: number }> {
  const resposta = await request(app).get('/lancamentos').query(parametros).set('Cookie', cookie);
  expect(resposta.status).toBe(200);
  const corpo = resposta.body as { lancamentos: unknown[]; saldosPorDia: SaldoDoDia[] };
  return { saldosPorDia: corpo.saldosPorDia, quantidadeDeLancamentos: corpo.lancamentos.length };
}

/** O saldo que a tela de contas mostra — a referência com que o acumulado tem de fechar. */
async function saldoDaConta(cookie: string, contaId: string): Promise<number> {
  const resposta = await request(app).get('/contas').set('Cookie', cookie);
  expect(resposta.status).toBe(200);
  const { contas } = resposta.body as { contas: { id: string; saldoCentavos: number }[] };
  const conta = contas.find(c => c.id === contaId);
  if (!conta) throw new Error(`conta ${contaId} não voltou na listagem`);
  return conta.saldoCentavos;
}

describe('saldo acumulado por dia — decisão 3: é o FECHAMENTO do dia', () => {
  it('soma os movimentos do dia e carrega o total para o dia seguinte', async () => {
    const cookie = await novoCenario('Fechamento do dia');
    const conta = await criarConta(cookie, 'DEBITO', { saldoInicialCentavos: 100000 });
    const categoria = await criarCategoria(cookie);

    await lancar(cookie, {
      tipo: 'RECEITA', descricao: 'Salário', valorCentavos: 50000, data: '2026-08-05', contaId: conta,
    });
    // DOIS lançamentos no MESMO dia: o dia entra uma vez só, com a soma dos dois.
    await lancar(cookie, {
      tipo: 'DESPESA', descricao: 'Feira', valorCentavos: 20000, data: '2026-08-10', contaId: conta, categoriaId: categoria,
    });
    await lancar(cookie, {
      tipo: 'DESPESA', descricao: 'Padaria', valorCentavos: 5000, data: '2026-08-10', contaId: conta, categoriaId: categoria,
    });

    const { saldosPorDia } = await lerExtrato(cookie, { competencia: '2026-08', contaId: conta });

    expect(saldosPorDia).toEqual([
      { data: '2026-08-05', saldoCentavos: 150000 }, // 100000 inicial + 50000
      { data: '2026-08-10', saldoCentavos: 125000 }, // 150000 − 20000 − 5000
    ]);
  });

  it('o último dia do extrato fecha exatamente com o saldoCentavos da conta', async () => {
    // A prova de que não há duas verdades: o acumulado do extrato e o saldo
    // que a tela de contas mostra saem da MESMA regra de sinal (EF-02 §1).
    const cookie = await novoCenario('Fecha com o saldo da conta');
    const conta = await criarConta(cookie, 'DEBITO', { saldoInicialCentavos: 30000 });
    const categoria = await criarCategoria(cookie);

    await lancar(cookie, {
      tipo: 'DESPESA', descricao: 'Farmácia', valorCentavos: 4500, data: '2026-08-12', contaId: conta, categoriaId: categoria,
    });
    await lancar(cookie, {
      tipo: 'RECEITA', descricao: 'Reembolso', valorCentavos: 1200, data: '2026-08-18', contaId: conta,
    });

    const { saldosPorDia } = await lerExtrato(cookie, { competencia: '2026-08', contaId: conta });
    const ultimo = saldosPorDia.at(-1);

    expect(ultimo?.saldoCentavos).toBe(await saldoDaConta(cookie, conta));
  });

  it('parte da história ANTERIOR à competência, não do zero', async () => {
    // Sem isto o acumulado recomeçaria do zero todo dia 1º e não conferiria
    // com o banco. Julho não aparece no extrato de agosto, mas conta.
    const cookie = await novoCenario('História anterior');
    const conta = await criarConta(cookie, 'DEBITO', { saldoInicialCentavos: 10000 });
    const categoria = await criarCategoria(cookie);

    await lancar(cookie, {
      tipo: 'RECEITA', descricao: 'Julho', valorCentavos: 70000, data: '2026-07-20', contaId: conta,
    });
    await lancar(cookie, {
      tipo: 'DESPESA', descricao: 'Agosto', valorCentavos: 30000, data: '2026-08-03', contaId: conta, categoriaId: categoria,
    });

    const agosto = await lerExtrato(cookie, { competencia: '2026-08', contaId: conta });

    expect(agosto.quantidadeDeLancamentos, 'o extrato de agosto lista só agosto').toBe(1);
    expect(agosto.saldosPorDia).toEqual([
      // 10000 inicial + 70000 de julho − 30000 de agosto
      { data: '2026-08-03', saldoCentavos: 50000 },
    ]);
  });
});

describe('a TRANSFERÊNCIA QUE ENTRA — o filtro por conta olha as duas pontas', () => {
  it('a conta RESERVA de destino mostra a entrada, e o acumulado sobe', async () => {
    // Antes desta história o extrato de uma reserva vinha SEMPRE vazio: o
    // filtro só olhava `contaId` (a origem), e guardar numa meta é uma
    // transferência com a reserva como DESTINO.
    const cookie = await novoCenario('Entrada na reserva');
    const corrente = await criarConta(cookie, 'DEBITO', { saldoInicialCentavos: 200000 });
    const reserva = await criarConta(cookie, 'RESERVA', { saldoInicialCentavos: 0 });

    await lancar(cookie, {
      tipo: 'TRANSFERENCIA', descricao: 'Guardar', valorCentavos: 30000,
      data: '2026-08-09', contaId: corrente, contaDestinoId: reserva,
    });

    const naReserva = await lerExtrato(cookie, { competencia: '2026-08', contaId: reserva });
    expect(naReserva.quantidadeDeLancamentos, 'a entrada tem de aparecer no extrato da reserva').toBe(1);
    expect(naReserva.saldosPorDia).toEqual([{ data: '2026-08-09', saldoCentavos: 30000 }]);

    // E a MESMA linha, vista da origem, é saída.
    const naCorrente = await lerExtrato(cookie, { competencia: '2026-08', contaId: corrente });
    expect(naCorrente.saldosPorDia).toEqual([{ data: '2026-08-09', saldoCentavos: 170000 }]);
  });
});

describe('decisão 2 — em CARTÃO o acumulado é a dívida acumulada', () => {
  it('a compra soma à dívida e o pagamento da fatura abate', async () => {
    const cookie = await novoCenario('Dívida do cartão');
    const corrente = await criarConta(cookie, 'DEBITO', { saldoInicialCentavos: 100000 });
    const cartao = await criarConta(cookie, 'CREDITO');
    const categoria = await criarCategoria(cookie);

    await lancar(cookie, {
      tipo: 'DESPESA', descricao: 'Compra no crédito', valorCentavos: 20000,
      data: '2026-08-03', contaId: cartao, categoriaId: categoria,
    });
    // RN-24 — pagar a fatura é uma TRANSFERENCIA com o cartão como destino.
    await lancar(cookie, {
      tipo: 'TRANSFERENCIA', descricao: 'Pagamento da fatura', valorCentavos: 20000,
      data: '2026-08-25', contaId: corrente, contaDestinoId: cartao,
    });

    const { saldosPorDia, quantidadeDeLancamentos } = await lerExtrato(cookie, {
      competencia: '2026-08',
      contaId: cartao,
    });

    expect(quantidadeDeLancamentos, 'a compra E o pagamento aparecem no extrato do cartão').toBe(2);
    expect(saldosPorDia).toEqual([
      { data: '2026-08-03', saldoCentavos: -20000 }, // dívida — negativo é legítimo aqui
      { data: '2026-08-25', saldoCentavos: 0 }, // fatura paga, dívida zerada
    ]);
  });
});

describe('decisão 1 — "todas as contas" soma a família inteira', () => {
  it('a transferência entre contas próprias NÃO move o acumulado', async () => {
    // As duas pontas são da família (`criarLancamento` recusa destino de
    // fora), então o dinheiro só mudou de bolso: o patrimônio do dia é o
    // mesmo. A linha aparece na lista sem mover o número — é o correto.
    const cookie = await novoCenario('Todas as contas');
    const corrente = await criarConta(cookie, 'DEBITO', { saldoInicialCentavos: 0 });
    const reserva = await criarConta(cookie, 'RESERVA', { saldoInicialCentavos: 0 });

    await lancar(cookie, {
      tipo: 'RECEITA', descricao: 'Salário', valorCentavos: 100000, data: '2026-08-02', contaId: corrente,
    });
    await lancar(cookie, {
      tipo: 'TRANSFERENCIA', descricao: 'Guardar', valorCentavos: 30000,
      data: '2026-08-10', contaId: corrente, contaDestinoId: reserva,
    });

    const { saldosPorDia } = await lerExtrato(cookie, { competencia: '2026-08' });

    expect(saldosPorDia).toEqual([
      { data: '2026-08-02', saldoCentavos: 100000 },
      { data: '2026-08-10', saldoCentavos: 100000 }, // a transferência soma zero
    ]);
  });

  it('soma o saldo inicial de TODAS as contas, cartão e reserva inclusive', async () => {
    const cookie = await novoCenario('Soma de saldos iniciais');
    await criarConta(cookie, 'DEBITO', { saldoInicialCentavos: 40000 });
    await criarConta(cookie, 'RESERVA', { saldoInicialCentavos: 25000 });
    // Cartão não tem saldo inicial (EF-02 §1) — entra como zero, não quebra a soma.
    const cartao = await criarConta(cookie, 'CREDITO');
    const categoria = await criarCategoria(cookie);

    await lancar(cookie, {
      tipo: 'DESPESA', descricao: 'Compra no crédito', valorCentavos: 15000,
      data: '2026-08-07', contaId: cartao, categoriaId: categoria,
    });

    const { saldosPorDia } = await lerExtrato(cookie, { competencia: '2026-08' });

    // 40000 + 25000 + 0 − 15000
    expect(saldosPorDia).toEqual([{ data: '2026-08-07', saldoCentavos: 50000 }]);
  });
});

describe('isolamento entre famílias', () => {
  it('o movimento de outra família não entra no acumulado', async () => {
    const cookieA = await novoCenario('Família A do acumulado');
    const cookieB = await novoCenario('Família B do acumulado');

    const contaA = await criarConta(cookieA, 'DEBITO', { saldoInicialCentavos: 10000 });
    const contaB = await criarConta(cookieB, 'DEBITO', { saldoInicialCentavos: 999999 });

    await lancar(cookieA, {
      tipo: 'RECEITA', descricao: 'Da A', valorCentavos: 5000, data: '2026-08-04', contaId: contaA,
    });
    await lancar(cookieB, {
      tipo: 'RECEITA', descricao: 'Da B', valorCentavos: 777777, data: '2026-08-04', contaId: contaB,
    });

    const deA = await lerExtrato(cookieA, { competencia: '2026-08' });
    expect(deA.saldosPorDia).toEqual([{ data: '2026-08-04', saldoCentavos: 15000 }]);
  });
});
