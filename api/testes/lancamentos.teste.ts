/**
 * Integração de `lancamentos` (EF-04/tarefa #52) — Postgres de verdade, HTTP
 * real.
 *
 * ⛔ Regra #0: RN-15..RN-22/RN-39 testadas aqui vêm de
 * `.preator/skills/negocio/lancamentos-e-parcelamento/SKILL.md` (glossário e
 * tabela "Regras de negócio"), que cita `docs/especificacoes/EF-04-lancamentos.md`
 * §1/§2 e `docs/decisoes/D-06-dinheiro-em-centavos.md` como fonte primária.
 * Nenhuma regra testada aqui foi inventada.
 *
 * RN-22 (competência selada) é a EXCEÇÃO explícita: `FechamentoMes` é da
 * EF-08 (#22), ainda não construída — o caso POSITIVO (lançamento de fato
 * recusado) não tem como ser provado aqui. O que se prova é que o ponto de
 * checagem (`competenciaEstaSelada`, `modulos/lancamentos/servico.ts`) está
 * no lugar certo e hoje sempre libera a escrita — mesmo padrão do teste de
 * RN-06 em `contas.teste.ts`.
 */
import { eq } from 'drizzle-orm';
import { io as conectarCliente, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { db, fecharBanco } from '../src/db';
import { lancamentos, seriesParcelas } from '../src/db/schema';
import { competenciaEstaSelada } from '../src/modulos/lancamentos/servico';
import { CAMINHO_REALTIME } from '../src/realtime/servidor';
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
// Toda mutação de lancamentos emite invalidação (D-04/R3), e o emissor exige
// o servidor de tempo real DE PÉ — mesmo padrão de `testes/orcamento.teste.ts`.
let stack: StackDeTempoReal;

beforeAll(async () => {
  await limparBanco();
  familiaA = await criarFamiliaComMembro('Família A dos lançamentos');
  familiaB = await criarFamiliaComMembro('Família B dos lançamentos');
  cookieA = await cookieDeSessao(familiaA.membroId);
  cookieB = await cookieDeSessao(familiaB.membroId);
  stack = await subirServidorComRealtime();
});

afterAll(async () => {
  await stack.encerrar();
  await fecharBanco();
});

interface ContaCriada {
  id: string;
}
interface CategoriaCriada {
  id: string;
}
interface LancamentoLido {
  id: string;
  tipo: 'RECEITA' | 'DESPESA' | 'TRANSFERENCIA';
  descricao: string;
  valorCentavos: number;
  data: string;
  competencia: string;
  categoriaId: string | null;
  contaId: string;
  contaDestinoId: string | null;
  criadoPorMembroId: string;
  serieParcelaId: string | null;
  numeroParcela: number | null;
  quantidadeParcelas: number | null;
  criadoEm: string;
}

async function criarConta(
  cookie: string,
  tipo: 'DEBITO' | 'CREDITO' | 'RESERVA' = 'DEBITO',
  overrides: Record<string, unknown> = {},
): Promise<ContaCriada> {
  const base =
    tipo === 'CREDITO'
      ? { tipo, nome: 'Cartão', icone: 'cartao', cor: '#dc2626', limiteCentavos: 500000, diaFechamento: 20, diaVencimento: 27 }
      : { tipo, nome: 'Conta', icone: 'banco', cor: '#2563eb', saldoInicialCentavos: 0 };
  const resposta = await request(app).post('/contas').set('Cookie', cookie).send({ ...base, ...overrides });
  expect(resposta.status).toBe(201);
  return resposta.body as ContaCriada;
}

async function criarCategoria(cookie: string, nome: string): Promise<CategoriaCriada> {
  const resposta = await request(app)
    .post('/categorias')
    .set('Cookie', cookie)
    .send({ nome, icone: 'estrela', cor: '#000000' });
  expect(resposta.status).toBe(201);
  return resposta.body as CategoriaCriada;
}

function postLancamento(cookie: string, corpo: Record<string, unknown>) {
  return request(app).post('/lancamentos').set('Cookie', cookie).send(corpo);
}

describe('RN-16 — todo lançamento registra o autor (criadoPorMembroId), imutável', () => {
  it('grava o membro da SESSÃO como autor, nunca um valor do corpo', async () => {
    const conta = await criarConta(cookieA);
    const resposta = await postLancamento(cookieA, {
      tipo: 'RECEITA',
      descricao: 'Salário',
      valorCentavos: 500000,
      data: '2026-08-05',
      contaId: conta.id,
      // Tentativa de forjar o autor — precisa ser ignorada.
      criadoPorMembroId: '00000000-0000-0000-0000-000000000000',
    });

    expect(resposta.status).toBe(201);
    const [lancamento] = resposta.body.lancamentos as LancamentoLido[];
    expect(lancamento?.criadoPorMembroId).toBe(familiaA.membroId);
  });

  it('não existe endpoint de edição — o único jeito de mudar um lançamento é excluir e recriar', async () => {
    // EF-04 §0: "registrar, listar, detalhar e excluir" — sem "editar". Uma
    // rota PATCH/PUT inexistente cai no 404 do Express, não num handler que
    // permitiria reescrever criadoPorMembroId.
    const conta = await criarConta(cookieA);
    const criado = await postLancamento(cookieA, {
      tipo: 'RECEITA',
      descricao: 'Imutabilidade',
      valorCentavos: 100,
      data: '2026-08-05',
      contaId: conta.id,
    });
    const id = (criado.body.lancamentos as LancamentoLido[])[0]?.id;

    const tentativaDeEdicao = await request(app)
      .patch(`/lancamentos/${id}`)
      .set('Cookie', cookieA)
      .send({ criadoPorMembroId: '00000000-0000-0000-0000-000000000000' });
    expect(tentativaDeEdicao.status).toBe(404);
  });
});

describe('RN-17 — transferência não é despesa: nunca tem categoria, nunca aparece como gasto', () => {
  it('TRANSFERENCIA é criada sem categoriaId, e o campo vem nulo na leitura', async () => {
    const origem = await criarConta(cookieA, 'DEBITO', { nome: 'Origem RN-17' });
    const destino = await criarConta(cookieA, 'RESERVA', { nome: 'Destino RN-17' });

    const resposta = await postLancamento(cookieA, {
      tipo: 'TRANSFERENCIA',
      descricao: 'Guardar em meta',
      valorCentavos: 20000,
      data: '2026-08-10',
      contaId: origem.id,
      contaDestinoId: destino.id,
    });

    expect(resposta.status).toBe(201);
    const [lancamento] = resposta.body.lancamentos as LancamentoLido[];
    expect(lancamento?.categoriaId).toBeNull();
  });

  it('uma TRANSFERENCIA não move gastoCentavos de NENHUMA categoria na leitura da competência', async () => {
    const origem = await criarConta(cookieA, 'DEBITO', { nome: 'Origem RN-17b' });
    const destino = await criarConta(cookieA, 'RESERVA', { nome: 'Destino RN-17b' });
    const categoria = await criarCategoria(cookieA, 'RN-17 categoria de controle');
    await request(app)
      .put(`/competencias/2026-09/categorias/${categoria.id}/teto`)
      .set('Cookie', cookieA)
      .send({ tetoCentavos: 10000 });

    const antes = await request(app).get('/competencias/2026-09').set('Cookie', cookieA);
    const linhaAntes = antes.body.categorias.find((c: { id: string }) => c.id === categoria.id);

    const transferiu = await postLancamento(cookieA, {
      tipo: 'TRANSFERENCIA',
      descricao: 'Pagar fatura',
      valorCentavos: 99999,
      data: '2026-09-15',
      contaId: origem.id,
      contaDestinoId: destino.id,
    });
    expect(transferiu.status).toBe(201);

    const depois = await request(app).get('/competencias/2026-09').set('Cookie', cookieA);
    const linhaDepois = depois.body.categorias.find((c: { id: string }) => c.id === categoria.id);
    expect(linhaDepois.gastoCentavos).toBe(linhaAntes.gastoCentavos);
  });

  it('POST /lancamentos recusa TRANSFERENCIA com contaId igual a contaDestinoId — 400 (fork 3/#52)', async () => {
    const conta = await criarConta(cookieA, 'DEBITO', { nome: 'Mesma conta' });
    const resposta = await postLancamento(cookieA, {
      tipo: 'TRANSFERENCIA',
      descricao: 'Origem == destino',
      valorCentavos: 100,
      data: '2026-08-10',
      contaId: conta.id,
      contaDestinoId: conta.id,
    });
    expect(resposta.status).toBe(400);
    expect(resposta.body.erro).toBe('conta_origem_igual_destino');
  });
});

describe('RN-18 — compra no crédito consome a categoria mas NÃO move o saldo da conta', () => {
  it('DESPESA numa conta CREDITO mantém o saldo derivado em zero', async () => {
    const cartao = await criarConta(cookieA, 'CREDITO', { nome: 'RN-18 cartão' });
    const categoria = await criarCategoria(cookieA, 'RN-18 categoria');

    const antes = await request(app).get('/contas').set('Cookie', cookieA);
    const saldoAntes = antes.body.contas.find((c: { id: string }) => c.id === cartao.id).saldoCentavos;
    expect(saldoAntes).toBe(0);

    const comprou = await postLancamento(cookieA, {
      tipo: 'DESPESA',
      descricao: 'Compra no crédito',
      valorCentavos: 15000,
      data: '2026-08-12',
      contaId: cartao.id,
      categoriaId: categoria.id,
    });
    expect(comprou.status).toBe(201);

    const depois = await request(app).get('/contas').set('Cookie', cookieA);
    const saldoDepois = depois.body.contas.find((c: { id: string }) => c.id === cartao.id).saldoCentavos;
    // RN-18/RN-19 — quem move o saldo é a fatura paga (EF-05); até lá, uma
    // conta CREDITO fica travada em 0 (ver `modulos/contas/servico.ts`).
    expect(saldoDepois).toBe(0);
  });

  it('a MESMA despesa consome o teto da categoria, na data da compra', async () => {
    const cartao = await criarConta(cookieA, 'CREDITO', { nome: 'RN-18 cartão b' });
    const categoria = await criarCategoria(cookieA, 'RN-18 categoria b');
    await request(app)
      .put(`/competencias/2026-08/categorias/${categoria.id}/teto`)
      .set('Cookie', cookieA)
      .send({ tetoCentavos: 20000 });

    await postLancamento(cookieA, {
      tipo: 'DESPESA',
      descricao: 'Compra no crédito consome teto',
      valorCentavos: 8000,
      data: '2026-08-12',
      contaId: cartao.id,
      categoriaId: categoria.id,
    });

    const leitura = await request(app).get('/competencias/2026-08').set('Cookie', cookieA);
    const linha = leitura.body.categorias.find((c: { id: string }) => c.id === categoria.id);
    expect(linha.gastoCentavos).toBe(8000);
    expect(linha.disponivelCentavos).toBe(20000 - 8000);
  });

  it('DESPESA/RECEITA numa conta DEBITO move o saldo derivado; TRANSFERENCIA move as duas pontas', async () => {
    const debito = await criarConta(cookieA, 'DEBITO', { nome: 'RN-18 débito', saldoInicialCentavos: 100000 });
    const reserva = await criarConta(cookieA, 'RESERVA', { nome: 'RN-18 reserva', saldoInicialCentavos: 0 });
    const categoria = await criarCategoria(cookieA, 'RN-18 categoria débito');

    await postLancamento(cookieA, {
      tipo: 'RECEITA',
      descricao: 'Salário',
      valorCentavos: 50000,
      data: '2026-08-01',
      contaId: debito.id,
    });
    await postLancamento(cookieA, {
      tipo: 'DESPESA',
      descricao: 'Mercado',
      valorCentavos: 20000,
      data: '2026-08-02',
      contaId: debito.id,
      categoriaId: categoria.id,
    });
    await postLancamento(cookieA, {
      tipo: 'TRANSFERENCIA',
      descricao: 'Guardar em meta',
      valorCentavos: 10000,
      data: '2026-08-03',
      contaId: debito.id,
      contaDestinoId: reserva.id,
    });

    const leitura = await request(app).get('/contas').set('Cookie', cookieA);
    const saldoDebito = leitura.body.contas.find((c: { id: string }) => c.id === debito.id).saldoCentavos;
    const saldoReserva = leitura.body.contas.find((c: { id: string }) => c.id === reserva.id).saldoCentavos;

    // 100000 (inicial) + 50000 (receita) − 20000 (despesa) − 10000 (transferência) = 120000.
    expect(saldoDebito).toBe(100000 + 50000 - 20000 - 10000);
    expect(saldoReserva).toBe(0 + 10000);
  });
});

describe('RN-15 — retroativo consome o teto do mês DA PRÓPRIA DATA, nunca o corrente', () => {
  it('a competência gravada é a do mês da data, não a de "hoje"', async () => {
    const conta = await criarConta(cookieA, 'DEBITO', { nome: 'RN-15 conta' });
    const categoria = await criarCategoria(cookieA, 'RN-15 categoria');

    const resposta = await postLancamento(cookieA, {
      tipo: 'DESPESA',
      descricao: 'Gasto retroativo',
      valorCentavos: 5000,
      data: '2026-01-15', // bem anterior a "hoje" (2026-08-27, ver CLAUDE.md).
      contaId: conta.id,
      categoriaId: categoria.id,
    });

    expect(resposta.status).toBe(201);
    const [lancamento] = resposta.body.lancamentos as LancamentoLido[];
    expect(lancamento?.competencia).toBe('2026-01');
  });

  it('o retroativo consome o teto de JANEIRO, e não move o gasto de AGOSTO (mês corrente)', async () => {
    const conta = await criarConta(cookieA, 'DEBITO', { nome: 'RN-15 conta b' });
    const categoria = await criarCategoria(cookieA, 'RN-15 categoria b');
    await request(app)
      .put(`/competencias/2026-02/categorias/${categoria.id}/teto`)
      .set('Cookie', cookieA)
      .send({ tetoCentavos: 30000 });
    await request(app)
      .put(`/competencias/2026-08/categorias/${categoria.id}/teto`)
      .set('Cookie', cookieA)
      .send({ tetoCentavos: 30000 });

    const agostoAntes = await request(app).get('/competencias/2026-08').set('Cookie', cookieA);
    const gastoAgostoAntes = agostoAntes.body.categorias.find(
      (c: { id: string }) => c.id === categoria.id,
    ).gastoCentavos;

    await postLancamento(cookieA, {
      tipo: 'DESPESA',
      descricao: 'Retroativo de fevereiro',
      valorCentavos: 12000,
      data: '2026-02-20',
      contaId: conta.id,
      categoriaId: categoria.id,
    });

    const fevereiro = await request(app).get('/competencias/2026-02').set('Cookie', cookieA);
    const linhaFevereiro = fevereiro.body.categorias.find((c: { id: string }) => c.id === categoria.id);
    expect(linhaFevereiro.gastoCentavos).toBe(12000);

    const agostoDepois = await request(app).get('/competencias/2026-08').set('Cookie', cookieA);
    const linhaAgosto = agostoDepois.body.categorias.find((c: { id: string }) => c.id === categoria.id);
    expect(linhaAgosto.gastoCentavos).toBe(gastoAgostoAntes);
  });
});

describe('RN-20/RN-21 — parcelamento sem juros: até 48×, resíduo na última, soma == total', () => {
  it('DoD: 100,00 em 3× vira 33,33 · 33,33 · 33,34 — soma exatamente o total', async () => {
    const conta = await criarConta(cookieA, 'CREDITO', { nome: 'RN-20 cartão' });
    const categoria = await criarCategoria(cookieA, 'RN-20 categoria');

    const resposta = await postLancamento(cookieA, {
      tipo: 'DESPESA',
      descricao: 'Compra parcelada quebrada',
      valorCentavos: 10000,
      data: '2026-08-05',
      contaId: conta.id,
      categoriaId: categoria.id,
      quantidadeParcelas: 3,
    });

    expect(resposta.status).toBe(201);
    const parcelas = resposta.body.lancamentos as LancamentoLido[];
    expect(parcelas).toHaveLength(3);
    expect(parcelas.map(p => p.valorCentavos)).toEqual([3333, 3333, 3334]);
    expect(parcelas.reduce((soma, p) => soma + p.valorCentavos, 0)).toBe(10000);
  });

  it('gera UM lançamento por competência subsequente, todos com o MESMO serieParcelaId', async () => {
    const conta = await criarConta(cookieA, 'CREDITO', { nome: 'RN-20 cartão b' });
    const categoria = await criarCategoria(cookieA, 'RN-20 categoria b');

    const resposta = await postLancamento(cookieA, {
      tipo: 'DESPESA',
      descricao: 'Compra em 3x',
      valorCentavos: 30000,
      data: '2026-11-15',
      contaId: conta.id,
      categoriaId: categoria.id,
      quantidadeParcelas: 3,
    });

    const parcelas = resposta.body.lancamentos as LancamentoLido[];
    expect(parcelas.map(p => p.competencia)).toEqual(['2026-11', '2026-12', '2027-01']);
    expect(parcelas.map(p => p.numeroParcela)).toEqual([1, 2, 3]);
    const series = new Set(parcelas.map(p => p.serieParcelaId));
    expect(series.size).toBe(1);
    expect([...series][0]).not.toBeNull();
  });

  it('tarefa #62 — cada parcela expõe quantidadeParcelas = o total da série (a compra original)', async () => {
    const conta = await criarConta(cookieA, 'CREDITO', { nome: 'RN-20 cartão total' });
    const categoria = await criarCategoria(cookieA, 'RN-20 categoria total');

    const resposta = await postLancamento(cookieA, {
      tipo: 'DESPESA',
      descricao: 'Compra em 3x — total da série',
      valorCentavos: 9000,
      data: '2026-06-10',
      contaId: conta.id,
      categoriaId: categoria.id,
      quantidadeParcelas: 3,
    });

    const parcelas = resposta.body.lancamentos as LancamentoLido[];
    expect(parcelas.map(p => p.quantidadeParcelas)).toEqual([3, 3, 3]);
  });

  it('tarefa #62 — DESPESA avulsa (sem parcelamento) reporta quantidadeParcelas nulo, igual a numeroParcela/serieParcelaId', async () => {
    const conta = await criarConta(cookieA, 'DEBITO', { nome: 'RN-20 avulsa' });
    const categoria = await criarCategoria(cookieA, 'RN-20 categoria avulsa');

    const resposta = await postLancamento(cookieA, {
      tipo: 'DESPESA',
      descricao: 'Despesa avulsa, sem série',
      valorCentavos: 1500,
      data: '2026-06-10',
      contaId: conta.id,
      categoriaId: categoria.id,
    });

    const [lancamento] = resposta.body.lancamentos as LancamentoLido[];
    expect(lancamento?.quantidadeParcelas).toBeNull();
    expect(lancamento?.numeroParcela).toBeNull();
    expect(lancamento?.serieParcelaId).toBeNull();
  });

  it('cada parcela consome o teto da SUA PRÓPRIA competência (RN-18/RN-20 juntas)', async () => {
    const conta = await criarConta(cookieA, 'CREDITO', { nome: 'RN-20 cartão c' });
    const categoria = await criarCategoria(cookieA, 'RN-20 categoria c');
    await request(app)
      .put(`/competencias/2026-03/categorias/${categoria.id}/teto`)
      .set('Cookie', cookieA)
      .send({ tetoCentavos: 5000 });
    await request(app)
      .put(`/competencias/2026-04/categorias/${categoria.id}/teto`)
      .set('Cookie', cookieA)
      .send({ tetoCentavos: 5000 });

    await postLancamento(cookieA, {
      tipo: 'DESPESA',
      descricao: 'Compra em 2x',
      valorCentavos: 4000,
      data: '2026-03-10',
      contaId: conta.id,
      categoriaId: categoria.id,
      quantidadeParcelas: 2,
    });

    const marco = await request(app).get('/competencias/2026-03').set('Cookie', cookieA);
    const abril = await request(app).get('/competencias/2026-04').set('Cookie', cookieA);
    expect(marco.body.categorias.find((c: { id: string }) => c.id === categoria.id).gastoCentavos).toBe(2000);
    expect(abril.body.categorias.find((c: { id: string }) => c.id === categoria.id).gastoCentavos).toBe(2000);
  });

  it('recusa quantidadeParcelas acima de 48 (RN-20) — 422', async () => {
    const conta = await criarConta(cookieA, 'CREDITO', { nome: 'RN-20 cartão d' });
    const categoria = await criarCategoria(cookieA, 'RN-20 categoria d');

    const resposta = await postLancamento(cookieA, {
      tipo: 'DESPESA',
      descricao: 'Parcelamento acima do teto',
      valorCentavos: 4900,
      data: '2026-08-05',
      contaId: conta.id,
      categoriaId: categoria.id,
      quantidadeParcelas: 49,
    });
    expect(resposta.status).toBe(422);
  });
});

describe('RN-39 — recebido da competência = soma dos lançamentos RECEITA', () => {
  it('soma só RECEITA da competência informada, ignorando DESPESA e outra competência', async () => {
    const conta = await criarConta(cookieA, 'DEBITO', { nome: 'RN-39 conta' });
    const categoria = await criarCategoria(cookieA, 'RN-39 categoria');

    await postLancamento(cookieA, {
      tipo: 'RECEITA',
      descricao: 'Salário RN-39',
      valorCentavos: 400000,
      data: '2026-10-05',
      contaId: conta.id,
    });
    await postLancamento(cookieA, {
      tipo: 'RECEITA',
      descricao: 'Freela RN-39',
      valorCentavos: 100000,
      data: '2026-10-20',
      contaId: conta.id,
    });
    // DESPESA na MESMA competência não pode contaminar `recebido`.
    await postLancamento(cookieA, {
      tipo: 'DESPESA',
      descricao: 'Gasto que não é recebido',
      valorCentavos: 50000,
      data: '2026-10-10',
      contaId: conta.id,
      categoriaId: categoria.id,
    });
    // RECEITA em OUTRA competência não pode contaminar outubro.
    await postLancamento(cookieA, {
      tipo: 'RECEITA',
      descricao: 'Receita de novembro',
      valorCentavos: 999999,
      data: '2026-11-01',
      contaId: conta.id,
    });

    const leitura = await request(app).get('/competencias/2026-10').set('Cookie', cookieA);
    expect(leitura.body.recebidoCentavos).toBe(400000 + 100000);
  });
});

describe('RN-22 — competência selada (fork 2/#52, guarda EF-08 ainda não construída)', () => {
  it('hoje NUNCA existe FechamentoMes (a tabela é da EF-08): a checagem sempre libera a escrita', async () => {
    // Prova direta do ponto de extensão que a EF-08 vai preencher — ver o
    // comentário de `competenciaEstaSelada` em `modulos/lancamentos/servico.ts`.
    await expect(competenciaEstaSelada(db, familiaA.familiaId, '2026-08')).resolves.toBe(false);
  });

  it('nenhum lançamento é hoje recusado por competência selada, inclusive retroativo', async () => {
    const conta = await criarConta(cookieA, 'DEBITO', { nome: 'RN-22 conta' });
    const resposta = await postLancamento(cookieA, {
      tipo: 'RECEITA',
      descricao: 'RN-22 sempre aceito hoje',
      valorCentavos: 100,
      data: '2020-01-01',
      contaId: conta.id,
    });
    expect(resposta.status).toBe(201);
  });
});

describe('fork 1/#52 — excluir parcela: o alcance pergunta (esta · todas · a-partir-desta)', () => {
  async function criarSerieDeQuatro(cookie: string) {
    const conta = await criarConta(cookie, 'CREDITO', { nome: `Cartão série ${Math.random()}` });
    const categoria = await criarCategoria(cookie, `Categoria série ${Math.random()}`);
    const resposta = await postLancamento(cookie, {
      tipo: 'DESPESA',
      descricao: 'Compra em 4x',
      valorCentavos: 40000,
      data: '2026-05-10',
      contaId: conta.id,
      categoriaId: categoria.id,
      quantidadeParcelas: 4,
    });
    return resposta.body.lancamentos as LancamentoLido[];
  }

  it('"esta" remove só o lançamento daquela parcela', async () => {
    const parcelas = await criarSerieDeQuatro(cookieA);
    const segunda = parcelas[1] as LancamentoLido;

    const excluiu = await request(app)
      .delete(`/lancamentos/${segunda.id}?modo=esta`)
      .set('Cookie', cookieA);
    expect(excluiu.status).toBe(204);

    const restantes = await request(app)
      .get('/lancamentos')
      .set('Cookie', cookieA)
      .query({ contaId: parcelas[0]?.contaId });
    const ids = (restantes.body.lancamentos as LancamentoLido[]).map(l => l.id);
    expect(ids).not.toContain(segunda.id);
    expect(ids).toContain(parcelas[0]?.id);
    expect(ids).toContain(parcelas[2]?.id);
    expect(ids).toContain(parcelas[3]?.id);
  });

  it('tarefa #62 — "esta" NÃO renumera as irmãs: 3x, exclui a parcela 2, a parcela 3 ainda reporta total 3 (não 2)', async () => {
    // O caso que quebra, medido na issue #62: contar as linhas irmãs
    // devolvidas por GET /lancamentos daria 2 depois da exclusão — e a tela
    // escreveria "Parcela 3 de 2". `quantidadeParcelas` vem de
    // `series_parcelas.quantidade` (a compra ORIGINAL, RN-20/RN-21), que a
    // exclusão de parcela não reescreve (suposição declarada na #52) — por
    // isso o valor certo continua sendo 3.
    const conta = await criarConta(cookieA, 'CREDITO', { nome: 'Cartão #62' });
    const categoria = await criarCategoria(cookieA, 'Categoria #62');
    const criado = await postLancamento(cookieA, {
      tipo: 'DESPESA',
      descricao: 'Compra em 3x — tarefa #62',
      valorCentavos: 9000,
      data: '2026-07-10',
      contaId: conta.id,
      categoriaId: categoria.id,
      quantidadeParcelas: 3,
    });
    const parcelas = criado.body.lancamentos as LancamentoLido[];
    expect(parcelas).toHaveLength(3);
    const [parcela1, parcela2, parcela3] = parcelas;

    const excluiu = await request(app)
      .delete(`/lancamentos/${parcela2?.id}?modo=esta`)
      .set('Cookie', cookieA);
    expect(excluiu.status).toBe(204);

    // Só duas linhas irmãs sobrevivem — contá-las daria 2, o bug medido.
    const restantes = await request(app)
      .get('/lancamentos')
      .set('Cookie', cookieA)
      .query({ contaId: parcela1?.contaId });
    const idsRestantes = (restantes.body.lancamentos as LancamentoLido[]).map(l => l.id);
    expect(idsRestantes).toHaveLength(2);

    // GET /lancamentos/{id} (detalhe) — a parcela 3 continua dizendo 3, não 2.
    const detalheParcela3 = await request(app)
      .get(`/lancamentos/${parcela3?.id}`)
      .set('Cookie', cookieA);
    expect(detalheParcela3.status).toBe(200);
    const lidaNoDetalhe = detalheParcela3.body as LancamentoLido;
    expect(lidaNoDetalhe.numeroParcela).toBe(3);
    expect(lidaNoDetalhe.quantidadeParcelas).toBe(3);

    // GET /lancamentos (lista) — mesmo campo, mesmo valor: listagem e
    // detalhe não podem divergir (sinal de conclusão #4 da issue).
    const naListagem = (restantes.body.lancamentos as LancamentoLido[]).find(l => l.id === parcela3?.id);
    expect(naListagem?.quantidadeParcelas).toBe(3);
    expect(naListagem?.quantidadeParcelas).toBe(lidaNoDetalhe.quantidadeParcelas);

    // A parcela 1 (nunca tocada) também continua reportando o total certo.
    const detalheParcela1 = await request(app)
      .get(`/lancamentos/${parcela1?.id}`)
      .set('Cookie', cookieA);
    expect((detalheParcela1.body as LancamentoLido).quantidadeParcelas).toBe(3);
  });

  it('"todas" remove a série inteira', async () => {
    const parcelas = await criarSerieDeQuatro(cookieA);
    const primeira = parcelas[0] as LancamentoLido;

    const excluiu = await request(app)
      .delete(`/lancamentos/${primeira.id}?modo=todas`)
      .set('Cookie', cookieA);
    expect(excluiu.status).toBe(204);

    for (const parcela of parcelas) {
      const detalhe = await request(app).get(`/lancamentos/${parcela.id}`).set('Cookie', cookieA);
      expect(detalhe.status).toBe(404);
    }
  });

  it('"a-partir-desta" remove esta e as de competência POSTERIOR, mantém as anteriores', async () => {
    const parcelas = await criarSerieDeQuatro(cookieA);
    const terceira = parcelas[2] as LancamentoLido;

    const excluiu = await request(app)
      .delete(`/lancamentos/${terceira.id}?modo=a-partir-desta`)
      .set('Cookie', cookieA);
    expect(excluiu.status).toBe(204);

    const primeiraAinda = await request(app).get(`/lancamentos/${parcelas[0]?.id}`).set('Cookie', cookieA);
    const segundaAinda = await request(app).get(`/lancamentos/${parcelas[1]?.id}`).set('Cookie', cookieA);
    const terceiraSumiu = await request(app).get(`/lancamentos/${parcelas[2]?.id}`).set('Cookie', cookieA);
    const quartaSumiu = await request(app).get(`/lancamentos/${parcelas[3]?.id}`).set('Cookie', cookieA);

    expect(primeiraAinda.status).toBe(200);
    expect(segundaAinda.status).toBe(200);
    expect(terceiraSumiu.status).toBe(404);
    expect(quartaSumiu.status).toBe(404);
  });

  it('suposição declarada: excluir NÃO reescreve SerieParcelas.total/quantidade (a compra original)', async () => {
    const parcelas = await criarSerieDeQuatro(cookieA);
    const primeira = parcelas[0] as LancamentoLido;
    const serieId = primeira.serieParcelaId as string;

    await request(app).delete(`/lancamentos/${primeira.id}?modo=esta`).set('Cookie', cookieA);

    const [serie] = await db.select().from(seriesParcelas).where(eq(seriesParcelas.id, serieId));
    expect(serie?.totalCentavos).toBe(40000);
    expect(serie?.quantidade).toBe(4);
  });

  it('modo ausente equivale a "esta"; modo inválido responde 422', async () => {
    const parcelas = await criarSerieDeQuatro(cookieA);
    const invalido = await request(app)
      .delete(`/lancamentos/${parcelas[0]?.id}?modo=tudo`)
      .set('Cookie', cookieA);
    expect(invalido.status).toBe(422);

    const semModo = await request(app).delete(`/lancamentos/${parcelas[0]?.id}`).set('Cookie', cookieA);
    expect(semModo.status).toBe(204);

    const restoAinda = await request(app).get(`/lancamentos/${parcelas[1]?.id}`).set('Cookie', cookieA);
    expect(restoAinda.status).toBe(200);
  });

  it('excluir lançamento inexistente responde 404', async () => {
    const resposta = await request(app)
      .delete('/lancamentos/00000000-0000-0000-0000-000000000000')
      .set('Cookie', cookieA);
    expect(resposta.status).toBe(404);
  });
});

describe('CHECKs do banco — defesa em profundidade (mesmo padrão de `contas.teste.ts`)', () => {
  it('recusa categoriaId fora de DESPESA', async () => {
    const conta = await criarConta(cookieA, 'DEBITO', { nome: 'CHECK conta' });
    const categoria = await criarCategoria(cookieA, 'CHECK categoria');
    await expect(
      db.insert(lancamentos).values({
        familiaId: familiaA.familiaId,
        tipo: 'RECEITA',
        descricao: 'Receita com categoria — inválido',
        valorCentavos: 100,
        data: '2026-08-01',
        competencia: '2026-08',
        categoriaId: categoria.id,
        contaId: conta.id,
        criadoPorMembroId: familiaA.membroId,
      }),
    ).rejects.toThrow();
  });

  it('recusa contaDestinoId fora de TRANSFERENCIA', async () => {
    const conta = await criarConta(cookieA, 'DEBITO', { nome: 'CHECK conta b' });
    const outraConta = await criarConta(cookieA, 'DEBITO', { nome: 'CHECK conta c' });
    await expect(
      db.insert(lancamentos).values({
        familiaId: familiaA.familiaId,
        tipo: 'RECEITA',
        descricao: 'Receita com contaDestino — inválido',
        valorCentavos: 100,
        data: '2026-08-01',
        competencia: '2026-08',
        contaId: conta.id,
        contaDestinoId: outraConta.id,
        criadoPorMembroId: familiaA.membroId,
      }),
    ).rejects.toThrow();
  });

  it('recusa contaDestinoId igual a contaId', async () => {
    const conta = await criarConta(cookieA, 'DEBITO', { nome: 'CHECK conta d' });
    await expect(
      db.insert(lancamentos).values({
        familiaId: familiaA.familiaId,
        tipo: 'TRANSFERENCIA',
        descricao: 'Origem == destino direto no banco',
        valorCentavos: 100,
        data: '2026-08-01',
        competencia: '2026-08',
        contaId: conta.id,
        contaDestinoId: conta.id,
        criadoPorMembroId: familiaA.membroId,
      }),
    ).rejects.toThrow();
  });
});

describe('validação de corpo', () => {
  it('DESPESA sem categoriaId responde 422', async () => {
    const conta = await criarConta(cookieA);
    const resposta = await postLancamento(cookieA, {
      tipo: 'DESPESA',
      descricao: 'Sem categoria',
      valorCentavos: 100,
      data: '2026-08-01',
      contaId: conta.id,
    });
    expect(resposta.status).toBe(422);
  });

  it('valorCentavos não positivo responde 422', async () => {
    const conta = await criarConta(cookieA);
    const resposta = await postLancamento(cookieA, {
      tipo: 'RECEITA',
      descricao: 'Valor zero',
      valorCentavos: 0,
      data: '2026-08-01',
      contaId: conta.id,
    });
    expect(resposta.status).toBe(422);
  });

  it('data fora do calendário (32/01, 30/02) responde 422', async () => {
    const conta = await criarConta(cookieA);
    const resposta = await postLancamento(cookieA, {
      tipo: 'RECEITA',
      descricao: 'Data inválida',
      valorCentavos: 100,
      data: '2026-02-30',
      contaId: conta.id,
    });
    expect(resposta.status).toBe(422);
  });

  it('sem sessão, todos os endpoints respondem 401', async () => {
    expect((await request(app).post('/lancamentos').send({})).status).toBe(401);
    expect((await request(app).get('/lancamentos')).status).toBe(401);
    expect((await request(app).get('/lancamentos/qualquer-id')).status).toBe(401);
    expect((await request(app).delete('/lancamentos/qualquer-id')).status).toBe(401);
  });
});

describe('404 — conta/categoria inexistente ou de outra família', () => {
  it('contaId inexistente responde 404', async () => {
    const resposta = await postLancamento(cookieA, {
      tipo: 'RECEITA',
      descricao: 'Conta inexistente',
      valorCentavos: 100,
      data: '2026-08-01',
      contaId: '00000000-0000-0000-0000-000000000000',
    });
    expect(resposta.status).toBe(404);
    expect(resposta.body.erro).toBe('conta_nao_encontrada');
  });

  it('categoriaId de outra família responde 404', async () => {
    const contaDeA = await criarConta(cookieA);
    const categoriaDeB = await criarCategoria(cookieB, 'Categoria só de B');

    const resposta = await postLancamento(cookieA, {
      tipo: 'DESPESA',
      descricao: 'Categoria de outra família',
      valorCentavos: 100,
      data: '2026-08-01',
      contaId: contaDeA.id,
      categoriaId: categoriaDeB.id,
    });
    expect(resposta.status).toBe(404);
    expect(resposta.body.erro).toBe('categoria_nao_encontrada');
  });
});

describe('isolamento entre famílias', () => {
  it('a família B não vê, no extrato, o lançamento da família A', async () => {
    const conta = await criarConta(cookieA, 'DEBITO', { nome: 'Isolamento conta' });
    const criado = await postLancamento(cookieA, {
      tipo: 'RECEITA',
      descricao: 'Isolamento — só de A',
      valorCentavos: 100,
      data: '2026-08-01',
      contaId: conta.id,
    });
    const id = (criado.body.lancamentos as LancamentoLido[])[0]?.id;

    const listaDeB = await request(app).get('/lancamentos').set('Cookie', cookieB);
    const ids = (listaDeB.body.lancamentos as LancamentoLido[]).map(l => l.id);
    expect(ids).not.toContain(id);
  });

  it('a família B não consegue ver o detalhe de um lançamento de A (404)', async () => {
    const conta = await criarConta(cookieA, 'DEBITO', { nome: 'Isolamento detalhe' });
    const criado = await postLancamento(cookieA, {
      tipo: 'RECEITA',
      descricao: 'Isolamento detalhe',
      valorCentavos: 100,
      data: '2026-08-01',
      contaId: conta.id,
    });
    const id = (criado.body.lancamentos as LancamentoLido[])[0]?.id;

    const detalhe = await request(app).get(`/lancamentos/${id}`).set('Cookie', cookieB);
    expect(detalhe.status).toBe(404);
  });

  it('a família B não consegue excluir um lançamento de A (404, e o dado continua intacto)', async () => {
    const conta = await criarConta(cookieA, 'DEBITO', { nome: 'Isolamento exclusão' });
    const criado = await postLancamento(cookieA, {
      tipo: 'RECEITA',
      descricao: 'Isolamento exclusão',
      valorCentavos: 100,
      data: '2026-08-01',
      contaId: conta.id,
    });
    const id = (criado.body.lancamentos as LancamentoLido[])[0]?.id;

    const tentativa = await request(app).delete(`/lancamentos/${id}`).set('Cookie', cookieB);
    expect(tentativa.status).toBe(404);

    const aindaLa = await request(app).get(`/lancamentos/${id}`).set('Cookie', cookieA);
    expect(aindaLa.status).toBe(200);
  });

  it('a família B não usa contaId de A para criar lançamento (404)', async () => {
    const contaDeA = await criarConta(cookieA, 'DEBITO', { nome: 'Isolamento conta de A' });
    const resposta = await postLancamento(cookieB, {
      tipo: 'RECEITA',
      descricao: 'Tentativa com conta de outra família',
      valorCentavos: 100,
      data: '2026-08-01',
      contaId: contaDeA.id,
    });
    expect(resposta.status).toBe(404);
  });
});

describe('tempo real — invalidação emitida no recurso lancamentos, com a competência', () => {
  const abertos: Socket[] = [];

  afterAll(() => {
    for (const s of abertos) s.close();
  });

  function conectar(cookie: string): Socket {
    const socket = conectarCliente(stack.url, {
      path: CAMINHO_REALTIME,
      transports: ['websocket'],
      extraHeaders: { Cookie: cookie },
      reconnection: false,
    });
    abertos.push(socket);
    return socket;
  }

  function esperarConexao(socket: Socket): Promise<void> {
    return new Promise((resolver, rejeitar) => {
      socket.once('connect', () => resolver());
      socket.once('connect_error', erro => rejeitar(erro));
      setTimeout(() => rejeitar(new Error('timeout de conexão')), 8000);
    });
  }

  it('POST /lancamentos emite recurso "lancamentos" com a competência do lançamento criado', async () => {
    const socket = conectar(cookieA);
    await esperarConexao(socket);
    const conta = await criarConta(cookieA, 'DEBITO', { nome: 'Realtime conta' });

    // O listener é registrado ANTES do `await` da criação — síncrono, sem
    // corrida: o Node só entrega o evento do socket depois que esta função
    // devolve o controle ao loop de eventos.
    const eventoPromise = new Promise<{ recurso: string; competencia: string | null }>((resolver) => {
      socket.once('recurso.alterado', resolver);
    });

    const resposta = await postLancamento(cookieA, {
      tipo: 'RECEITA',
      descricao: 'Dispara invalidação',
      valorCentavos: 100,
      data: '2026-08-06',
      contaId: conta.id,
    });
    expect(resposta.status).toBe(201);

    const evento = await eventoPromise;
    expect(evento.recurso).toBe('lancamentos');
    expect(evento.competencia).toBe('2026-08');
  });
});

// ---------------------------------------------------------------------------
// UM POST, UMA LINHA — regressão do defeito relatado pelo humano em 2026-08-28
//
// Sintoma: "o lançamento de receitas está duplicando; excluo um e o outro
// continua na tela". No banco de DEV havia duas linhas RECEITA idênticas com
// 267µs de diferença em `criado_em` — e como o default da coluna é `now()`,
// que no Postgres é o timestamp da TRANSAÇÃO, valores diferentes provam duas
// transações distintas, não um insert duplo dentro da mesma.
//
// Este teste fecha o lado do SERVIDOR da pergunta: um POST HTTP grava uma
// linha? Se ele passar, a duplicação nasce antes da API (dois requests), e não
// dentro dela. Ele fica no lugar de uma investigação que teria de ser refeita
// do zero na próxima vez.
// ---------------------------------------------------------------------------
describe('um POST cria exatamente UMA linha', () => {
  it('RECEITA: um POST não grava duas linhas', async () => {
    const conta = await criarConta(cookieA);
    const resposta = await postLancamento(cookieA, {
      tipo: 'RECEITA',
      descricao: 'regressao-duplicacao-receita',
      valorCentavos: 25000,
      data: '2026-08-28',
      contaId: conta.id,
    });
    expect(resposta.status).toBe(201);
    expect((resposta.body.lancamentos as LancamentoLido[]).length).toBe(1);

    const linhas = await db
      .select({ id: lancamentos.id })
      .from(lancamentos)
      .where(eq(lancamentos.descricao, 'regressao-duplicacao-receita'));
    expect(linhas).toHaveLength(1);
  });

  it('DESPESA avulsa: um POST não grava duas linhas', async () => {
    const conta = await criarConta(cookieA);
    const categoria = await criarCategoria(cookieA, 'Regressão duplicação');
    const resposta = await postLancamento(cookieA, {
      tipo: 'DESPESA',
      descricao: 'regressao-duplicacao-despesa',
      valorCentavos: 5000,
      data: '2026-08-28',
      contaId: conta.id,
      categoriaId: categoria.id,
    });
    expect(resposta.status).toBe(201);

    const linhas = await db
      .select({ id: lancamentos.id })
      .from(lancamentos)
      .where(eq(lancamentos.descricao, 'regressao-duplicacao-despesa'));
    expect(linhas).toHaveLength(1);
  });
});
