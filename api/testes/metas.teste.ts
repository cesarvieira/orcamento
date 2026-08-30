/**
 * Integração de `metas` (EF-07/tarefa #86) — Postgres de verdade, HTTP real.
 *
 * ⛔ Regra #0: RN-33..RN-35 e D1..D5 testadas aqui vêm de
 * `.preator/skills/negocio/metas-e-reservas/SKILL.md` (glossário e tabela
 * "Regras de negócio"), que cita `docs/especificacoes/EF-07-metas.md` §1/§2/§5
 * (o Definition of Done) como fonte primária. Os casos do DoD (§5) mapeiam
 * para os `describe` abaixo, um a um.
 *
 * ⛔ Esta suíte NÃO é `api/testes/metas-dod.teste.ts` — essa é a pasta
 * disjunta da tarefa #88 (qa). Este arquivo é o meu (tarefa #86/backend).
 *
 * `guardar` (RN-34/D1) compara o valor pedido contra `naoAlocadoCentavos` da
 * competência CORRENTE — não há caminho de caminho/corpo para escolher outra
 * competência (a operação é sempre "agora"), então os testes usam a
 * competência REAL do relógio do ambiente, calculada aqui do mesmo jeito que
 * `modulos/metas/servico.ts` calcula internamente.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { fecharBanco } from '../src/db';
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
// Toda mutação de meta emite invalidação (D-04/R3), e o emissor exige o
// servidor de tempo real DE PÉ — mesmo padrão de `testes/faturas.teste.ts`.
let stack: StackDeTempoReal;

beforeAll(async () => {
  await limparBanco();
  familiaA = await criarFamiliaComMembro('Família A das metas');
  familiaB = await criarFamiliaComMembro('Família B das metas');
  cookieA = await cookieDeSessao(familiaA.membroId);
  cookieB = await cookieDeSessao(familiaB.membroId);
  stack = await subirServidorComRealtime();
});

afterAll(async () => {
  await stack.encerrar();
  await fecharBanco();
});

/** Mesmo cálculo de `modulos/metas/servico.ts#hojeIso` — UTC, AAAA-MM-DD. */
function hojeIso(): string {
  const agora = new Date();
  const mes = String(agora.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(agora.getUTCDate()).padStart(2, '0');
  return `${agora.getUTCFullYear()}-${mes}-${dia}`;
}

/** A competência que `guardar` de fato usa — os 7 primeiros caracteres de hoje. */
function competenciaAtual(): string {
  return hojeIso().slice(0, 7);
}

interface Meta {
  id: string;
  nome: string;
  alvoCentavos: number;
  contaReservaId: string;
  acumuladoCentavos: number;
}

interface Conta {
  id: string;
  tipo: string;
  nome: string;
  saldoCentavos: number;
}

async function novaConta(cookie: string, dados: Record<string, unknown>): Promise<Conta> {
  const resposta = await request(app).post('/contas').set('Cookie', cookie).send(dados);
  expect(resposta.status).toBe(201);
  return resposta.body as Conta;
}

async function novaContaDebito(cookie: string, nome: string, saldoInicialCentavos: number): Promise<Conta> {
  return novaConta(cookie, { tipo: 'DEBITO', nome, icone: 'banco', cor: '#2563eb', saldoInicialCentavos });
}

async function novaCategoria(cookie: string, nome: string): Promise<string> {
  const resposta = await request(app).post('/categorias').set('Cookie', cookie).send({
    nome,
    icone: 'x',
    cor: '#000',
  });
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

/**
 * Dá à família `recebidoCentavos` (RN-39/RN-11), via um RECEITA de verdade.
 * `data` — default hoje (competência atual); os testes de D6 (tarefa #91)
 * passam uma data de outra competência de propósito.
 */
async function darRecebido(cookie: string, contaId: string, valorCentavos: number, data?: string): Promise<void> {
  const resposta = await request(app).post('/lancamentos').set('Cookie', cookie).send({
    tipo: 'RECEITA',
    descricao: 'Recebido de teste',
    valorCentavos,
    data: data ?? hojeIso(),
    contaId,
  });
  expect(resposta.status).toBe(201);
}

async function lerCompetencia(cookie: string, competencia: string) {
  return request(app).get(`/competencias/${competencia}`).set('Cookie', cookie);
}

async function lerCompetenciaAtual(cookie: string) {
  return lerCompetencia(cookie, competenciaAtual());
}

/** Desloca `AAAA-MM` em `meses` (pode ser negativo) — só para montar cenários de teste (D6, tarefa #91). */
function deslocarCompetencia(competencia: string, meses: number): string {
  const [anoStr, mesStr] = competencia.split('-');
  const totalBaseZero = Number(anoStr) * 12 + (Number(mesStr) - 1) + meses;
  const novoAno = Math.floor(totalBaseZero / 12);
  const novoMes = (totalBaseZero % 12) + 1;
  return `${novoAno}-${String(novoMes).padStart(2, '0')}`;
}

async function novaMeta(cookie: string, nome: string, alvoCentavos: number): Promise<Meta> {
  const resposta = await request(app).post('/metas').set('Cookie', cookie).send({ nome, alvoCentavos });
  expect(resposta.status).toBe(201);
  return resposta.body as Meta;
}

interface DadosDeGuardar {
  cookie: string;
  metaId: string;
  contaOrigemId: string;
  valorCentavos: number;
  /**
   * D6 (tarefa #91) — a data do fato vem do CLIENTE, nunca do relógio do
   * servidor. Default = hoje: mantém o comportamento que os testes já
   * provavam (competência CORRENTE) sem tocar em cada chamada; os testes de
   * data retroativa/virada de mês passam um valor explícito.
   */
  data?: string;
}

async function guardar(dados: DadosDeGuardar) {
  return request(app)
    .post(`/metas/${dados.metaId}/guardar`)
    .set('Cookie', dados.cookie)
    .send({
      contaOrigemId: dados.contaOrigemId,
      valorCentavos: dados.valorCentavos,
      data: dados.data ?? hojeIso(),
    });
}

// ---------------------------------------------------------------------------
// D3 — criar cofrinho cria, JUNTO, a conta RESERVA própria dele (1:1).
// ---------------------------------------------------------------------------

describe('D3 — criar um cofrinho cria, junto, a conta RESERVA própria dele', () => {
  it('POST /metas cria a meta E uma conta RESERVA vinculada, com acumulado e saldo 0', async () => {
    const meta = await novaMeta(cookieA, 'D3 cofrinho', 500000);
    expect(meta.contaReservaId).toBeTruthy();
    expect(meta.acumuladoCentavos).toBe(0);

    const contas = await request(app).get('/contas').set('Cookie', cookieA);
    const contaDaMeta = (contas.body.contas as Conta[]).find(c => c.id === meta.contaReservaId);
    expect(contaDaMeta).toBeDefined();
    expect(contaDaMeta?.tipo).toBe('RESERVA');
    expect(contaDaMeta?.saldoCentavos).toBe(0);
  });

  it('duas metas da MESMA família recebem CADA UMA a sua própria conta RESERVA (nunca compartilhada)', async () => {
    const metaUm = await novaMeta(cookieA, 'D3 primeiro cofrinho', 100000);
    const metaDois = await novaMeta(cookieA, 'D3 segundo cofrinho', 200000);
    expect(metaUm.contaReservaId).not.toBe(metaDois.contaReservaId);
  });
});

// ---------------------------------------------------------------------------
// RN-33 — guardar é uma TRANSFERENCIA real, nunca despesa.
// ---------------------------------------------------------------------------

describe('RN-33 — guardar gera uma TRANSFERENCIA real (DEBITO → RESERVA), nunca uma despesa', () => {
  it('guardar cria um lançamento TRANSFERENCIA da origem para a RESERVA da meta, e o acumulado sobe', async () => {
    const contaOrigem = await novaContaDebito(cookieA, 'RN-33 conta corrente', 100000);
    await darRecebido(cookieA, contaOrigem.id, 900000);
    const meta = await novaMeta(cookieA, 'RN-33 cofrinho', 500000);

    const resposta = await guardar({
      cookie: cookieA,
      metaId: meta.id,
      contaOrigemId: contaOrigem.id,
      valorCentavos: 30000,
    });
    expect(resposta.status).toBe(200);
    expect(resposta.body.acumuladoCentavos).toBe(30000);

    const extrato = await request(app)
      .get('/lancamentos')
      .set('Cookie', cookieA)
      .query({ contaId: contaOrigem.id });
    interface LancamentoDoExtrato {
      tipo: string;
      contaDestinoId: string | null;
      valorCentavos: number;
      categoriaId: string | null;
    }
    const transferencia = (extrato.body.lancamentos as LancamentoDoExtrato[]).find(
      l => l.tipo === 'TRANSFERENCIA' && l.contaDestinoId === meta.contaReservaId,
    );
    expect(transferencia).toBeDefined();
    expect(transferencia?.valorCentavos).toBe(30000);
    // Nunca despesa: sem categoria nenhuma (EF-04 §1 — categoriaId só existe em DESPESA).
    expect(transferencia?.categoriaId).toBeNull();

    // A conta de origem perdeu o valor guardado (é transferência real de verdade).
    const contas = await request(app).get('/contas').set('Cookie', cookieA);
    const linhaOrigem = (contas.body.contas as Conta[]).find(c => c.id === contaOrigem.id);
    expect(linhaOrigem?.saldoCentavos).toBe(100000 + 900000 - 30000);
  });

  it('guardar NÃO consome teto de categoria nenhuma — disponível/gasto continuam intactos (DoD)', async () => {
    const contaOrigem = await novaContaDebito(cookieA, 'sem-teto conta', 100000);
    await darRecebido(cookieA, contaOrigem.id, 900000);
    const categoriaId = await novaCategoria(cookieA, 'sem-teto categoria');
    await definirTeto(cookieA, competenciaAtual(), categoriaId, 20000);
    const meta = await novaMeta(cookieA, 'sem-teto cofrinho', 500000);

    const antes = await lerCompetenciaAtual(cookieA);
    const linhaAntes = antes.body.categorias.find((c: { id: string }) => c.id === categoriaId);
    expect(linhaAntes.gastoCentavos).toBe(0);
    expect(linhaAntes.disponivelCentavos).toBe(20000);

    const resposta = await guardar({
      cookie: cookieA,
      metaId: meta.id,
      contaOrigemId: contaOrigem.id,
      valorCentavos: 40000,
    });
    expect(resposta.status).toBe(200);

    const depois = await lerCompetenciaAtual(cookieA);
    const linhaDepois = depois.body.categorias.find((c: { id: string }) => c.id === categoriaId);
    // Nada mudou na categoria: guardar não é despesa, RN-33.
    expect(linhaDepois.gastoCentavos).toBe(0);
    expect(linhaDepois.disponivelCentavos).toBe(20000);
    expect(linhaDepois.tetoCentavos).toBe(20000);
  });
});

// ---------------------------------------------------------------------------
// RN-34/D1 — guardar é um TETO: nunca excede o não alocado da competência.
// ---------------------------------------------------------------------------

describe('RN-34/D1 — guardar nunca excede o não alocado da competência (TETO, não rótulo)', () => {
  it('guardar acima do não alocado responde 409 e não altera o acumulado', async () => {
    // Família NOVA de propósito: naoAlocadoCentavos é agregado por família +
    // competência (RN-11), então precisa de estado isolado para o valor
    // exato do teste (10000) ser exatamente o não alocado — não pode
    // reaproveitar `familiaA`/`cookieA`, cujo saldo acumula entre os
    // `describe` anteriores deste arquivo.
    const familia = await criarFamiliaComMembro('RN-34 acima');
    const cookie = await cookieDeSessao(familia.membroId);
    const contaOrigem = await novaContaDebito(cookie, 'RN-34 conta', 500000);
    await darRecebido(cookie, contaOrigem.id, 10000); // naoAlocado = 10000 (sem categoria/teto nesta família nova)
    const meta = await novaMeta(cookie, 'RN-34 cofrinho', 500000);

    const resposta = await guardar({ cookie, metaId: meta.id, contaOrigemId: contaOrigem.id, valorCentavos: 10001 });
    expect(resposta.status).toBe(409);
    expect(resposta.body.erro).toBe('teto_excedido');

    const listagem = await request(app).get('/metas').set('Cookie', cookie);
    const metaLida = (listagem.body.metas as Meta[]).find(m => m.id === meta.id);
    expect(metaLida?.acumuladoCentavos).toBe(0);
  });

  it('guardar exatamente o não alocado é aceito — o teto é "não exceder"', async () => {
    const familia = await criarFamiliaComMembro('RN-34 exato');
    const cookie = await cookieDeSessao(familia.membroId);
    const contaOrigem = await novaContaDebito(cookie, 'RN-34 exato conta', 500000);
    await darRecebido(cookie, contaOrigem.id, 15000);
    const meta = await novaMeta(cookie, 'RN-34 exato cofrinho', 500000);

    const resposta = await guardar({ cookie, metaId: meta.id, contaOrigemId: contaOrigem.id, valorCentavos: 15000 });
    expect(resposta.status).toBe(200);
    expect(resposta.body.acumuladoCentavos).toBe(15000);
  });

  it('com não alocado ≤ 0, recusa QUALQUER valor — mesmo pequeno, sem piso de tolerância (D1)', async () => {
    const familia = await criarFamiliaComMembro('RN-34 deficit');
    const cookie = await cookieDeSessao(familia.membroId);
    const contaOrigem = await novaContaDebito(cookie, 'RN-34 deficit conta', 500000);
    // Nenhuma receita: recebido = 0. Um teto de categoria maior que 0 deixa
    // planejado > recebido, e naoAlocado = recebido - planejado < 0.
    const categoriaId = await novaCategoria(cookie, 'RN-34 deficit categoria');
    await definirTeto(cookie, competenciaAtual(), categoriaId, 5000);
    const meta = await novaMeta(cookie, 'RN-34 deficit cofrinho', 500000);

    const leitura = await lerCompetenciaAtual(cookie);
    expect(leitura.body.naoAlocadoCentavos).toBeLessThanOrEqual(0);

    const resposta = await guardar({ cookie, metaId: meta.id, contaOrigemId: contaOrigem.id, valorCentavos: 1 });
    expect(resposta.status).toBe(409);
    expect(resposta.body.erro).toBe('teto_excedido');
  });
});

// ---------------------------------------------------------------------------
// D6 (2026-08-29, tarefa #91) — a data do fato vem do CLIENTE, nunca do
// relógio do servidor. O defeito corrigido: `hojeIso()` calculava "hoje" com
// getters UTC, e das 21h à meia-noite no fuso do Brasil isso devolvia o DIA
// SEGUINTE — no último dia do mês, a competência inteira ia para o mês
// errado (RN-34/D1 conferido contra o não alocado do mês errado). RN-15
// (`.preator/skills/negocio/lancamentos-e-parcelamento/SKILL.md`) já
// estabelecia que a competência segue a DATA, nunca o relógio — guardar
// passa a seguir o mesmo caminho.
// ---------------------------------------------------------------------------

describe('D6 — a data de "guardar" vem do CLIENTE; a competência (RN-34/D1) segue a data, não o relógio', () => {
  it('data RETROATIVA cai na competência da DATA, não na competência atual (RN-15)', async () => {
    const familia = await criarFamiliaComMembro('D6 retroativo');
    const cookie = await cookieDeSessao(familia.membroId);
    const contaOrigem = await novaContaDebito(cookie, 'D6 retroativo conta', 500000);
    const meta = await novaMeta(cookie, 'D6 retroativo cofrinho', 500000);

    const competenciaRetroativa = deslocarCompetencia(competenciaAtual(), -2);
    const dataRetroativa = `${competenciaRetroativa}-10`;
    // Recebido só na competência RETROATIVA — a atual fica com naoAlocado = 0
    // (sem nenhuma receita), então guardar só passa se a API de fato usar a
    // competência DA DATA informada, nunca a do relógio.
    await darRecebido(cookie, contaOrigem.id, 20000, dataRetroativa);

    const naoAlocadoAtual = await lerCompetenciaAtual(cookie);
    expect(naoAlocadoAtual.body.naoAlocadoCentavos).toBeLessThanOrEqual(0);

    const resposta = await guardar({
      cookie,
      metaId: meta.id,
      contaOrigemId: contaOrigem.id,
      valorCentavos: 15000,
      data: dataRetroativa,
    });
    // Se a API ainda usasse "hoje" (o defeito antigo), isto seria 409: a
    // competência atual tem naoAlocado ≤ 0. 200 só é possível porque o teto
    // foi conferido contra o naoAlocado da competência RETROATIVA (20000).
    expect(resposta.status).toBe(200);
    expect(resposta.body.acumuladoCentavos).toBe(15000);

    const extrato = await request(app).get('/lancamentos').set('Cookie', cookie).query({ contaId: contaOrigem.id });
    interface LancamentoDoExtrato {
      tipo: string;
      data: string;
      competencia: string;
    }
    const transferencia = (extrato.body.lancamentos as LancamentoDoExtrato[]).find(l => l.tipo === 'TRANSFERENCIA');
    expect(transferencia?.competencia).toBe(competenciaRetroativa);
  });

  it('data na VIRADA DO MÊS confere o teto contra o mês DA DATA — 30/mês vs 1/mês seguinte', async () => {
    const familia = await criarFamiliaComMembro('D6 virada de mes');
    const cookie = await cookieDeSessao(familia.membroId);
    const contaOrigem = await novaContaDebito(cookie, 'D6 virada conta', 500000);
    const meta = await novaMeta(cookie, 'D6 virada cofrinho', 500000);

    // Dois meses passados, de propósito (nenhum é "hoje"): o mês ANTERIOR
    // tem folga grande; o mês SEGUINTE (a ele) tem folga pequena. É
    // exatamente a fronteira que o defeito original cruzava sozinho — depois
    // das 21h no fuso do Brasil, o último dia do mês virava o primeiro dia
    // do mês seguinte pelo relógio UTC do servidor.
    const competenciaAnterior = deslocarCompetencia(competenciaAtual(), -4);
    const competenciaSeguinte = deslocarCompetencia(competenciaAtual(), -3);
    await darRecebido(cookie, contaOrigem.id, 50000, `${competenciaAnterior}-30`);
    await darRecebido(cookie, contaOrigem.id, 1000, `${competenciaSeguinte}-05`);

    const naoAlocadoAnterior = await lerCompetencia(cookie, competenciaAnterior);
    const naoAlocadoSeguinte = await lerCompetencia(cookie, competenciaSeguinte);
    expect(naoAlocadoAnterior.body.naoAlocadoCentavos).toBe(50000);
    expect(naoAlocadoSeguinte.body.naoAlocadoCentavos).toBe(1000);

    // Guardar 40000 no ÚLTIMO dia do mês anterior: cabe no naoAlocado DELE
    // (50000), mas excederia o do mês seguinte (1000).
    const noUltimoDia = await guardar({
      cookie,
      metaId: meta.id,
      contaOrigemId: contaOrigem.id,
      valorCentavos: 40000,
      data: `${competenciaAnterior}-30`,
    });
    expect(noUltimoDia.status).toBe(200);

    // O MESMO valor, um dia depois (primeiro dia do mês seguinte): agora
    // excede o naoAlocado do mês seguinte (1000) e é recusado.
    const noPrimeiroDiaSeguinte = await guardar({
      cookie,
      metaId: meta.id,
      contaOrigemId: contaOrigem.id,
      valorCentavos: 40000,
      data: `${competenciaSeguinte}-01`,
    });
    expect(noPrimeiroDiaSeguinte.status).toBe(409);
    expect(noPrimeiroDiaSeguinte.body.erro).toBe('teto_excedido');
  });

  it('a data GRAVADA é exatamente a informada, sem deslocamento de fuso', async () => {
    // Família NOVA de propósito (mesmo motivo do describe RN-34 acima): a
    // competência de `dataInformada` (2026-03) não é a competência ATUAL do
    // relógio real do ambiente, então o recebido precisa ser dado NELA — não
    // dá pra reaproveitar `familiaA`/`cookieA`, cujo saldo é de outra competência.
    const familia = await criarFamiliaComMembro('D6 sem deslocamento');
    const cookie = await cookieDeSessao(familia.membroId);
    const contaOrigem = await novaContaDebito(cookie, 'D6 sem deslocamento conta', 500000);
    const meta = await novaMeta(cookie, 'D6 sem deslocamento cofrinho', 500000);

    const dataInformada = '2026-03-15';
    await darRecebido(cookie, contaOrigem.id, 900000, dataInformada);

    const resposta = await guardar({
      cookie,
      metaId: meta.id,
      contaOrigemId: contaOrigem.id,
      valorCentavos: 12345,
      data: dataInformada,
    });
    expect(resposta.status).toBe(200);

    const extrato = await request(app)
      .get('/lancamentos')
      .set('Cookie', cookie)
      .query({ contaId: contaOrigem.id });
    interface LancamentoDoExtrato {
      tipo: string;
      valorCentavos: number;
      data: string;
    }
    const transferencia = (extrato.body.lancamentos as LancamentoDoExtrato[]).find(
      l => l.tipo === 'TRANSFERENCIA' && l.valorCentavos === 12345,
    );
    expect(transferencia?.data).toBe(dataInformada);
  });
});

// ---------------------------------------------------------------------------
// RN-35 — guardar reduz o lastro do mês. Consequência CORRETA e intencional
// (EF-07 §2) — não "conserta-se" isto.
// ---------------------------------------------------------------------------

describe('RN-35 — guardar reduz o lastro do mês (consequência correta, não bug)', () => {
  it('lastroCentavos cai exatamente o guardado — a DEBITO perde caixa e a RESERVA fica fora do lastro', async () => {
    const familia = await criarFamiliaComMembro('RN-35 lastro');
    const cookie = await cookieDeSessao(familia.membroId);
    const contaOrigem = await novaContaDebito(cookie, 'RN-35 conta', 500000);
    await darRecebido(cookie, contaOrigem.id, 400000);
    const meta = await novaMeta(cookie, 'RN-35 cofrinho', 500000);

    const antes = await lerCompetenciaAtual(cookie);
    const lastroAntes = antes.body.lastroCentavos as number;

    const resposta = await guardar({ cookie, metaId: meta.id, contaOrigemId: contaOrigem.id, valorCentavos: 60000 });
    expect(resposta.status).toBe(200);

    const depois = await lerCompetenciaAtual(cookie);
    const lastroDepois = depois.body.lastroCentavos as number;

    expect(lastroDepois).toBe(lastroAntes - 60000);
  });
});

// ---------------------------------------------------------------------------
// D2/D5 — as duas pontas do "guardar" vêm do CORPO, nunca inferidas.
// ---------------------------------------------------------------------------

describe('D2/D5 — a conta de origem e o cofrinho de destino vêm do corpo, nunca inferidos', () => {
  it('a conta de origem que NÃO é DEBITO (ex.: RESERVA) responde 400', async () => {
    const familia = await criarFamiliaComMembro('D2 nao-debito');
    const cookie = await cookieDeSessao(familia.membroId);
    const contaDebito = await novaContaDebito(cookie, 'D2 conta debito', 500000);
    await darRecebido(cookie, contaDebito.id, 500000);
    const outraReserva = await novaConta(cookie, {
      tipo: 'RESERVA',
      nome: 'D2 outra reserva',
      icone: 'cofre',
      cor: '#000',
      saldoInicialCentavos: 200000,
    });
    const meta = await novaMeta(cookie, 'D2 cofrinho', 500000);

    const resposta = await guardar({ cookie, metaId: meta.id, contaOrigemId: outraReserva.id, valorCentavos: 1000 });
    expect(resposta.status).toBe(400);
    expect(resposta.body.erro).toBe('conta_origem_invalida');
  });

  it('conta de origem inexistente responde 404', async () => {
    const meta = await novaMeta(cookieA, 'D2 inexistente cofrinho', 500000);
    const resposta = await guardar({
      cookie: cookieA,
      metaId: meta.id,
      contaOrigemId: '00000000-0000-0000-0000-000000000000',
      valorCentavos: 1000,
    });
    expect(resposta.status).toBe(404);
    expect(resposta.body.erro).toBe('conta_nao_encontrada');
  });

  it('cofrinho inexistente responde 404', async () => {
    const contaOrigem = await novaContaDebito(cookieA, 'D2 conta orfa', 500000);
    const resposta = await guardar({
      cookie: cookieA,
      metaId: '00000000-0000-0000-0000-000000000000',
      contaOrigemId: contaOrigem.id,
      valorCentavos: 1000,
    });
    expect(resposta.status).toBe(404);
    expect(resposta.body.erro).toBe('meta_nao_encontrada');
  });
});

// ---------------------------------------------------------------------------
// O acumulado é DERIVADO — soma de VÁRIAS transferências, nunca coluna.
// ---------------------------------------------------------------------------

describe('EF-07 §1 — o acumulado é derivado: soma de todas as transferências para a RESERVA vinculada', () => {
  it('dois guardares no MESMO cofrinho somam no acumulado', async () => {
    const familia = await criarFamiliaComMembro('Acumulado soma');
    const cookie = await cookieDeSessao(familia.membroId);
    const contaOrigem = await novaContaDebito(cookie, 'Acumulado conta', 500000);
    await darRecebido(cookie, contaOrigem.id, 900000);
    const meta = await novaMeta(cookie, 'Acumulado cofrinho', 500000);

    const primeiro = await guardar({ cookie, metaId: meta.id, contaOrigemId: contaOrigem.id, valorCentavos: 20000 });
    expect(primeiro.status).toBe(200);
    expect(primeiro.body.acumuladoCentavos).toBe(20000);

    const segundo = await guardar({ cookie, metaId: meta.id, contaOrigemId: contaOrigem.id, valorCentavos: 15000 });
    expect(segundo.status).toBe(200);
    expect(segundo.body.acumuladoCentavos).toBe(35000);

    const listagem = await request(app).get('/metas').set('Cookie', cookie);
    const metaLida = (listagem.body.metas as Meta[]).find(m => m.id === meta.id);
    expect(metaLida?.acumuladoCentavos).toBe(35000);
  });
});

// ---------------------------------------------------------------------------
// CRUD do cofrinho.
// ---------------------------------------------------------------------------

describe('CRUD de metas', () => {
  it('PATCH atualiza nome e alvo; a conta RESERVA vinculada NUNCA muda (D3, imutável)', async () => {
    const meta = await novaMeta(cookieA, 'CRUD original', 100000);

    const resposta = await request(app)
      .patch(`/metas/${meta.id}`)
      .set('Cookie', cookieA)
      .send({ nome: 'CRUD editado', alvoCentavos: 250000 });

    expect(resposta.status).toBe(200);
    expect(resposta.body.nome).toBe('CRUD editado');
    expect(resposta.body.alvoCentavos).toBe(250000);
    expect(resposta.body.contaReservaId).toBe(meta.contaReservaId);
  });

  it('PATCH em cofrinho inexistente responde 404', async () => {
    const resposta = await request(app)
      .patch('/metas/00000000-0000-0000-0000-000000000000')
      .set('Cookie', cookieA)
      .send({ nome: 'X', alvoCentavos: 1000 });
    expect(resposta.status).toBe(404);
  });

  it('DELETE de um cofrinho que NUNCA guardou nada apaga a meta E a conta RESERVA vinculada', async () => {
    const meta = await novaMeta(cookieA, 'CRUD exclusão', 100000);

    const resposta = await request(app).delete(`/metas/${meta.id}`).set('Cookie', cookieA);
    expect(resposta.status).toBe(204);

    const listagem = await request(app).get('/metas').set('Cookie', cookieA);
    expect((listagem.body.metas as Meta[]).some(m => m.id === meta.id)).toBe(false);

    const contas = await request(app).get('/contas').set('Cookie', cookieA);
    expect((contas.body.contas as Conta[]).some(c => c.id === meta.contaReservaId)).toBe(false);
  });

  it('DELETE de um cofrinho que JÁ guardou responde 409 — a armadilha avisada pela tarefa', async () => {
    const contaOrigem = await novaContaDebito(cookieA, 'DELETE-guardado conta', 500000);
    await darRecebido(cookieA, contaOrigem.id, 900000);
    const meta = await novaMeta(cookieA, 'DELETE-guardado cofrinho', 500000);
    const guardado = await guardar({
      cookie: cookieA,
      metaId: meta.id,
      contaOrigemId: contaOrigem.id,
      valorCentavos: 5000,
    });
    expect(guardado.status).toBe(200);

    const resposta = await request(app).delete(`/metas/${meta.id}`).set('Cookie', cookieA);
    expect(resposta.status).toBe(409);
    expect(resposta.body.erro).toBe('meta_com_lancamentos');

    // Nem a meta nem a conta somem — a exclusão foi recusada, não parcial.
    const listagem = await request(app).get('/metas').set('Cookie', cookieA);
    expect((listagem.body.metas as Meta[]).some(m => m.id === meta.id)).toBe(true);
  });

  it('GET /metas lista os cofrinhos da família da sessão', async () => {
    const familia = await criarFamiliaComMembro('CRUD listagem');
    const cookie = await cookieDeSessao(familia.membroId);
    await novaMeta(cookie, 'CRUD listagem 1', 10000);
    await novaMeta(cookie, 'CRUD listagem 2', 20000);

    const resposta = await request(app).get('/metas').set('Cookie', cookie);
    expect(resposta.status).toBe(200);
    expect((resposta.body.metas as Meta[]).map(m => m.nome).sort()).toEqual(
      ['CRUD listagem 1', 'CRUD listagem 2'].sort(),
    );
  });
});

// ---------------------------------------------------------------------------
// Validações de borda.
// ---------------------------------------------------------------------------

describe('validações', () => {
  it('POST /metas com nome vazio responde 422', async () => {
    const resposta = await request(app).post('/metas').set('Cookie', cookieA).send({ nome: '', alvoCentavos: 1000 });
    expect(resposta.status).toBe(422);
  });

  it('POST /metas com alvoCentavos não positivo responde 422', async () => {
    const resposta = await request(app).post('/metas').set('Cookie', cookieA).send({ nome: 'X', alvoCentavos: 0 });
    expect(resposta.status).toBe(422);
  });

  it('POST /metas/:id/guardar com valorCentavos não positivo responde 422', async () => {
    const meta = await novaMeta(cookieA, 'validação guardar', 100000);
    const contaOrigem = await novaContaDebito(cookieA, 'validação conta', 100000);
    const resposta = await guardar({
      cookie: cookieA,
      metaId: meta.id,
      contaOrigemId: contaOrigem.id,
      valorCentavos: 0,
    });
    expect(resposta.status).toBe(422);
  });

  it('sem sessão, GET /metas responde 401', async () => {
    const resposta = await request(app).get('/metas');
    expect(resposta.status).toBe(401);
  });

  it('sem sessão, POST /metas/:id/guardar responde 401', async () => {
    const resposta = await request(app)
      .post('/metas/00000000-0000-0000-0000-000000000000/guardar')
      .send({ contaOrigemId: '00000000-0000-0000-0000-000000000001', valorCentavos: 1000 });
    expect(resposta.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Isolamento entre famílias.
// ---------------------------------------------------------------------------

describe('isolamento entre famílias', () => {
  it('a família B não vê o cofrinho da família A na listagem', async () => {
    await novaMeta(cookieA, 'Isolamento só de A', 100000);

    const listagemDeB = await request(app).get('/metas').set('Cookie', cookieB);
    expect((listagemDeB.body.metas as Meta[]).some(m => m.nome === 'Isolamento só de A')).toBe(false);
  });

  it('a família B não consegue guardar no cofrinho da família A (404, não 200 nem 403)', async () => {
    const meta = await novaMeta(cookieA, 'Isolamento guardar', 100000);
    const contaDeB = await novaContaDebito(cookieB, 'Isolamento conta de B', 500000);
    await darRecebido(cookieB, contaDeB.id, 500000);

    const resposta = await guardar({
      cookie: cookieB,
      metaId: meta.id,
      contaOrigemId: contaDeB.id,
      valorCentavos: 1000,
    });
    expect(resposta.status).toBe(404);
    expect(resposta.body.erro).toBe('meta_nao_encontrada');
  });

  it('a família B não consegue editar nem apagar o cofrinho da família A', async () => {
    const meta = await novaMeta(cookieA, 'Isolamento editar', 100000);

    const patch = await request(app)
      .patch(`/metas/${meta.id}`)
      .set('Cookie', cookieB)
      .send({ nome: 'Roubado', alvoCentavos: 1 });
    expect(patch.status).toBe(404);

    const del = await request(app).delete(`/metas/${meta.id}`).set('Cookie', cookieB);
    expect(del.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Tempo real — dois clientes da MESMA família veem o guardado sem refresh.
// ---------------------------------------------------------------------------

describe('tempo real — guardar invalida "metas" e "contas" sem refresh', () => {
  it('emitirInvalidacao(recurso: "metas") chega à família dona, e só a ela', async () => {
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

      emitirInvalidacao({ familiaId: familiaA.familiaId, recurso: 'metas', origemClienteId: 'aba-do-guardar' });

      await new Promise(r => setTimeout(r, 400));

      expect(recebidoPorA).toHaveLength(1);
      expect(recebidoPorA[0]).toMatchObject({ recurso: 'metas' });
      expect(recebidoPorB).toHaveLength(0);
    } finally {
      socketA.close();
      socketB.close();
    }
  });

  it('POST /metas/:id/guardar emite invalidação de "metas" E "contas" na sala da família', async () => {
    const { io: conectarCliente } = await import('socket.io-client');
    const { CAMINHO_REALTIME } = await import('../src/realtime/servidor');

    const contaOrigem = await novaContaDebito(cookieA, 'Tempo real conta', 500000);
    await darRecebido(cookieA, contaOrigem.id, 500000);
    const meta = await novaMeta(cookieA, 'Tempo real cofrinho', 500000);

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

      const resposta = await request(stack.http)
        .post(`/metas/${meta.id}/guardar`)
        .set('Cookie', cookieA)
        .send({ contaOrigemId: contaOrigem.id, valorCentavos: 1000, data: hojeIso() });
      expect(resposta.status).toBe(200);

      await new Promise(r => setTimeout(r, 400));

      expect(recebidos.some(e => e.recurso === 'metas')).toBe(true);
      expect(recebidos.some(e => e.recurso === 'contas')).toBe(true);
    } finally {
      socket.close();
    }
  });
});
