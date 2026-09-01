/**
 * Integração de `orcamento` (EF-03/tarefa #44) — Postgres de verdade, HTTP
 * real.
 *
 * ⛔ Regra #0: RN-09..RN-14 e RN-40 testadas aqui vêm de
 * `.preator/skills/negocio/orcamento-por-envelope/SKILL.md` (glossário e
 * tabela "Regras de negócio"), que cita `docs/especificacoes/EF-03-orcamento.md`
 * §1/§2 e a issue #44 (comentário do humano, 2026-08-27) como fonte primária.
 * Nenhuma regra testada aqui foi inventada.
 *
 * `gastoCentavos` (RN-10) e `recebidoCentavos` (RN-11/RN-39) somam
 * `lancamentos` de verdade desde a EF-04 (tarefa #52) —
 * `src/modulos/orcamento/servico.ts#expressaoGastoDerivado`/`recebidoDaCompetencia`.
 * Os testes de RN-09/RN-12/RN-13/RN-14/RN-40 abaixo continuam sem criar
 * lançamento nenhum: como o conjunto correlacionado é sempre vazio para eles,
 * a soma nasce 0 pela própria SQL (`coalesce(sum(...), 0)`), não por um
 * placeholder fixo — mesmo resultado de antes, agora por leitura real. As
 * seções "RN-10 — com lançamentos reais" e "RN-39" abaixo é que provam a soma
 * com dado de verdade.
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
  type FamiliaDeTeste,
  type StackDeTempoReal,
} from './apoio';

const app = abrirApp();

let familiaA: FamiliaDeTeste;
let familiaB: FamiliaDeTeste;
let cookieA: string;
let cookieB: string;
// Toda mutação de orçamento emite invalidação (D-04/R3), e o emissor exige o
// servidor de tempo real DE PÉ — mesmo padrão de `testes/contas.teste.ts`.
let stack: StackDeTempoReal;

beforeAll(async () => {
  await limparBanco();
  familiaA = await criarFamiliaComMembro('Família A do orçamento');
  familiaB = await criarFamiliaComMembro('Família B do orçamento');
  cookieA = await cookieDeSessao(familiaA.membroId);
  cookieB = await cookieDeSessao(familiaB.membroId);
  stack = await subirServidorComRealtime();
});

afterAll(async () => {
  await stack.encerrar();
  await fecharBanco();
});

interface CategoriaCriada {
  id: string;
  nome: string;
  icone: string;
  cor: string;
}

async function criarCategoria(cookie: string, nome: string): Promise<CategoriaCriada> {
  const resposta = await request(app)
    .post('/categorias')
    .set('Cookie', cookie)
    .send({ nome, icone: 'ti-glass-full', cor: '#000000' });
  expect(resposta.status).toBe(201);
  return resposta.body as CategoriaCriada;
}

async function definirTeto(
  cookie: string,
  competencia: string,
  categoriaId: string,
  tetoCentavos: number,
) {
  return request(app)
    .put(`/competencias/${competencia}/categorias/${categoriaId}/teto`)
    .set('Cookie', cookie)
    .send({ tetoCentavos });
}

async function lerCompetencia(cookie: string, competencia: string) {
  return request(app).get(`/competencias/${competencia}`).set('Cookie', cookie);
}

describe('categorias — cadastro e leitura', () => {
  it('cria uma categoria SEM VALOR (RN-09: teto não é dela)', async () => {
    const resposta = await request(app)
      .post('/categorias')
      .set('Cookie', cookieA)
      .send({ nome: 'Mercado', icone: 'ti-shopping-cart', cor: '#16a34a' });

    expect(resposta.status).toBe(201);
    expect(resposta.body.nome).toBe('Mercado');
    // A forma da Categoria não tem NENHUM campo de valor/teto.
    expect(resposta.body).not.toHaveProperty('teto');
    expect(resposta.body).not.toHaveProperty('tetoCentavos');
  });

  it('GET /categorias lista as categorias da família da sessão', async () => {
    const resposta = await request(app).get('/categorias').set('Cookie', cookieA);
    expect(resposta.status).toBe(200);
    expect(resposta.body.categorias.length).toBeGreaterThanOrEqual(1);
  });

  it('sem sessão, GET /categorias responde 401', async () => {
    const resposta = await request(app).get('/categorias');
    expect(resposta.status).toBe(401);
  });

  it('PATCH edita nome/ícone/cor; DELETE apaga', async () => {
    const criada = await criarCategoria(cookieA, 'Categoria para editar e apagar');

    const editada = await request(app)
      .patch(`/categorias/${criada.id}`)
      .set('Cookie', cookieA)
      .send({ nome: 'Editada', icone: 'coracao', cor: '#ffffff' });
    expect(editada.status).toBe(200);
    expect(editada.body.nome).toBe('Editada');

    const apagada = await request(app).delete(`/categorias/${criada.id}`).set('Cookie', cookieA);
    expect(apagada.status).toBe(204);

    const depois = await request(app).get('/categorias').set('Cookie', cookieA);
    const ids = (depois.body.categorias as CategoriaCriada[]).map(c => c.id);
    expect(ids).not.toContain(criada.id);
  });

  it('editar/apagar categoria inexistente responde 404', async () => {
    const idInexistente = '00000000-0000-0000-0000-000000000000';
    const patch = await request(app)
      .patch(`/categorias/${idInexistente}`)
      .set('Cookie', cookieA)
      .send({ nome: 'X', icone: 'x', cor: '#000' });
    expect(patch.status).toBe(404);

    const del = await request(app).delete(`/categorias/${idInexistente}`).set('Cookie', cookieA);
    expect(del.status).toBe(404);
  });
});

describe('RN-09 — o teto pertence ao par categoria × competência, nunca à categoria', () => {
  it('o mesmo teto NÃO aparece automaticamente em outra competência', async () => {
    const categoria = await criarCategoria(cookieA, 'RN-09 Transporte');

    const definiu = await definirTeto(cookieA, '2026-03', categoria.id, 20000);
    expect(definiu.status).toBe(200);
    expect(definiu.body).toEqual({
      categoriaId: categoria.id,
      competencia: '2026-03',
      tetoCentavos: 20000,
    });

    const marco = await lerCompetencia(cookieA, '2026-03');
    const linhaMarco = marco.body.categorias.find((c: { id: string }) => c.id === categoria.id);
    expect(linhaMarco.tetoCentavos).toBe(20000);

    // Mesma categoria, competência DIFERENTE, nunca recebeu OrcamentoMes: 0.
    const abril = await lerCompetencia(cookieA, '2026-04');
    const linhaAbril = abril.body.categorias.find((c: { id: string }) => c.id === categoria.id);
    expect(linhaAbril.tetoCentavos).toBe(0);
  });

  it('definir teto de categoria de outra família responde 404 (isolamento também aqui)', async () => {
    const categoriaDeA = await criarCategoria(cookieA, 'RN-09 só de A');
    const resposta = await definirTeto(cookieB, '2026-03', categoriaDeA.id, 1000);
    expect(resposta.status).toBe(404);
  });
});

describe('RN-10 — disponível = teto − gasto do mês; negativo é estourou', () => {
  it('sem nenhum lançamento DESPESA nesta categoria/competência, disponível == teto', async () => {
    const categoria = await criarCategoria(cookieA, 'RN-10 Farmácia');
    await definirTeto(cookieA, '2026-05', categoria.id, 8000);

    const leitura = await lerCompetencia(cookieA, '2026-05');
    const linha = leitura.body.categorias.find((c: { id: string }) => c.id === categoria.id);

    expect(linha.gastoCentavos).toBe(0);
    expect(linha.disponivelCentavos).toBe(8000 - 0);
  });

  it('teto negativo (via remanejamento) faz disponível negativo — "estourou"', async () => {
    const origem = await criarCategoria(cookieA, 'RN-10 origem sem sobra');
    const destino = await criarCategoria(cookieA, 'RN-10 destino');
    await definirTeto(cookieA, '2026-05', origem.id, 1000);

    const remanejou = await request(app)
      .post('/competencias/2026-05/remanejamentos')
      .set('Cookie', cookieA)
      .send({ categoriaOrigemId: origem.id, categoriaDestinoId: destino.id, valorCentavos: 4000 });
    expect(remanejou.status).toBe(201);

    const leitura = await lerCompetencia(cookieA, '2026-05');
    const linha = leitura.body.categorias.find((c: { id: string }) => c.id === origem.id);
    expect(linha.tetoCentavos).toBe(1000 - 4000);
    expect(linha.disponivelCentavos).toBeLessThan(0);
  });
});

describe('RN-10 — com lançamentos reais da EF-04 (tarefa #52)', () => {
  it('gastoCentavos soma as DESPESA da categoria nesta competência, e só delas', async () => {
    const familia = await criarFamiliaComMembro('Família RN-10 real');
    const cookie = await cookieDeSessao(familia.membroId);
    const conta = await request(app)
      .post('/contas')
      .set('Cookie', cookie)
      .send({ tipo: 'DEBITO', nome: 'Conta RN-10', icone: 'banco', cor: '#000', saldoInicialCentavos: 0 });
    const categoria = await criarCategoria(cookie, 'RN-10 real');
    const outraCategoria = await criarCategoria(cookie, 'RN-10 real — outra');
    await definirTeto(cookie, '2026-06', categoria.id, 10000);

    await request(app).post('/lancamentos').set('Cookie', cookie).send({
      tipo: 'DESPESA',
      descricao: 'Gasto 1',
      valorCentavos: 3000,
      data: '2026-06-05',
      contaId: conta.body.id,
      categoriaId: categoria.id,
    });
    await request(app).post('/lancamentos').set('Cookie', cookie).send({
      tipo: 'DESPESA',
      descricao: 'Gasto 2',
      valorCentavos: 1500,
      data: '2026-06-20',
      contaId: conta.body.id,
      categoriaId: categoria.id,
    });
    // Gasto em OUTRA categoria não pode contaminar `categoria`.
    await request(app).post('/lancamentos').set('Cookie', cookie).send({
      tipo: 'DESPESA',
      descricao: 'Gasto em outra categoria',
      valorCentavos: 99999,
      data: '2026-06-10',
      contaId: conta.body.id,
      categoriaId: outraCategoria.id,
    });

    const leitura = await lerCompetencia(cookie, '2026-06');
    const linha = leitura.body.categorias.find((c: { id: string }) => c.id === categoria.id);
    expect(linha.gastoCentavos).toBe(3000 + 1500);
    expect(linha.disponivelCentavos).toBe(10000 - (3000 + 1500));
  });
});

describe('RN-11 — planejado = Σ tetos; não alocado = recebido − planejado', () => {
  it('planejado soma os tetos das categorias; sem lançamento RECEITA, recebido é 0', async () => {
    // Competência isolada, para o total ser previsível mesmo com o resto da suíte.
    const familia = await criarFamiliaComMembro('Família RN-11');
    const cookie = await cookieDeSessao(familia.membroId);

    const a = await criarCategoria(cookie, 'A');
    const b = await criarCategoria(cookie, 'B');
    await definirTeto(cookie, '2026-06', a.id, 10000);
    await definirTeto(cookie, '2026-06', b.id, 5000);

    const leitura = await lerCompetencia(cookie, '2026-06');
    expect(leitura.body.planejadoCentavos).toBe(15000);
    // RN-39 (EF-04 §2): recebido é soma dos lançamentos RECEITA da
    // competência. Nenhum lançamento foi criado nesta família/competência, e
    // a SQL soma um conjunto vazio como 0 (`coalesce(sum(...), 0)`).
    expect(leitura.body.recebidoCentavos).toBe(0);
    expect(leitura.body.naoAlocadoCentavos).toBe(0 - 15000);
  });

  it('não alocado usa recebido REAL (RN-39) — soma dos lançamentos RECEITA da competência', async () => {
    const familia = await criarFamiliaComMembro('Família RN-11 real');
    const cookie = await cookieDeSessao(familia.membroId);
    const conta = await request(app)
      .post('/contas')
      .set('Cookie', cookie)
      .send({ tipo: 'DEBITO', nome: 'Conta RN-11', icone: 'banco', cor: '#000', saldoInicialCentavos: 0 });
    const categoria = await criarCategoria(cookie, 'RN-11 real');
    await definirTeto(cookie, '2026-06', categoria.id, 4000);

    await request(app).post('/lancamentos').set('Cookie', cookie).send({
      tipo: 'RECEITA',
      descricao: 'Salário',
      valorCentavos: 20000,
      data: '2026-06-05',
      contaId: conta.body.id,
    });

    const leitura = await lerCompetencia(cookie, '2026-06');
    expect(leitura.body.recebidoCentavos).toBe(20000);
    expect(leitura.body.naoAlocadoCentavos).toBe(20000 - 4000);
  });
});

describe('RN-12 — renda acima da prevista não altera teto nenhum', () => {
  it('definir uma renda prevista alta não muda teto, planejado nem não alocado', async () => {
    const familia = await criarFamiliaComMembro('Família RN-12');
    const cookie = await cookieDeSessao(familia.membroId);

    const categoria = await criarCategoria(cookie, 'RN-12 categoria');
    await definirTeto(cookie, '2026-07', categoria.id, 3000);

    const antes = await lerCompetencia(cookie, '2026-07');
    expect(antes.body.planejadoCentavos).toBe(3000);
    expect(antes.body.naoAlocadoCentavos).toBe(0 - 3000);

    const definiuRenda = await request(app)
      .put('/competencias/2026-07/renda-prevista')
      .set('Cookie', cookie)
      .send({ rendaPrevistaCentavos: 999999 });
    expect(definiuRenda.status).toBe(200);

    const depois = await lerCompetencia(cookie, '2026-07');
    expect(depois.body.rendaPrevistaCentavos).toBe(999999);
    // Nenhum teto mudou, e naoAlocado continua vindo de RECEBIDO, não de
    // renda prevista (RN-12) — os dois números ficam EXATAMENTE iguais.
    expect(depois.body.planejadoCentavos).toBe(antes.body.planejadoCentavos);
    expect(depois.body.naoAlocadoCentavos).toBe(antes.body.naoAlocadoCentavos);
    const categoriaDepois = depois.body.categorias.find(
      (c: { id: string }) => c.id === categoria.id,
    );
    expect(categoriaDepois.tetoCentavos).toBe(3000);
  });
});

describe('RN-13 — remanejar altera só a competência corrente, e registra o autor', () => {
  it('move teto de origem para destino NA competência informada, com autor', async () => {
    const origem = await criarCategoria(cookieA, 'RN-13 origem');
    const destino = await criarCategoria(cookieA, 'RN-13 destino');
    await definirTeto(cookieA, '2026-08', origem.id, 10000);
    await definirTeto(cookieA, '2026-08', destino.id, 2000);

    const resposta = await request(app)
      .post('/competencias/2026-08/remanejamentos')
      .set('Cookie', cookieA)
      .send({ categoriaOrigemId: origem.id, categoriaDestinoId: destino.id, valorCentavos: 3000 });

    expect(resposta.status).toBe(201);
    expect(resposta.body.competencia).toBe('2026-08');
    expect(resposta.body.categoriaOrigemId).toBe(origem.id);
    expect(resposta.body.categoriaDestinoId).toBe(destino.id);
    expect(resposta.body.valorCentavos).toBe(3000);
    // O histórico registra QUEM fez — o autor é o membro da sessão.
    expect(resposta.body.autorMembroId).toBe(familiaA.membroId);

    const leitura = await lerCompetencia(cookieA, '2026-08');
    const linhaOrigem = leitura.body.categorias.find((c: { id: string }) => c.id === origem.id);
    const linhaDestino = leitura.body.categorias.find((c: { id: string }) => c.id === destino.id);
    expect(linhaOrigem.tetoCentavos).toBe(10000 - 3000);
    expect(linhaDestino.tetoCentavos).toBe(2000 + 3000);
  });

  it('DoD explícito: remanejar em AGOSTO não altera SETEMBRO', async () => {
    const origem = await criarCategoria(cookieA, 'Agosto→Setembro origem');
    const destino = await criarCategoria(cookieA, 'Agosto→Setembro destino');
    await definirTeto(cookieA, '2026-08', origem.id, 10000);
    await definirTeto(cookieA, '2026-08', destino.id, 1000);
    // Setembro tem os SEUS PRÓPRIOS tetos, deliberadamente diferentes dos de
    // agosto — se agosto vazasse para setembro, estes valores mudariam.
    await definirTeto(cookieA, '2026-09', origem.id, 5000);
    await definirTeto(cookieA, '2026-09', destino.id, 500);

    const antesDeSetembro = await lerCompetencia(cookieA, '2026-09');

    const remanejou = await request(app)
      .post('/competencias/2026-08/remanejamentos')
      .set('Cookie', cookieA)
      .send({ categoriaOrigemId: origem.id, categoriaDestinoId: destino.id, valorCentavos: 4000 });
    expect(remanejou.status).toBe(201);
    expect(remanejou.body.competencia).toBe('2026-08');

    // Agosto mudou.
    const agosto = await lerCompetencia(cookieA, '2026-08');
    const origemAgosto = agosto.body.categorias.find((c: { id: string }) => c.id === origem.id);
    expect(origemAgosto.tetoCentavos).toBe(10000 - 4000);

    // Setembro NÃO mudou — exatamente os valores de antes do remanejamento.
    const depoisDeSetembro = await lerCompetencia(cookieA, '2026-09');
    expect(depoisDeSetembro.body).toEqual(antesDeSetembro.body);
  });
});

describe('RN-14 — sem categoria com sobra, a API permite deixar negativo — não trava', () => {
  it('remaneja mais do que a origem tem, e a operação NÃO é recusada', async () => {
    const origem = await criarCategoria(cookieA, 'RN-14 origem pequena');
    const destino = await criarCategoria(cookieA, 'RN-14 destino');
    await definirTeto(cookieA, '2026-10', origem.id, 1000);
    await definirTeto(cookieA, '2026-10', destino.id, 500);

    const resposta = await request(app)
      .post('/competencias/2026-10/remanejamentos')
      .set('Cookie', cookieA)
      .send({ categoriaOrigemId: origem.id, categoriaDestinoId: destino.id, valorCentavos: 6000 });

    // Não trava: 201, não 409/422.
    expect(resposta.status).toBe(201);

    const leitura = await lerCompetencia(cookieA, '2026-10');
    const linhaOrigem = leitura.body.categorias.find((c: { id: string }) => c.id === origem.id);
    expect(linhaOrigem.tetoCentavos).toBe(1000 - 6000);
    expect(linhaOrigem.disponivelCentavos).toBeLessThan(0);
  });

  it('remaneja para/da categoria sem OrcamentoMes nenhum (RN-40 + RN-14 juntas)', async () => {
    const origem = await criarCategoria(cookieA, 'RN-14 sem teto nenhum');
    const destino = await criarCategoria(cookieA, 'RN-14 destino de categoria zerada');
    // Nenhum PUT de teto para `origem` nesta competência: ela lê 0 (RN-40).

    const resposta = await request(app)
      .post('/competencias/2026-11/remanejamentos')
      .set('Cookie', cookieA)
      .send({ categoriaOrigemId: origem.id, categoriaDestinoId: destino.id, valorCentavos: 1500 });

    expect(resposta.status).toBe(201);

    const leitura = await lerCompetencia(cookieA, '2026-11');
    const linhaOrigem = leitura.body.categorias.find((c: { id: string }) => c.id === origem.id);
    expect(linhaOrigem.tetoCentavos).toBe(0 - 1500);
  });
});

describe('RN-40 — categoria sem OrcamentoMes na competência lê como teto zero', () => {
  it('categoria recém-criada, nunca orçada, aparece com teto/gasto/disponível = 0', async () => {
    const categoria = await criarCategoria(cookieA, 'RN-40 nunca orçada');

    const leitura = await lerCompetencia(cookieA, '2027-01');
    const linha = leitura.body.categorias.find((c: { id: string }) => c.id === categoria.id);

    expect(linha).toBeDefined();
    expect(linha.tetoCentavos).toBe(0);
    expect(linha.gastoCentavos).toBe(0);
    expect(linha.disponivelCentavos).toBe(0);
  });
});

describe('validação de corpo e de competência', () => {
  it('competência fora do formato AAAA-MM responde 422', async () => {
    const resposta = await lerCompetencia(cookieA, '2026-13');
    expect(resposta.status).toBe(422);
  });

  it('remanejamento com origem igual a destino responde 422', async () => {
    const categoria = await criarCategoria(cookieA, 'Origem igual destino');
    const resposta = await request(app)
      .post('/competencias/2026-08/remanejamentos')
      .set('Cookie', cookieA)
      .send({ categoriaOrigemId: categoria.id, categoriaDestinoId: categoria.id, valorCentavos: 100 });
    expect(resposta.status).toBe(422);
  });

  it('remanejamento com valor não positivo responde 422', async () => {
    const origem = await criarCategoria(cookieA, 'Valor zero origem');
    const destino = await criarCategoria(cookieA, 'Valor zero destino');
    const resposta = await request(app)
      .post('/competencias/2026-08/remanejamentos')
      .set('Cookie', cookieA)
      .send({ categoriaOrigemId: origem.id, categoriaDestinoId: destino.id, valorCentavos: 0 });
    expect(resposta.status).toBe(422);
  });

  it('definir teto negativo diretamente responde 422 (só remanejamento pode deixar negativo)', async () => {
    const categoria = await criarCategoria(cookieA, 'Teto negativo direto');
    const resposta = await definirTeto(cookieA, '2026-08', categoria.id, -100);
    expect(resposta.status).toBe(422);
  });
});

describe('isolamento entre famílias', () => {
  it('a família B não vê a categoria da família A em GET /categorias', async () => {
    const criada = await criarCategoria(cookieA, 'Isolamento — só de A');
    const listaDeB = await request(app).get('/categorias').set('Cookie', cookieB);
    const ids = (listaDeB.body.categorias as CategoriaCriada[]).map(c => c.id);
    expect(ids).not.toContain(criada.id);
  });

  it('a leitura da competência de B nunca mostra categoria de A', async () => {
    const criada = await criarCategoria(cookieA, 'Isolamento — leitura de competência');
    await definirTeto(cookieA, '2026-08', criada.id, 5000);

    const leituraDeB = await lerCompetencia(cookieB, '2026-08');
    const linha = leituraDeB.body.categorias.find((c: { id: string }) => c.id === criada.id);
    expect(linha).toBeUndefined();
  });

  it('a família B não consegue remanejar usando categorias da família A (404)', async () => {
    const origem = await criarCategoria(cookieA, 'Isolamento remanejo origem');
    const destino = await criarCategoria(cookieA, 'Isolamento remanejo destino');
    await definirTeto(cookieA, '2026-08', origem.id, 5000);

    const resposta = await request(app)
      .post('/competencias/2026-08/remanejamentos')
      .set('Cookie', cookieB)
      .send({ categoriaOrigemId: origem.id, categoriaDestinoId: destino.id, valorCentavos: 100 });

    expect(resposta.status).toBe(404);
  });

  it('a família B não consegue editar nem apagar categoria da família A', async () => {
    const criada = await criarCategoria(cookieA, 'Isolamento editar/apagar');

    const editar = await request(app)
      .patch(`/categorias/${criada.id}`)
      .set('Cookie', cookieB)
      .send({ nome: 'Sequestrada', icone: 'x', cor: '#000' });
    expect(editar.status).toBe(404);

    const apagar = await request(app).delete(`/categorias/${criada.id}`).set('Cookie', cookieB);
    expect(apagar.status).toBe(404);
  });
});
