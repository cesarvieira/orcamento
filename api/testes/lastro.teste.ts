/**
 * Integração de `lastro` (EF-06/tarefa #76) — Postgres de verdade, HTTP real.
 *
 * ⛔ Regra #0: RN-27..RN-32 vêm de
 * `.preator/skills/negocio/contas-e-lastro/SKILL.md` (glossário: "Caixa
 * real", "Limite livre do cartão", "Lastro", "Deficit de lastro", "Gasto
 * bloqueado"), citando `docs/especificacoes/EF-06-lastro.md` §2 como fonte
 * primária, e `docs/decisoes/D-06-dinheiro-em-centavos.md` para o resíduo
 * (RN-32). Nada aqui foi testado de memória.
 *
 * ⛔ Esta suíte NÃO é `api/testes/lastro-rateio.teste.ts` — essa é a pasta
 * disjunta da tarefa #78 (qa), dona dos SETE casos do Definition of Done
 * (EF-06 §5: um teste por RN, soma dos bloqueados == déficit com quebra, sem
 * déficit → zero em todas, bloqueado nunca excede o disponível, receita
 * reduz o bloqueado sem alterar teto, guardar em meta reduz o lastro). Este
 * arquivo é o meu (tarefa #76/backend): prova a FIAÇÃO — que
 * `modulos/lastro/servico.ts` está de fato ligado a `contas`, `faturas` e
 * `orcamento`, e que os campos chegam certos na leitura HTTP de competência
 * — sem duplicar a matriz de casos que é do QA.
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

// Toda mutação emitida por `lancamentos`/`orcamento` exige o servidor de
// tempo real DE PÉ (D-04/R3) — mesmo padrão de `testes/orcamento.teste.ts`.
let stack: StackDeTempoReal;

beforeAll(async () => {
  await limparBanco();
  stack = await subirServidorComRealtime();
});

afterAll(async () => {
  await stack.encerrar();
  await fecharBanco();
});

async function novaFamiliaComCookie(nome: string) {
  const familia = await criarFamiliaComMembro(nome);
  const cookie = await cookieDeSessao(familia.membroId);
  return { familia, cookie };
}

async function novaConta(
  cookie: string,
  dados: Record<string, unknown>,
): Promise<string> {
  const resposta = await request(app).post('/contas').set('Cookie', cookie).send(dados);
  expect(resposta.status).toBe(201);
  return resposta.body.id as string;
}

async function novaContaDebito(cookie: string, nome: string, saldoInicialCentavos: number) {
  return novaConta(cookie, {
    tipo: 'DEBITO',
    nome,
    icone: 'banco',
    cor: '#2563eb',
    saldoInicialCentavos,
  });
}

async function novaContaReserva(cookie: string, nome: string, saldoInicialCentavos: number) {
  return novaConta(cookie, {
    tipo: 'RESERVA',
    nome,
    icone: 'cofre',
    cor: '#16a34a',
    saldoInicialCentavos,
  });
}

async function novoCartao(cookie: string, nome: string, limiteCentavos: number) {
  return novaConta(cookie, {
    tipo: 'CREDITO',
    nome,
    icone: 'cartao',
    cor: '#dc2626',
    limiteCentavos,
    diaFechamento: 5,
    diaVencimento: 15,
  });
}

async function novaCategoria(cookie: string, nome: string): Promise<string> {
  const resposta = await request(app)
    .post('/categorias')
    .set('Cookie', cookie)
    .send({ nome, icone: 'x', cor: '#000' });
  expect(resposta.status).toBe(201);
  return resposta.body.id as string;
}

async function definirTeto(cookie: string, competencia: string, categoriaId: string, tetoCentavos: number) {
  const resposta = await request(app)
    .put(`/competencias/${competencia}/categorias/${categoriaId}/teto`)
    .set('Cookie', cookie)
    .send({ tetoCentavos });
  expect(resposta.status).toBe(200);
}

interface DadosDeDespesaNoCartao {
  cookie: string;
  cartaoId: string;
  categoriaId: string;
  valorCentavos: number;
  data: string;
}

async function novaDespesaNoCartao(dados: DadosDeDespesaNoCartao) {
  const resposta = await request(app).post('/lancamentos').set('Cookie', dados.cookie).send({
    tipo: 'DESPESA',
    descricao: 'Compra no cartão',
    valorCentavos: dados.valorCentavos,
    data: dados.data,
    contaId: dados.cartaoId,
    categoriaId: dados.categoriaId,
  });
  expect(resposta.status).toBe(201);
}

async function lerCompetencia(cookie: string, competencia: string) {
  return request(app).get(`/competencias/${competencia}`).set('Cookie', cookie);
}

interface CategoriaDaCompetencia {
  id: string;
  disponivelCentavos: number;
  liberadoCentavos: number;
  bloqueadoCentavos: number;
}

function acharCategoria(corpo: { categorias: CategoriaDaCompetencia[] }, id: string): CategoriaDaCompetencia {
  const linha = corpo.categorias.find(c => c.id === id);
  if (!linha) throw new Error(`categoria ${id} não apareceu na leitura da competência`);
  return linha;
}

describe('lastro — RN-27: caixa real soma só DEBITO, com piso em zero por conta', () => {
  it('reserva fica de fora do lastro, e débito negativo não conta como caixa', async () => {
    const { cookie } = await novaFamiliaComCookie('Família RN-27');
    // Duas contas DEBITO: uma positiva, uma NEGATIVA (via lançamento DESPESA
    // maior que o saldo inicial) — a negativa não pode puxar o total para
    // baixo (SKILL.md: "débito negativo... nem entra negativo no total").
    await novaContaDebito(cookie, 'Débito positivo', 10000);
    const debitoNegativo = await novaContaDebito(cookie, 'Débito no vermelho', 500);
    await novaContaReserva(cookie, 'Reserva de emergência', 999999);
    const categoria = await novaCategoria(cookie, 'RN-27 categoria');

    await request(app).post('/lancamentos').set('Cookie', cookie).send({
      tipo: 'DESPESA',
      descricao: 'Estoura o débito',
      valorCentavos: 2000,
      data: '2026-08-10',
      contaId: debitoNegativo,
      categoriaId: categoria,
    });

    const leitura = await lerCompetencia(cookie, '2026-08');
    expect(leitura.status).toBe(200);
    // caixaReal = max(0, 10000) + max(0, 500 − 2000) + (reserva DE FORA) = 10000 + 0 = 10000.
    expect(leitura.body.lastroCentavos).toBe(10000);
  });
});

describe('lastro — RN-28: limite livre agrega TODOS os cartões da família', () => {
  it('soma limite livre de dois cartões, um deles com despesa em aberto', async () => {
    const { cookie } = await novaFamiliaComCookie('Família RN-28');
    const categoria = await novaCategoria(cookie, 'RN-28 categoria');
    await novoCartao(cookie, 'Cartão A', 100000);
    const cartaoB = await novoCartao(cookie, 'Cartão B', 50000);

    // Cartão A: sem compra nenhuma — limite livre = limite inteiro = 100000.
    // Cartão B: compra de 20000 — limite livre = 50000 − 20000 = 30000.
    await novaDespesaNoCartao({ cookie, cartaoId: cartaoB, categoriaId: categoria, valorCentavos: 20000, data: '2026-08-10' });

    const leitura = await lerCompetencia(cookie, '2026-08');
    expect(leitura.status).toBe(200);
    // Sem conta DEBITO nenhuma: caixaReal = 0. lastro = 0 + (100000 + 30000).
    expect(leitura.body.lastroCentavos).toBe(130000);
  });
});

describe('lastro — RN-29/RN-32: rateio pró-rata com resíduo, na leitura HTTP real', () => {
  it('a soma dos bloqueados fecha exatamente no déficit, e o resíduo vai para o maior disponível', async () => {
    const { cookie } = await novaFamiliaComCookie('Família RN-29/32');
    // lastro = 201 (uma única conta DEBITO com esse saldo inicial, sem cartão).
    await novaContaDebito(cookie, 'Conta do lastro', 201);

    const categoriaA = await novaCategoria(cookie, 'A — 100');
    const categoriaB = await novaCategoria(cookie, 'B — 100');
    const categoriaC = await novaCategoria(cookie, 'C — 101 (maior saldo)');
    await definirTeto(cookie, '2026-09', categoriaA, 100);
    await definirTeto(cookie, '2026-09', categoriaB, 100);
    await definirTeto(cookie, '2026-09', categoriaC, 101);

    // restanteTotal = 100+100+101 = 301; déficit = max(0, 301 − 201) = 100.
    // bloqueado bruto: floor(100*100/301)=33, floor(100*100/301)=33,
    // floor(101*100/301)=33 — soma bruta 99, resíduo 1 vai para C (maior
    // disponível, 101, único máximo).
    const leitura = await lerCompetencia(cookie, '2026-09');
    expect(leitura.status).toBe(200);
    expect(leitura.body.lastroCentavos).toBe(201);
    expect(leitura.body.deficitCentavos).toBe(100);
    expect(leitura.body.liberadoTotalCentavos).toBe(201);

    const linhaA = acharCategoria(leitura.body, categoriaA);
    const linhaB = acharCategoria(leitura.body, categoriaB);
    const linhaC = acharCategoria(leitura.body, categoriaC);

    expect(linhaA.bloqueadoCentavos).toBe(33);
    expect(linhaB.bloqueadoCentavos).toBe(33);
    expect(linhaC.bloqueadoCentavos).toBe(34); // 33 + o resíduo de 1.

    expect(linhaA.liberadoCentavos).toBe(100 - 33);
    expect(linhaB.liberadoCentavos).toBe(100 - 33);
    expect(linhaC.liberadoCentavos).toBe(101 - 34);

    // RN-32 — a invariante central: soma dos bloqueados é EXATAMENTE o déficit.
    const somaDosBloqueados = linhaA.bloqueadoCentavos + linhaB.bloqueadoCentavos + linhaC.bloqueadoCentavos;
    expect(somaDosBloqueados).toBe(leitura.body.deficitCentavos);
  });
});

describe('lastro — sem déficit, bloqueado é zero em todas', () => {
  it('lastro maior que o restante total: liberado == disponível, bloqueado == 0', async () => {
    const { cookie } = await novaFamiliaComCookie('Família sem déficit');
    await novaContaDebito(cookie, 'Conta folgada', 1000000);

    const categoria = await novaCategoria(cookie, 'Categoria folgada');
    await definirTeto(cookie, '2026-10', categoria, 5000);

    const leitura = await lerCompetencia(cookie, '2026-10');
    expect(leitura.body.deficitCentavos).toBe(0);
    expect(leitura.body.liberadoTotalCentavos).toBe(5000);

    const linha = acharCategoria(leitura.body, categoria);
    expect(linha.bloqueadoCentavos).toBe(0);
    expect(linha.liberadoCentavos).toBe(5000);
  });
});

describe('lastro — isolamento entre famílias', () => {
  it('o lastro de uma família nunca aparece na leitura de outra', async () => {
    const { cookie: cookieA } = await novaFamiliaComCookie('Família A do lastro');
    const { cookie: cookieB } = await novaFamiliaComCookie('Família B do lastro');

    await novaContaDebito(cookieA, 'Só de A', 500000);

    const leituraDeA = await lerCompetencia(cookieA, '2026-11');
    const leituraDeB = await lerCompetencia(cookieB, '2026-11');

    expect(leituraDeA.body.lastroCentavos).toBe(500000);
    expect(leituraDeB.body.lastroCentavos).toBe(0);
  });
});
