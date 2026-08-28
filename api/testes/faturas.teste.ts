/**
 * Integração de `faturas` (EF-05/tarefa #70) — Postgres de verdade, HTTP real.
 *
 * ⛔ Regra #0: RN-23..RN-26 e D1 vêm de
 * `.preator/skills/negocio/faturas-e-ciclo-do-cartao/SKILL.md`, citando
 * `docs/especificacoes/EF-05-faturas.md` §1/§2/§5 (o Definition of Done) como
 * fonte primária. Os seis casos obrigatórios do DoD (§5) mapeiam para os
 * `describe` abaixo, um a um.
 *
 * ⛔ Esta suíte NÃO é `api/testes/faturas-ciclo.teste.ts` — essa é a pasta
 * disjunta da tarefa #72 (qa), que escreve ali os mesmos seis casos do DoD
 * com outra profundidade. Este arquivo é o meu (tarefa #70/backend).
 *
 * As datas de teste ficam DELIBERADAMENTE no passado (agosto/2026, com o
 * relógio real do ambiente em 2026-08-28) para que "compra no dia do
 * fechamento"/"dia seguinte" caiam em ciclos JÁ FECHADOS, e o ciclo CORRENTE
 * seja calculado com as mesmas funções puras do domínio
 * (`fechaEmDoCiclo`/`hojeIso`) em vez de uma data futura hardcoded — a
 * suíte fica correta não importa em que dia real ela rodar.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { fecharBanco } from '../src/db';
import { fechaEmDoCiclo, hojeIso } from '../src/modulos/faturas/dominio';
import { emitirInvalidacao } from '../src/realtime/emissor';
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
// Toda mutação de fatura emite invalidação (D-04/R3), e o emissor exige o
// servidor de tempo real DE PÉ — mesmo padrão de `testes/contas.teste.ts`.
let stack: StackDeTempoReal;

beforeAll(async () => {
  await limparBanco();
  familiaA = await criarFamiliaComMembro('Família A das faturas');
  familiaB = await criarFamiliaComMembro('Família B das faturas');
  cookieA = await cookieDeSessao(familiaA.membroId);
  cookieB = await cookieDeSessao(familiaB.membroId);
  stack = await subirServidorComRealtime();
});

afterAll(async () => {
  await stack.encerrar();
  await fecharBanco();
});

const DIA_FECHAMENTO = 5;
const DIA_VENCIMENTO = 15; // 15 > 5 ⇒ venceEm cai no MESMO mês de fechaEm.

const HOJE = hojeIso();
/** O ciclo CORRENTE, calculado — nunca hardcoded — a partir do relógio real. */
const FECHA_EM_CORRENTE = fechaEmDoCiclo(DIA_FECHAMENTO, HOJE);

/** Só para não espalhar `!` pelo arquivo (proibido pelo lint) num `.find()` que o próprio teste garante que existe. */
function obrigatorio<T>(valor: T | undefined, mensagem: string): T {
  if (valor === undefined) throw new Error(mensagem);
  return valor;
}

interface Fatura {
  id: string;
  contaId: string;
  abreEm: string;
  fechaEm: string;
  venceEm: string;
  status: string;
  totalCentavos: number;
  pagaEm: string | null;
  pagaComContaId: string | null;
  itens: { id: string; numeroParcela: number | null }[];
}

function faturaDoCiclo(faturas: Fatura[], fechaEm: string): Fatura {
  return obrigatorio(
    faturas.find(f => f.fechaEm === fechaEm),
    `nenhuma fatura com fechaEm=${fechaEm} na resposta`,
  );
}

async function novaCategoria(cookie: string, nome: string): Promise<string> {
  const resposta = await request(app)
    .post('/categorias')
    .set('Cookie', cookie)
    .send({ nome, icone: 'x', cor: '#000' });
  return resposta.body.id as string;
}

async function novoCartao(
  cookie: string,
  nome = 'Cartão de teste',
  limiteCentavos = 500000,
): Promise<string> {
  const resposta = await request(app).post('/contas').set('Cookie', cookie).send({
    tipo: 'CREDITO',
    nome,
    icone: 'cartao',
    cor: '#dc2626',
    limiteCentavos,
    diaFechamento: DIA_FECHAMENTO,
    diaVencimento: DIA_VENCIMENTO,
  });
  return resposta.body.id as string;
}

async function novaContaDebito(
  cookie: string,
  nome = 'Conta corrente',
  saldoInicialCentavos = 200000,
): Promise<string> {
  const resposta = await request(app).post('/contas').set('Cookie', cookie).send({
    tipo: 'DEBITO',
    nome,
    icone: 'banco',
    cor: '#2563eb',
    saldoInicialCentavos,
  });
  return resposta.body.id as string;
}

interface DadosDeDespesa {
  cookie: string;
  contaId: string;
  categoriaId: string;
  data: string;
  valorCentavos: number;
  descricao?: string;
}

async function novaDespesa(dados: DadosDeDespesa): Promise<string> {
  const resposta = await request(app)
    .post('/lancamentos')
    .set('Cookie', dados.cookie)
    .send({
      tipo: 'DESPESA',
      descricao: dados.descricao ?? 'Compra',
      valorCentavos: dados.valorCentavos,
      data: dados.data,
      contaId: dados.contaId,
      categoriaId: dados.categoriaId,
    });
  const criado = (resposta.body.lancamentos as { id: string }[])[0];
  return obrigatorio(criado, 'POST /lancamentos não devolveu nenhum lançamento criado').id;
}

// ---------------------------------------------------------------------------
// DoD 1/2 — RN-23: compra NO dia do fechamento vs no dia SEGUINTE.
// ---------------------------------------------------------------------------

describe('RN-23 — a compra entra na fatura cujo ciclo de fechamento contém a data', () => {
  it('compra no dia do fechamento cai no ciclo que fecha HOJE; no dia seguinte, cai no ciclo SEGUINTE', async () => {
    const cookie = cookieA;
    const categoriaId = await novaCategoria(cookie, 'RN-23 categoria');
    const cartaoId = await novoCartao(cookie, 'RN-23 cartão');

    // dia-do-mês igual a diaFechamento (5): cai no ciclo que fecha em 2026-08-05.
    const idNoFechamento = await novaDespesa({
      cookie,
      contaId: cartaoId,
      categoriaId,
      data: '2026-08-05',
      valorCentavos: 10000,
      descricao: 'No fechamento',
    });
    // dia-do-mês estritamente maior (6): cai no ciclo SEGUINTE (fechaEm 2026-09-05).
    const idDiaSeguinte = await novaDespesa({
      cookie,
      contaId: cartaoId,
      categoriaId,
      data: '2026-08-06',
      valorCentavos: 7000,
      descricao: 'Dia seguinte',
    });

    const resposta = await request(app).get('/faturas').query({ contaId: cartaoId }).set('Cookie', cookie);
    expect(resposta.status).toBe(200);

    const faturas = resposta.body.faturas as Fatura[];
    expect(faturas).toHaveLength(2);

    const faturaFechada = faturaDoCiclo(faturas, '2026-08-05');
    expect(faturaFechada.status).toBe('FECHADA');
    expect(faturaFechada.itens.map(i => i.id)).toEqual([idNoFechamento]);
    expect(faturaFechada.totalCentavos).toBe(10000);

    // A compra do dia seguinte NÃO está na mesma fatura — está na fatura
    // seguinte, que por sua vez é a fatura CORRENTE (ainda ABERTA) hoje.
    const faturaSeguinte = faturaDoCiclo(faturas, FECHA_EM_CORRENTE);
    expect(faturaSeguinte.status).toBe('ABERTA');
    expect(faturaSeguinte.itens.map(i => i.id)).toEqual([idDiaSeguinte]);
    expect(faturaSeguinte.totalCentavos).toBe(7000);
  });
});

// ---------------------------------------------------------------------------
// DoD 3 — parcela que atravessa ciclos: cada parcela resolvida
// independentemente, pela MESMA regra de RN-23.
// ---------------------------------------------------------------------------

describe('parcela que atravessa ciclos', () => {
  it('cada parcela cai na fatura do SEU PRÓPRIO ciclo — não há tratamento especial de "série atravessando ciclo"', async () => {
    const cookie = cookieA;
    const categoriaId = await novaCategoria(cookie, 'Parcelamento categoria');
    const cartaoId = await novoCartao(cookie, 'Parcelamento cartão');

    // 1ª parcela em 2026-08-04 (fecha em 2026-08-05, JÁ FECHADA); a 2ª cai um
    // mês depois — 2026-09-04 — cujo ciclo (fechaEm 2026-09-05) é EXATAMENTE
    // o ciclo CORRENTE hoje (verificado no describe acima).
    const resposta = await request(app).post('/lancamentos').set('Cookie', cookie).send({
      tipo: 'DESPESA',
      descricao: 'Compra parcelada',
      valorCentavos: 9000,
      data: '2026-08-04',
      contaId: cartaoId,
      categoriaId,
      quantidadeParcelas: 3,
    });
    expect(resposta.status).toBe(201);
    const parcelas = resposta.body.lancamentos as { id: string; numeroParcela: number; data: string }[];
    const parcela1 = obrigatorio(
      parcelas.find(p => p.numeroParcela === 1),
      'parcela 1 não veio na resposta',
    );
    const parcela2 = obrigatorio(
      parcelas.find(p => p.numeroParcela === 2),
      'parcela 2 não veio na resposta',
    );

    const leitura = await request(app).get('/faturas').query({ contaId: cartaoId }).set('Cookie', cookie);
    const faturas = leitura.body.faturas as Fatura[];

    const faturaDaParcela1 = faturaDoCiclo(faturas, fechaEmDoCiclo(DIA_FECHAMENTO, parcela1.data));
    const faturaDaParcela2 = faturaDoCiclo(faturas, fechaEmDoCiclo(DIA_FECHAMENTO, parcela2.data));

    expect(faturaDaParcela1.itens.map(i => i.id)).toContain(parcela1.id);
    expect(faturaDaParcela2.itens.map(i => i.id)).toContain(parcela2.id);
    // As duas parcelas caem em faturas DIFERENTES — não há uma fatura só
    // "da série".
    expect(faturaDaParcela1.fechaEm).not.toBe(faturaDaParcela2.fechaEm);
  });
});

// ---------------------------------------------------------------------------
// DoD 4/RN-24 — pagar NÃO reatribui lançamentos; o extrato por cartão
// continua correto depois do pagamento.
// ---------------------------------------------------------------------------

describe('RN-24 — pagar é transferência; os lançamentos originais mantêm sua conta', () => {
  it('após pagar, a compra original CONTINUA com contaId = cartão (não reatribuída), e um NOVO lançamento TRANSFERENCIA aparece', async () => {
    const cookie = cookieA;
    const categoriaId = await novaCategoria(cookie, 'RN-24 categoria');
    const cartaoId = await novoCartao(cookie, 'RN-24 cartão');
    const contaCorrenteId = await novaContaDebito(cookie, 'RN-24 conta corrente', 100000);

    const idDaCompra = await novaDespesa({
      cookie,
      contaId: cartaoId,
      categoriaId,
      data: '2026-08-05',
      valorCentavos: 20000,
      descricao: 'RN-24 compra',
    });

    const antesDoPagamento = await request(app).get('/lancamentos').set('Cookie', cookie).query({ contaId: cartaoId });
    expect((antesDoPagamento.body.lancamentos as { id: string }[]).map(l => l.id)).toContain(idDaCompra);

    const leitura = await request(app).get('/faturas').query({ contaId: cartaoId }).set('Cookie', cookie);
    const faturaFechada = faturaDoCiclo(leitura.body.faturas as Fatura[], '2026-08-05');
    expect(faturaFechada.totalCentavos).toBe(20000);

    const pagamento = await request(app)
      .post(`/faturas/${faturaFechada.id}/pagar`)
      .set('Cookie', cookie)
      .send({ pagaComContaId: contaCorrenteId });
    expect(pagamento.status).toBe(200);
    expect(pagamento.body.status).toBe('PAGA');
    expect(pagamento.body.pagaComContaId).toBe(contaCorrenteId);
    expect(pagamento.body.totalCentavos).toBe(20000);

    // ⛔ A ARMADILHA 1 (EF-05 §4): o protótipo faz
    // `lancs.map(l => l.conta === id ? { ...l, conta: contaPagadora } : l)`.
    // Aqui a compra original PRECISA continuar com contaId = cartão.
    const depoisDoPagamento = await request(app)
      .get('/lancamentos')
      .set('Cookie', cookie)
      .query({ contaId: cartaoId });
    const compraOriginal = (depoisDoPagamento.body.lancamentos as { id: string; contaId: string; tipo: string }[]).find(
      l => l.id === idDaCompra,
    );
    expect(compraOriginal).toBeDefined();
    expect(compraOriginal?.contaId).toBe(cartaoId);
    expect(compraOriginal?.tipo).toBe('DESPESA');

    // O pagamento em si é um lançamento NOVO — TRANSFERENCIA, contaCorrente → cartão.
    const extratoDaCorrente = await request(app)
      .get('/lancamentos')
      .set('Cookie', cookie)
      .query({ contaId: contaCorrenteId });
    const transferenciaDePagamento = (
      extratoDaCorrente.body.lancamentos as { tipo: string; contaDestinoId: string | null; valorCentavos: number }[]
    ).find(l => l.tipo === 'TRANSFERENCIA' && l.contaDestinoId === cartaoId);
    expect(transferenciaDePagamento).toBeDefined();
    expect(transferenciaDePagamento?.valorCentavos).toBe(20000);

    // Saldo derivado das DUAS pontas mexeu (RN-24 é transferência real).
    const contas = await request(app).get('/contas').set('Cookie', cookie);
    const linhaCorrente = (contas.body.contas as { id: string; saldoCentavos: number }[]).find(
      c => c.id === contaCorrenteId,
    );
    const linhaCartao = (contas.body.contas as { id: string; saldoCentavos: number }[]).find(c => c.id === cartaoId);
    expect(linhaCorrente?.saldoCentavos).toBe(100000 - 20000);
    expect(linhaCartao?.saldoCentavos).toBe(0); // quitado — sem outras compras neste cartão.

    // A fatura paga some da lista "em aberto" (D1) — só ABERTA/FECHADA aparecem.
    const leituraDepois = await request(app).get('/faturas').query({ contaId: cartaoId }).set('Cookie', cookie);
    expect((leituraDepois.body.faturas as { id: string }[]).map(f => f.id)).not.toContain(faturaFechada.id);

    // Pagar de novo é 409 — nunca paga duas vezes.
    const segundoPagamento = await request(app)
      .post(`/faturas/${faturaFechada.id}/pagar`)
      .set('Cookie', cookie)
      .send({ pagaComContaId: contaCorrenteId });
    expect(segundoPagamento.status).toBe(409);
    expect(segundoPagamento.body.erro).toBe('fatura_ja_paga');
  });

  it('D3 — a conta pagadora vem do REQUEST (o usuário escolhe), não é a primeira conta de débito', async () => {
    const cookie = cookieA;
    const categoriaId = await novaCategoria(cookie, 'D3 categoria');
    const cartaoId = await novoCartao(cookie, 'D3 cartão');
    // DUAS contas de débito — a primeira NÃO é a escolhida, provando que não
    // há a inferência do protótipo (`s.contas.find(a => a.tipo === 'debito')`).
    await novaContaDebito(cookie, 'D3 primeira conta (não escolhida)', 50000);
    const segundaConta = await novaContaDebito(cookie, 'D3 segunda conta (escolhida)', 90000);

    await novaDespesa({
      cookie,
      contaId: cartaoId,
      categoriaId,
      data: '2026-08-05',
      valorCentavos: 15000,
      descricao: 'D3 compra',
    });
    const leitura = await request(app).get('/faturas').query({ contaId: cartaoId }).set('Cookie', cookie);
    const fatura = faturaDoCiclo(leitura.body.faturas as Fatura[], '2026-08-05');

    const pagamento = await request(app)
      .post(`/faturas/${fatura.id}/pagar`)
      .set('Cookie', cookie)
      .send({ pagaComContaId: segundaConta });

    expect(pagamento.status).toBe(200);
    expect(pagamento.body.pagaComContaId).toBe(segundaConta);
  });

  it('pagar com o próprio cartão como conta pagadora responde 400', async () => {
    const cookie = cookieA;
    const categoriaId = await novaCategoria(cookie, 'auto-pagamento categoria');
    const cartaoId = await novoCartao(cookie, 'auto-pagamento cartão');
    await novaDespesa({ cookie, contaId: cartaoId, categoriaId, data: '2026-08-05', valorCentavos: 1000, descricao: 'auto' });
    const leitura = await request(app).get('/faturas').query({ contaId: cartaoId }).set('Cookie', cookie);
    const fatura = faturaDoCiclo(leitura.body.faturas as Fatura[], '2026-08-05');

    const pagamento = await request(app)
      .post(`/faturas/${fatura.id}/pagar`)
      .set('Cookie', cookie)
      .send({ pagaComContaId: cartaoId });

    expect(pagamento.status).toBe(400);
    expect(pagamento.body.erro).toBe('conta_pagadora_igual_ao_cartao');
  });

  it('pagar uma fatura inexistente responde 404', async () => {
    const resposta = await request(app)
      .post('/faturas/00000000-0000-0000-0000-000000000000/pagar')
      .set('Cookie', cookieA)
      .send({ pagaComContaId: '00000000-0000-0000-0000-000000000001' });
    expect(resposta.status).toBe(404);
    expect(resposta.body.erro).toBe('fatura_nao_encontrada');
  });
});

// ---------------------------------------------------------------------------
// DoD 5/D1 — limite livre reflete TODA fatura não paga (ABERTA + FECHADA),
// não só o ciclo corrente — a leitura estreita que D1 rejeitou.
// ---------------------------------------------------------------------------

describe('RN-25/RN-26 — D1: "fatura em aberto" é ABERTA + FECHADA, nunca só o ciclo corrente', () => {
  it('limiteLivreCentavos desconta a fatura FECHADA aguardando pagamento, não só a corrente', async () => {
    const cookie = cookieA;
    const categoriaId = await novaCategoria(cookie, 'D1 categoria');
    const limite = 500000;
    const cartaoId = await novoCartao(cookie, 'D1 cartão', limite);

    // Fatura FECHADA (ciclo já fechou, ainda não paga) — exemplo numérico da
    // skill (julho R$800/agosto R$300), com estes valores.
    await novaDespesa({
      cookie,
      contaId: cartaoId,
      categoriaId,
      data: '2026-08-01',
      valorCentavos: 80000,
      descricao: 'D1 fechada',
    });
    // Fatura ABERTA (ciclo corrente, ainda acumulando).
    await novaDespesa({
      cookie,
      contaId: cartaoId,
      categoriaId,
      data: '2026-08-27',
      valorCentavos: 30000,
      descricao: 'D1 corrente',
    });

    const leitura = await request(app).get('/faturas').query({ contaId: cartaoId }).set('Cookie', cookie);
    expect(leitura.status).toBe(200);
    expect(leitura.body.limiteCentavos).toBe(limite);

    const faturas = leitura.body.faturas as Fatura[];
    expect(faturas).toHaveLength(2);
    const fechada = obrigatorio(
      faturas.find(f => f.status === 'FECHADA'),
      'esperava uma fatura FECHADA',
    );
    const aberta = obrigatorio(
      faturas.find(f => f.status === 'ABERTA'),
      'esperava uma fatura ABERTA',
    );
    expect(fechada.totalCentavos).toBe(80000);
    expect(aberta.totalCentavos).toBe(30000);

    // D1 — o valor CORRETO desconta as DUAS.
    expect(leitura.body.limiteLivreCentavos).toBe(limite - (80000 + 30000));
    // E é DIFERENTE do que a leitura ESTREITA de RN-25 (só o ciclo corrente)
    // produziria — essa é exatamente a ambiguidade que D1 resolve.
    expect(leitura.body.limiteLivreCentavos).not.toBe(limite - 30000);
  });

  it('sem nenhuma compra, limiteLivreCentavos é o limite inteiro', async () => {
    const cookie = cookieA;
    const limite = 200000;
    const cartaoId = await novoCartao(cookie, 'D1 cartão vazio', limite);
    const leitura = await request(app).get('/faturas').query({ contaId: cartaoId }).set('Cookie', cookie);
    expect(leitura.body.limiteLivreCentavos).toBe(limite);
    // Mesmo sem compra, a fatura do ciclo CORRENTE aparece (a tela sempre tem "a fatura de agora").
    expect(leitura.body.faturas).toHaveLength(1);
    expect(leitura.body.faturas[0].status).toBe('ABERTA');
    expect(leitura.body.faturas[0].totalCentavos).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Validações de borda.
// ---------------------------------------------------------------------------

describe('validações', () => {
  it('GET /faturas sem contaId responde 422', async () => {
    const resposta = await request(app).get('/faturas').set('Cookie', cookieA);
    expect(resposta.status).toBe(422);
  });

  it('GET /faturas de uma conta que não é CREDITO responde 404', async () => {
    const contaId = await novaContaDebito(cookieA, 'Não é cartão');
    const resposta = await request(app).get('/faturas').query({ contaId }).set('Cookie', cookieA);
    expect(resposta.status).toBe(404);
  });

  it('sem sessão, GET /faturas responde 401', async () => {
    const resposta = await request(app).get('/faturas').query({ contaId: 'qualquer' });
    expect(resposta.status).toBe(401);
  });

  it('sem sessão, POST /faturas/:id/pagar responde 401', async () => {
    const resposta = await request(app)
      .post('/faturas/00000000-0000-0000-0000-000000000000/pagar')
      .send({ pagaComContaId: '00000000-0000-0000-0000-000000000001' });
    expect(resposta.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// DoD 6a — isolamento entre famílias.
// ---------------------------------------------------------------------------

describe('isolamento entre famílias', () => {
  it('a família B não vê a fatura do cartão da família A (404, não 200 nem 403)', async () => {
    const cartaoDeA = await novoCartao(cookieA, 'Só de A');
    const resposta = await request(app).get('/faturas').query({ contaId: cartaoDeA }).set('Cookie', cookieB);
    expect(resposta.status).toBe(404);
  });

  it('a família B não consegue pagar a fatura da família A', async () => {
    const cookie = cookieA;
    const categoriaId = await novaCategoria(cookie, 'Isolamento categoria');
    const cartaoId = await novoCartao(cookie, 'Isolamento cartão');
    await novaDespesa({
      cookie,
      contaId: cartaoId,
      categoriaId,
      data: '2026-08-05',
      valorCentavos: 5000,
      descricao: 'Isolamento compra',
    });
    const leitura = await request(app).get('/faturas').query({ contaId: cartaoId }).set('Cookie', cookieA);
    const fatura = faturaDoCiclo(leitura.body.faturas as Fatura[], '2026-08-05');

    const contaDeB = await novaContaDebito(cookieB, 'Conta de B');
    const resposta = await request(app)
      .post(`/faturas/${fatura.id}/pagar`)
      .set('Cookie', cookieB)
      .send({ pagaComContaId: contaDeB });

    expect(resposta.status).toBe(404);
    expect(resposta.body.erro).toBe('fatura_nao_encontrada');
  });
});

// ---------------------------------------------------------------------------
// DoD 6b — dois clientes da MESMA família veem o pagamento sem refresh.
// ---------------------------------------------------------------------------

describe('tempo real — o pagamento invalida sem refresh', () => {
  it('emitirInvalidacao(recurso: "faturas") chega à família dona, e só a ela', async () => {
    const { io: conectarCliente } = await import('socket.io-client');
    const { CAMINHO_REALTIME } = await import('../src/realtime/servidor');

    const socketA = conectarCliente(stack.url, {
      path: CAMINHO_REALTIME,
      transports: ['websocket'],
      extraHeaders: { Cookie: cookieA },
      reconnection: false,
    });
    const socketB = conectarCliente(stack.url, {
      path: CAMINHO_REALTIME,
      transports: ['websocket'],
      extraHeaders: { Cookie: cookieB },
      reconnection: false,
    });

    await Promise.all(
      [socketA, socketB].map(
        s =>
          new Promise<void>((resolver, rejeitar) => {
            s.once('connect', () => resolver());
            s.once('connect_error', rejeitar);
            setTimeout(() => rejeitar(new Error('timeout de conexão')), 8000);
          }),
      ),
    );

    try {
      const recebidoPorA: unknown[] = [];
      const recebidoPorB: unknown[] = [];
      socketA.on('recurso.alterado', (e: unknown) => recebidoPorA.push(e));
      socketB.on('recurso.alterado', (e: unknown) => recebidoPorB.push(e));

      // Aqui usamos `emitirInvalidacao` diretamente (mesmo padrão de
      // `testes/realtime.teste.ts`) para isolar a PROPAGAÇÃO do evento do
      // resto do fluxo HTTP, que já é exercitado pelos testes de pagamento
      // acima (`POST /faturas/:id/pagar` chama exatamente esta função).
      emitirInvalidacao({ familiaId: familiaA.familiaId, recurso: 'faturas', origemClienteId: 'aba-do-pagamento' });

      await new Promise(r => setTimeout(r, 400));

      expect(recebidoPorA).toHaveLength(1);
      expect(recebidoPorA[0]).toMatchObject({ recurso: 'faturas' });
      // A família B, dona de outro cartão, NÃO recebe o evento de A.
      expect(recebidoPorB).toHaveLength(0);
    } finally {
      socketA.close();
      socketB.close();
    }
  });

  it('POST /faturas/:id/pagar de fato emite a invalidação de "faturas" para quem está na sala da família', async () => {
    const { io: conectarCliente } = await import('socket.io-client');
    const { CAMINHO_REALTIME } = await import('../src/realtime/servidor');

    const cookie = cookieA;
    const categoriaId = await novaCategoria(cookie, 'Tempo real categoria');
    const cartaoId = await novoCartao(cookie, 'Tempo real cartão');
    const contaCorrenteId = await novaContaDebito(cookie, 'Tempo real conta corrente', 50000);
    await novaDespesa({
      cookie,
      contaId: cartaoId,
      categoriaId,
      data: '2026-08-05',
      valorCentavos: 4000,
      descricao: 'Tempo real compra',
    });
    const leitura = await request(app).get('/faturas').query({ contaId: cartaoId }).set('Cookie', cookie);
    const fatura = faturaDoCiclo(leitura.body.faturas as Fatura[], '2026-08-05');

    // Uma SEGUNDA sessão da MESMA família — "dois clientes veem sem refresh".
    const cookieOutraAba = await cookieDeSessao(familiaA.membroId);
    const socket = conectarCliente(stack.url, {
      path: CAMINHO_REALTIME,
      transports: ['websocket'],
      extraHeaders: { Cookie: cookieOutraAba },
      reconnection: false,
    });
    await new Promise<void>((resolver, rejeitar) => {
      socket.once('connect', () => resolver());
      socket.once('connect_error', rejeitar);
      setTimeout(() => rejeitar(new Error('timeout de conexão')), 8000);
    });

    try {
      const recebidos: { recurso: string }[] = [];
      socket.on('recurso.alterado', (e: { recurso: string }) => recebidos.push(e));

      const pagamento = await request(stack.http)
        .post(`/faturas/${fatura.id}/pagar`)
        .set('Cookie', cookie)
        .send({ pagaComContaId: contaCorrenteId });
      expect(pagamento.status).toBe(200);

      await new Promise(r => setTimeout(r, 400));

      expect(recebidos.some(e => e.recurso === 'faturas')).toBe(true);
      expect(recebidos.some(e => e.recurso === 'contas')).toBe(true);
    } finally {
      socket.close();
    }
  });
});
