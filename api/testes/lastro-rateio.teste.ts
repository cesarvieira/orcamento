/**
 * Os SETE casos do Definition of Done do lastro (EF-06 §5) — tarefa #78 (qa),
 * história #20. Integração contra Postgres de verdade, HTTP real, no padrão
 * de `api/testes/orcamento.teste.ts`.
 *
 * ⛔ Regra #0 — as regras testadas aqui (RN-27..RN-32) vêm de
 * `.preator/skills/negocio/contas-e-lastro/SKILL.md` (glossário: "Caixa
 * real", "Limite livre do cartão", "Lastro", "Deficit de lastro", "Gasto
 * bloqueado (categoria)", tabela "Regras de negócio"), citando
 * `docs/especificacoes/EF-06-lastro.md` §2 como fonte primária e §5 como o
 * Definition of Done que este arquivo prova ponto a ponto. O destino do
 * resíduo (RN-32) cita `docs/decisoes/D-06-dinheiro-em-centavos.md`. Nada
 * aqui foi testado de memória.
 *
 * ⛔ Esta suíte NÃO é `api/testes/lastro.teste.ts` — aquela é da tarefa #76
 * (backend) e prova a FIAÇÃO (que `modulos/lastro/servico.ts` está de fato
 * ligado a `contas`, `faturas` e `orcamento`). Este arquivo é o meu (tarefa
 * #78/qa): prova a REGRA em LARGURA — cada RN isolada, as invariantes do DoD
 * §5 com valores quebrados (não redondos, de propósito: o ponto é pegar
 * resíduo de divisão), e a cascata de RN-32 (retrabalho da revisão de #76)
 * com empates e "folga zero" no meio do laço. Nenhum cenário aqui repete os
 * valores ou a combinação de conta/cartão/categoria dos 7 testes de #76.
 *
 * Todos os valores de rateio abaixo foram conferidos rodando uma cópia fiel
 * do algoritmo de `ratearDeficit` (mesmo floor + cascata por folga) fora da
 * suíte, para não arriscar erro de aritmética manual num arquivo que existe
 * justamente para pegar erro de aritmética.
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
// tempo real DE PÉ (D-04/R3) — mesmo padrão de `testes/lastro.teste.ts`.
let stack: StackDeTempoReal;

beforeAll(async () => {
  await limparBanco();
  stack = await subirServidorComRealtime();
});

afterAll(async () => {
  await stack.encerrar();
  await fecharBanco();
});

// ---------------------------------------------------------------------------
// Apoio local — deliberadamente NÃO importado de `lastro.teste.ts` (arquivo
// alheio, tarefa #76): cada suíte de integração deste projeto já define seus
// próprios helpers de conta/categoria (ver também `orcamento.teste.ts`).
// ---------------------------------------------------------------------------

async function novaFamiliaComCookie(nome: string) {
  const familia = await criarFamiliaComMembro(nome);
  const cookie = await cookieDeSessao(familia.membroId);
  return { familia, cookie };
}

async function novaConta(cookie: string, dados: Record<string, unknown>): Promise<string> {
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

async function novoLancamento(cookie: string, dados: Record<string, unknown>) {
  const resposta = await request(app).post('/lancamentos').set('Cookie', cookie).send(dados);
  expect(resposta.status).toBe(201);
  return resposta.body;
}

async function novaDespesa(dados: {
  cookie: string;
  contaId: string;
  categoriaId: string;
  valorCentavos: number;
  data: string;
}) {
  return novoLancamento(dados.cookie, {
    tipo: 'DESPESA',
    descricao: 'Despesa da suíte de largura',
    valorCentavos: dados.valorCentavos,
    data: dados.data,
    contaId: dados.contaId,
    categoriaId: dados.categoriaId,
  });
}

async function novaReceita(dados: { cookie: string; contaId: string; valorCentavos: number; data: string }) {
  return novoLancamento(dados.cookie, {
    tipo: 'RECEITA',
    descricao: 'Receita da suíte de largura',
    valorCentavos: dados.valorCentavos,
    data: dados.data,
    contaId: dados.contaId,
  });
}

async function novaTransferencia(dados: {
  cookie: string;
  contaId: string;
  contaDestinoId: string;
  valorCentavos: number;
  data: string;
}) {
  return novoLancamento(dados.cookie, {
    tipo: 'TRANSFERENCIA',
    descricao: 'Guardar em meta (EF-07 não existe — RN-27 hoje)',
    valorCentavos: dados.valorCentavos,
    data: dados.data,
    contaId: dados.contaId,
    contaDestinoId: dados.contaDestinoId,
  });
}

async function lerCompetencia(cookie: string, competencia: string) {
  const resposta = await request(app).get(`/competencias/${competencia}`).set('Cookie', cookie);
  expect(resposta.status).toBe(200);
  return resposta;
}

interface CategoriaDaCompetencia {
  id: string;
  tetoCentavos: number;
  gastoCentavos: number;
  disponivelCentavos: number;
  liberadoCentavos: number;
  bloqueadoCentavos: number;
}

function acharCategoria(corpo: { categorias: CategoriaDaCompetencia[] }, id: string): CategoriaDaCompetencia {
  const linha = corpo.categorias.find(c => c.id === id);
  if (!linha) throw new Error(`categoria ${id} não apareceu na leitura da competência`);
  return linha;
}

// ===========================================================================
// DoD §5, item 1 — "um teste por RN acima" (RN-27..RN-32)
// ===========================================================================

describe('DoD §5.1 — RN-27: RESERVA fora do lastro, mesmo DINAMICAMENTE (ganha dinheiro depois)', () => {
  it('creditar a reserva não move o lastro nem um centavo', async () => {
    const { cookie } = await novaFamiliaComCookie('RN-27 dinâmico');
    await novaContaDebito(cookie, 'Conta corrente', 7777);
    const reserva = await novaContaReserva(cookie, 'Fundo de emergência', 333);

    const antes = await lerCompetencia(cookie, '2026-08');
    expect(antes.body.lastroCentavos).toBe(7777);

    // #76 já provou RESERVA fora do lastro NO ESTADO INICIAL (débito
    // negativo). Aqui a largura é: o lastro segue INSENSÍVEL à reserva
    // mesmo quando ela MUDA — RN-27 não é "reserva começa de fora", é
    // "reserva está SEMPRE de fora".
    await novaReceita({ cookie, contaId: reserva, valorCentavos: 4321, data: '2026-08-12' });

    const depois = await lerCompetencia(cookie, '2026-08');
    expect(depois.body.lastroCentavos).toBe(7777); // idêntico — a reserva cresceu, o lastro não.
  });
});

describe('DoD §5.1 — RN-28: limite livre de VÁRIOS cartões entra no lastro, valores quebrados', () => {
  it('soma limite livre de dois cartões com limites e despesa não redondos', async () => {
    const { cookie } = await novaFamiliaComCookie('RN-28 quebrado');
    const categoria = await novaCategoria(cookie, 'Auxiliar do cartão B');
    await novoCartao(cookie, 'Cartão A — sem uso', 77777);
    const cartaoB = await novoCartao(cookie, 'Cartão B — parcialmente usado', 54321);
    await novaDespesa({ cookie, contaId: cartaoB, categoriaId: categoria, valorCentavos: 12345, data: '2026-08-10' });

    const leitura = await lerCompetencia(cookie, '2026-08');
    // caixaReal = 0 (nenhuma DEBITO). limiteLivre A = 77777 (sem despesa).
    // limiteLivre B = 54321 − 12345 = 41976. lastro = 0 + 77777 + 41976.
    expect(leitura.body.lastroCentavos).toBe(119753);
  });
});

describe('DoD §5.1 — RN-29: pró-rata sem categoria privilegiada, com empate exato', () => {
  it('quatro categorias com o MESMO disponível recebem a MESMA fração — só o resíduo (não a regra) diferencia', async () => {
    const { cookie } = await novaFamiliaComCookie('RN-29 empate');
    // lastro = 1898 (conferido: restante 3108, déficit 1210, liberadoTotal 1898).
    await novaContaDebito(cookie, 'Conta do lastro', 1898);

    const p = await novaCategoria(cookie, 'P');
    const q = await novaCategoria(cookie, 'Q');
    const r = await novaCategoria(cookie, 'R');
    const s = await novaCategoria(cookie, 'S');
    for (const id of [p, q, r, s]) {
      await definirTeto(cookie, '2026-08', id, 777);
    }

    const leitura = await lerCompetencia(cookie, '2026-08');
    expect(leitura.body.deficitCentavos).toBe(1210);

    const linhaP = acharCategoria(leitura.body, p);
    const linhaQ = acharCategoria(leitura.body, q);
    const linhaR = acharCategoria(leitura.body, r);
    const linhaS = acharCategoria(leitura.body, s);

    // A FRAÇÃO pró-rata (o piso antes do resíduo) é IDÊNTICA para as quatro
    // — floor(777×1210/3108) = 302 para todas. RN-29 ("não há categoria
    // privilegiada") é sobre ISSO: a fração é igual. O resíduo de 2
    // centavos (1210 − 4×302 = 2) tem que cair em ALGUMA — aqui, na
    // primeira da ordem determinística — mas as outras TRÊS, que não
    // tinham nada de diferente de P, ficam EXATAMENTE iguais entre si.
    expect(linhaQ.bloqueadoCentavos).toBe(302);
    expect(linhaR.bloqueadoCentavos).toBe(302);
    expect(linhaS.bloqueadoCentavos).toBe(302);
    expect(linhaQ.bloqueadoCentavos).toBe(linhaR.bloqueadoCentavos);
    expect(linhaR.bloqueadoCentavos).toBe(linhaS.bloqueadoCentavos);

    // P absorve o resíduo inteiro (304 = 302 + 2) — não é privilégio, é o
    // mesmo mecanismo de RN-32 (destino do resíduo), aplicado ao caso
    // degenerado em que todo mundo empata em "maior saldo".
    expect(linhaP.bloqueadoCentavos).toBe(304);

    const soma =
      linhaP.bloqueadoCentavos + linhaQ.bloqueadoCentavos + linhaR.bloqueadoCentavos + linhaS.bloqueadoCentavos;
    expect(soma).toBe(1210);
  });
});

describe('DoD §5.1 — RN-30: o destaque é restante − déficit, NUNCA o plano cheio', () => {
  it('com gasto e déficit simultâneos, liberadoTotalCentavos é estritamente menor que o planejado', async () => {
    const { cookie } = await novaFamiliaComCookie('RN-30 destaque');
    // lastro = 1111 (conta com despesa de 2000, saldo inicial 3111).
    const conta = await novaContaDebito(cookie, 'Conta operacional', 3111);
    const categoria = await novaCategoria(cookie, 'Plano de 9001');
    await definirTeto(cookie, '2026-08', categoria, 9001);
    await novaDespesa({ cookie, contaId: conta, categoriaId: categoria, valorCentavos: 2000, data: '2026-08-05' });

    const leitura = await lerCompetencia(cookie, '2026-08');
    // caixaReal = 3111 − 2000 = 1111 = lastro (sem cartão).
    expect(leitura.body.lastroCentavos).toBe(1111);
    expect(leitura.body.planejadoCentavos).toBe(9001); // o "plano cheio".

    const linha = acharCategoria(leitura.body, categoria);
    expect(linha.disponivelCentavos).toBe(7001); // 9001 − 2000.
    // restanteTotal = 7001 (uma categoria). déficit = max(0, 7001−1111) = 5890.
    expect(leitura.body.deficitCentavos).toBe(5890);
    // RN-30: o número em destaque é restante − déficit = 7001 − 5890 = 1111.
    expect(leitura.body.liberadoTotalCentavos).toBe(1111);
    expect(linha.liberadoCentavos).toBe(1111);

    // A invariante literal da regra: NUNCA o plano cheio (9001) quando há
    // déficit — nem sequer o "disponível" bruto (7001), que já é menor que
    // o plano. O destaque tem que ser estritamente o valor pós-bloqueio.
    expect(leitura.body.liberadoTotalCentavos).toBeLessThan(leitura.body.planejadoCentavos);
    expect(leitura.body.liberadoTotalCentavos).toBeLessThan(linha.disponivelCentavos);
  });
});

describe('DoD §5.1/§5.5 — RN-31: entrada de dinheiro desbloqueia (e não mexe em teto nenhum)', () => {
  it('receita eleva o lastro, reduz o bloqueado de TODAS as categorias, mantém os tetos intactos', async () => {
    const { cookie } = await novaFamiliaComCookie('RN-31 desbloqueio');
    const conta = await novaContaDebito(cookie, 'Conta do lastro', 2223);
    const categoriaA = await novaCategoria(cookie, 'A — 3001');
    const categoriaB = await novaCategoria(cookie, 'B — 1999');
    await definirTeto(cookie, '2026-08', categoriaA, 3001);
    await definirTeto(cookie, '2026-08', categoriaB, 1999);

    const antes = await lerCompetencia(cookie, '2026-08');
    expect(antes.body.lastroCentavos).toBe(2223);
    expect(antes.body.deficitCentavos).toBe(2777);
    const antesA = acharCategoria(antes.body, categoriaA);
    const antesB = acharCategoria(antes.body, categoriaB);
    expect(antesA.tetoCentavos).toBe(3001);
    expect(antesB.tetoCentavos).toBe(1999);
    expect(antesA.bloqueadoCentavos).toBe(1667);
    expect(antesB.bloqueadoCentavos).toBe(1110);

    // Entra dinheiro — RECEITA numa conta DEBITO, sem tocar categoria nenhuma.
    await novaReceita({ cookie, contaId: conta, valorCentavos: 1478, data: '2026-08-20' });

    const depois = await lerCompetencia(cookie, '2026-08');
    expect(depois.body.lastroCentavos).toBe(3701); // 2223 + 1478.
    expect(depois.body.deficitCentavos).toBe(1299); // caiu de 2777.

    const depoisA = acharCategoria(depois.body, categoriaA);
    const depoisB = acharCategoria(depois.body, categoriaB);

    // Os DOIS lados do DoD §5.5: bloqueado caiu, teto ficou IDÊNTICO.
    expect(depoisA.bloqueadoCentavos).toBe(780);
    expect(depoisB.bloqueadoCentavos).toBe(519);
    expect(depoisA.bloqueadoCentavos).toBeLessThan(antesA.bloqueadoCentavos);
    expect(depoisB.bloqueadoCentavos).toBeLessThan(antesB.bloqueadoCentavos);
    expect(depoisA.tetoCentavos).toBe(antesA.tetoCentavos);
    expect(depoisB.tetoCentavos).toBe(antesB.tetoCentavos);
    // RN-31 na letra: "não aumenta teto nenhum" — planejado (soma dos tetos)
    // também tem que ficar parado.
    expect(depois.body.planejadoCentavos).toBe(antes.body.planejadoCentavos);
  });
});

describe('DoD §5.1 — RN-32: resíduo vai para o maior saldo, sem empate (vencedor único)', () => {
  it('cinco categorias assimétricas — o resíduo cai inteiro na de maior disponível, e só nela', async () => {
    const { cookie } = await novaFamiliaComCookie('RN-32 vencedor único');
    await novaContaDebito(cookie, 'Conta do lastro', 3333);

    const a = await novaCategoria(cookie, 'A — 1237');
    const b = await novaCategoria(cookie, 'B — 2589');
    const c = await novaCategoria(cookie, 'C — 999');
    const d = await novaCategoria(cookie, 'D — 4001 (a maior)');
    const e = await novaCategoria(cookie, 'E — 173');
    await definirTeto(cookie, '2026-08', a, 1237);
    await definirTeto(cookie, '2026-08', b, 2589);
    await definirTeto(cookie, '2026-08', c, 999);
    await definirTeto(cookie, '2026-08', d, 4001);
    await definirTeto(cookie, '2026-08', e, 173);

    const leitura = await lerCompetencia(cookie, '2026-08');
    // restante = 8999; déficit = 8999 − 3333 = 5666.
    expect(leitura.body.deficitCentavos).toBe(5666);

    const linhaA = acharCategoria(leitura.body, a);
    const linhaB = acharCategoria(leitura.body, b);
    const linhaC = acharCategoria(leitura.body, c);
    const linhaD = acharCategoria(leitura.body, d);
    const linhaE = acharCategoria(leitura.body, e);

    // Piso pró-rata (floor) de cada uma, conferido fora da suíte:
    expect(linhaA.bloqueadoCentavos).toBe(778);
    expect(linhaB.bloqueadoCentavos).toBe(1630);
    expect(linhaC.bloqueadoCentavos).toBe(628);
    expect(linhaE.bloqueadoCentavos).toBe(108);
    // Soma dos pisos = 5663; resíduo = 5666 − 5663 = 3 — cai INTEIRO em D,
    // a única de maior disponível (4001, sem empate): 2519 (piso) + 3.
    expect(linhaD.bloqueadoCentavos).toBe(2522);

    const somaDosBloqueados =
      linhaA.bloqueadoCentavos +
      linhaB.bloqueadoCentavos +
      linhaC.bloqueadoCentavos +
      linhaD.bloqueadoCentavos +
      linhaE.bloqueadoCentavos;
    expect(somaDosBloqueados).toBe(5666); // RN-32 — invariante central, ver DoD §5.2 abaixo também.

    for (const linha of [linhaA, linhaB, linhaC, linhaD, linhaE]) {
      expect(linha.bloqueadoCentavos).toBeLessThanOrEqual(linha.disponivelCentavos);
    }
  });
});

// ===========================================================================
// DoD §5, item 2 — "soma dos bloqueados == déficit, exatamente" (o caso
// central já demonstrado acima em largura de 5 categorias — RN-32). Aqui
// mais um ângulo: perto do bloqueio TOTAL, onde duas categorias acabam
// bloqueadas em CHEIO (bloqueado == disponível, o limite exato do item 4).
// ===========================================================================

describe('DoD §5.2/§5.4 — soma == déficit no limite: duas categorias tocam o teto exato do disponível', () => {
  it('déficit quase total (200 de 201): duas categorias ficam 100% bloqueadas, sem NUNCA passar do disponível', async () => {
    const { cookie } = await novaFamiliaComCookie('Quase bloqueio total');
    await novaContaDebito(cookie, 'Quase nada de lastro', 1);

    const x41 = await novaCategoria(cookie, 'X41');
    const x59 = await novaCategoria(cookie, 'X59');
    const x101 = await novaCategoria(cookie, 'X101');
    await definirTeto(cookie, '2026-08', x41, 41);
    await definirTeto(cookie, '2026-08', x59, 59);
    await definirTeto(cookie, '2026-08', x101, 101);

    const leitura = await lerCompetencia(cookie, '2026-08');
    // restante = 201; déficit = 201 − 1 = 200.
    expect(leitura.body.deficitCentavos).toBe(200);

    const linha41 = acharCategoria(leitura.body, x41);
    const linha59 = acharCategoria(leitura.body, x59);
    const linha101 = acharCategoria(leitura.body, x101);

    // Conferido fora da suíte: pisos 40/58/100, resíduo 2 cai em cascata —
    // primeiro na maior (101 → completa 101, folga esgotada), depois na
    // segunda maior (59 → completa 59). A menor (41) fica no piso puro.
    expect(linha101.bloqueadoCentavos).toBe(101);
    expect(linha59.bloqueadoCentavos).toBe(59);
    expect(linha41.bloqueadoCentavos).toBe(40);

    // DoD §5.4 no limite exato: bloqueado == disponível para as duas
    // maiores (liberado zerado), e NUNCA maior que o disponível para
    // nenhuma — inclusive quando bate na igualdade.
    expect(linha101.liberadoCentavos).toBe(0);
    expect(linha59.liberadoCentavos).toBe(0);
    expect(linha41.liberadoCentavos).toBe(1);
    for (const linha of [linha41, linha59, linha101]) {
      expect(linha.bloqueadoCentavos).toBeLessThanOrEqual(linha.disponivelCentavos);
      expect(linha.liberadoCentavos).toBeGreaterThanOrEqual(0);
    }

    const soma = linha41.bloqueadoCentavos + linha59.bloqueadoCentavos + linha101.bloqueadoCentavos;
    expect(soma).toBe(200); // == déficit, exatamente.
  });
});

// ===========================================================================
// DoD §5, item 3 — "sem déficit → bloqueado zero em TODAS" (largura: mais de
// uma categoria, tetos quebrados, não só a categoria única de #76)
// ===========================================================================

describe('DoD §5.3 — sem déficit, bloqueado zero em TODAS as categorias (quatro, tetos quebrados)', () => {
  it('lastro folgado: liberado == disponível e bloqueado == 0 em cada uma das quatro categorias', async () => {
    const { cookie } = await novaFamiliaComCookie('Sem déficit — largura');
    await novaContaDebito(cookie, 'Conta bem recheada', 999999);

    const tetos = [1237, 89, 5005, 333];
    const categoriasCriadas: { id: string; teto: number }[] = [];
    for (const [i, teto] of tetos.entries()) {
      const id = await novaCategoria(cookie, `Categoria ${i}`);
      await definirTeto(cookie, '2026-08', id, teto);
      categoriasCriadas.push({ id, teto });
    }

    const leitura = await lerCompetencia(cookie, '2026-08');
    expect(leitura.body.deficitCentavos).toBe(0);
    // restante = 1237+89+5005+333 = 6664, bem abaixo de 999999.
    expect(leitura.body.liberadoTotalCentavos).toBe(6664);

    for (const { id, teto } of categoriasCriadas) {
      const linha = acharCategoria(leitura.body, id);
      expect(linha.bloqueadoCentavos).toBe(0);
      expect(linha.liberadoCentavos).toBe(teto);
      expect(linha.disponivelCentavos).toBe(teto);
    }
  });
});

// ===========================================================================
// DoD §5, item 6 — "guardar em meta reduz o lastro" — TRANSFERENCIA de
// DEBITO para RESERVA (EF-07/metas não existe no schema; decisão do
// condutor citada na issue #78: hoje isto é RN-27 pura, dinamicamente).
// ===========================================================================

describe('DoD §5.6 — guardar em meta (TRANSFERENCIA DEBITO→RESERVA) reduz o lastro exatamente pelo valor guardado', () => {
  it('a transferência não é despesa (não toca teto/gasto), mas reduz o caixa real e pode criar bloqueio novo', async () => {
    const { cookie } = await novaFamiliaComCookie('Guardar em meta');
    const debito = await novaContaDebito(cookie, 'Conta corrente', 6543);
    const reserva = await novaContaReserva(cookie, 'Minha meta', 100);
    const categoria = await novaCategoria(cookie, 'Categoria de 6000');
    await definirTeto(cookie, '2026-08', categoria, 6000);

    const antes = await lerCompetencia(cookie, '2026-08');
    expect(antes.body.lastroCentavos).toBe(6543);
    expect(antes.body.deficitCentavos).toBe(0); // lastro folgado, ninguém bloqueado ainda.
    const categoriaAntes = acharCategoria(antes.body, categoria);
    expect(categoriaAntes.tetoCentavos).toBe(6000);
    expect(categoriaAntes.gastoCentavos).toBe(0);
    expect(categoriaAntes.bloqueadoCentavos).toBe(0);

    // "Guardar em meta HOJE" — decisão do condutor (issue #78): uma
    // TRANSFERENCIA de DEBITO para RESERVA. Valor quebrado de propósito.
    await novaTransferencia({
      cookie,
      contaId: debito,
      contaDestinoId: reserva,
      valorCentavos: 2222,
      data: '2026-08-15',
    });

    const depois = await lerCompetencia(cookie, '2026-08');
    // lastro caiu EXATAMENTE o valor guardado — RN-27: a reserva cresceu
    // (100 → 2322) mas fica de fora; só a perda de caixa real da DEBITO
    // (6543 → 4321) é o que se reflete no lastro.
    expect(depois.body.lastroCentavos).toBe(4321); // 6543 − 2222.

    const categoriaDepois = acharCategoria(depois.body, categoria);
    // "Transferência não é despesa" (regra inviolável #3 do CONTEXT.md):
    // teto e gasto da categoria não se mexem NADA.
    expect(categoriaDepois.tetoCentavos).toBe(6000);
    expect(categoriaDepois.gastoCentavos).toBe(0);
    expect(categoriaDepois.disponivelCentavos).toBe(6000);

    // E o lastro reduzido é o suficiente para CRIAR bloqueio que não
    // existia antes — "o dinheiro passou a estar comprometido" na prática,
    // não só na leitura de um número isolado.
    expect(depois.body.deficitCentavos).toBe(1679); // 6000 − 4321.
    expect(categoriaDepois.bloqueadoCentavos).toBe(1679);
    expect(categoriaDepois.liberadoCentavos).toBe(4321);
  });
});

// ===========================================================================
// Retrabalho da revisão de #76 — cap do déficit em restanteTotal e cascata do
// resíduo (classificado 🔵 extensão sobre RN-32). #76 já prova os dois com UM
// caso cada; aqui a LARGURA pedida pela tarefa #78: cascata com EMPATE entre
// mais de uma categoria E uma categoria de disponível ZERO no meio do rateio
// (a "folga zero" que o laço de cascata precisa pular sem quebrar nada).
// ===========================================================================

describe('Retrabalho #76 — cascata do resíduo em largura: empate de duas categorias + uma de disponível zero', () => {
  it('categoria zerada nunca recebe nada; o resíduo cai em cascata por DUAS das três empatadas, a terceira fica no piso', async () => {
    const { cookie } = await novaFamiliaComCookie('Cascata — empate e disponível zero');
    // Categoria A é zerada DE VERDADE (teto == gasto, disponível = 0) — não
    // é uma categoria "pequena", é uma categoria SEM NADA a bloquear. Uma
    // conta DEBITO paga essa despesa (saldo 500 → 0 depois da despesa).
    const contaDaDespesa = await novaContaDebito(cookie, 'Paga a despesa de A', 500);
    // Uma segunda conta DEBITO sustenta o lastro em exatamente 1 (0 + 1).
    await novaContaDebito(cookie, 'Sustenta o lastro em 1', 1);

    const categoriaA = await novaCategoria(cookie, 'A — zerada (teto == gasto)');
    const categoriaB = await novaCategoria(cookie, 'B — 2');
    const categoriaC = await novaCategoria(cookie, 'C — 2');
    const categoriaD = await novaCategoria(cookie, 'D — 2');
    await definirTeto(cookie, '2026-08', categoriaA, 500);
    await definirTeto(cookie, '2026-08', categoriaB, 2);
    await definirTeto(cookie, '2026-08', categoriaC, 2);
    await definirTeto(cookie, '2026-08', categoriaD, 2);
    await novaDespesa({
      cookie,
      contaId: contaDaDespesa,
      categoriaId: categoriaA,
      valorCentavos: 500,
      data: '2026-08-03',
    });

    const leitura = await lerCompetencia(cookie, '2026-08');
    // lastro = max(0, 500−500) + max(0, 1) = 1.
    expect(leitura.body.lastroCentavos).toBe(1);
    // restante = 0(A) + 2 + 2 + 2 = 6. déficit = 6 − 1 = 5.
    expect(leitura.body.deficitCentavos).toBe(5);

    const linhaA = acharCategoria(leitura.body, categoriaA);
    const linhaB = acharCategoria(leitura.body, categoriaB);
    const linhaC = acharCategoria(leitura.body, categoriaC);
    const linhaD = acharCategoria(leitura.body, categoriaD);

    // A categoria zerada tem folga ZERO do início ao fim do laço de
    // cascata — ela nunca é candidata útil, e o código precisa PULAR por
    // cima dela (ou nunca a selecionar) sem travar nem sobrar resíduo.
    expect(linhaA.disponivelCentavos).toBe(0);
    expect(linhaA.bloqueadoCentavos).toBe(0);
    expect(linhaA.liberadoCentavos).toBe(0);

    // Conferido fora da suíte: piso floor(2×5/6)=1 para B, C e D — soma 3,
    // resíduo 2. As três empatam em disponível (2); a cascata visita a
    // primeira (folga 2−1=1, absorve 1, ESGOTA a folga — "folga zero" no
    // meio do laço), passa para a segunda (mesma folga 1, absorve o
    // último centavo do resíduo), e a terceira fica intocada no piso.
    const bloqueados = [linhaB.bloqueadoCentavos, linhaC.bloqueadoCentavos, linhaD.bloqueadoCentavos].sort(
      (x, y) => x - y,
    );
    expect(bloqueados).toEqual([1, 2, 2]); // duas completam (2 == disponível), uma fica no piso (1).

    for (const linha of [linhaB, linhaC, linhaD]) {
      expect(linha.bloqueadoCentavos).toBeLessThanOrEqual(linha.disponivelCentavos);
      expect(linha.liberadoCentavos).toBeGreaterThanOrEqual(0);
    }

    // RN-32 — a invariante que amarra tudo: soma dos bloqueados (incluindo
    // a categoria zerada, que contribui 0) é EXATAMENTE o déficit.
    const soma =
      linhaA.bloqueadoCentavos + linhaB.bloqueadoCentavos + linhaC.bloqueadoCentavos + linhaD.bloqueadoCentavos;
    expect(soma).toBe(5);
  });
});
