/**
 * Os casos do Definition of Done da EF-07 (§5) — tarefa #88 (qa), história #21.
 * Integração contra Postgres de verdade, HTTP real, no padrão de
 * `api/testes/lastro-rateio.teste.ts`.
 *
 * ⛔ Regra #0 — RN-33..RN-35 e D1..D5 testadas aqui vêm de
 * `.preator/skills/negocio/metas-e-reservas/SKILL.md` (glossário e tabela
 * "Regras de negócio"), que cita `docs/especificacoes/EF-07-metas.md` §1/§2/§5
 * (o Definition of Done, tarefa #85) como fonte primária. Cada `describe`
 * abaixo mapeia um item de EF-07 §5 e cita a linha exata da skill que o prova.
 * Nada aqui foi decidido de memória.
 *
 * ⛔ Esta suíte NÃO é `api/testes/metas.teste.ts` — aquela é da tarefa #86
 * (backend) e prova a FIAÇÃO do módulo com valores redondos. Este arquivo é o
 * meu (tarefa #88/qa): todo teste usa valores QUEBRADOS (não redondos, de
 * propósito — precedente `api/testes/lastro-rateio.teste.ts`), e nenhum
 * passaria aqui se a regra fosse removida do serviço (ver
 * `api/src/modulos/metas/servico.ts`).
 *
 * Sobre sobreposição de CENÁRIO com `metas.teste.ts` — sem meias-verdades:
 * 9 dos 13 testes abaixo são ângulo genuinamente NOVO, que aquela suíte não
 * cobre — a borda EXATA de RN-34/D1 no "zero" (distinta da negativa), RN-35
 * como propriedade DINÂMICA da conta RESERVA (crédito direto, sem passar por
 * `guardar`), D2 com família de UMA SÓ conta DEBITO (a armadilha da inferência
 * "óbvia"), D3 com acumulados intercalados (não só dois `contaReservaId`
 * distintos), a prova LITERAL de "familiaId vem do token" (campo forjado no
 * corpo), o isolamento da conta de ORIGEM (não só do cofrinho) entre
 * famílias, e a invalidação de tempo real para a mutação de CRIAR (não só a
 * de guardar). Os outros 4 — RN-33 no caso principal, "guardar não consome
 * teto", "guardar reduz o lastro" e "excluir cofrinho com transferência" —
 * REEXERCITAM estruturalmente um cenário que `metas.teste.ts` já cobre com
 * números redondos; aqui eles rodam de novo com valores quebrados (onde
 * arredondamento erraria) e, em alguns, com asserções a mais (ex.: "nenhuma
 * DESPESA foi criada" em RN-33; "sem 'stack' no corpo" na exclusão). Isso não
 * é vácuo — é a mesma disciplina de `lastro-rateio.teste.ts`, que reroda a
 * largura das RNs do lastro com números quebrados por cima da fiação já
 * provada por #76 — mas também não é "cobertura nova" para os quatro, e este
 * arquivo não finge que é.
 *
 * Toda mutação de meta emite invalidação (D-04/R3) e exige o servidor de
 * tempo real DE PÉ — mesmo padrão de `testes/lastro-rateio.teste.ts` e
 * `testes/metas.teste.ts`.
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
// Apoio local — deliberadamente NÃO importado de `metas.teste.ts` (arquivo
// alheio, tarefa #86): cada suíte de integração deste projeto define os
// próprios helpers de conta/categoria (mesmo padrão de `lastro-rateio.teste.ts`).
// ---------------------------------------------------------------------------

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

interface LancamentoDoExtrato {
  tipo: string;
  contaId: string;
  contaDestinoId: string | null;
  valorCentavos: number;
  categoriaId: string | null;
}

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

async function novaFamiliaComCookie(nome: string) {
  const familia = await criarFamiliaComMembro(nome);
  const cookie = await cookieDeSessao(familia.membroId);
  return { familia, cookie };
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

/** Dá `recebidoCentavos` (RN-39/RN-11) na competência ATUAL, via um RECEITA de verdade. */
async function darRecebido(cookie: string, contaId: string, valorCentavos: number): Promise<void> {
  const resposta = await request(app).post('/lancamentos').set('Cookie', cookie).send({
    tipo: 'RECEITA',
    descricao: 'Recebido de teste (DoD)',
    valorCentavos,
    data: hojeIso(),
    contaId,
  });
  expect(resposta.status).toBe(201);
}

async function lerCompetenciaAtual(cookie: string) {
  return request(app).get(`/competencias/${competenciaAtual()}`).set('Cookie', cookie);
}

async function novaMeta(cookie: string, nome: string, alvoCentavos: number): Promise<Meta> {
  const resposta = await request(app).post('/metas').set('Cookie', cookie).send({ nome, alvoCentavos });
  expect(resposta.status).toBe(201);
  return resposta.body as Meta;
}

interface DadosDeGuardar {
  cookie: string;
  metaId: string;
  contaOrigemId?: string;
  valorCentavos?: number;
  /**
   * D6 (tarefa #91) — a data do fato vem do CLIENTE, nunca do relógio do
   * servidor. Default = hoje, sempre presente no corpo (mesmo quando outro
   * campo é omitido de propósito para testar 422 daquele campo específico).
   */
  data?: string;
}

async function guardar(dados: DadosDeGuardar) {
  const corpo: Record<string, unknown> = { data: dados.data ?? hojeIso() };
  if (dados.contaOrigemId !== undefined) corpo.contaOrigemId = dados.contaOrigemId;
  if (dados.valorCentavos !== undefined) corpo.valorCentavos = dados.valorCentavos;
  return request(app).post(`/metas/${dados.metaId}/guardar`).set('Cookie', dados.cookie).send(corpo);
}

async function extratoDaConta(cookie: string, contaId: string): Promise<LancamentoDoExtrato[]> {
  const resposta = await request(app).get('/lancamentos').set('Cookie', cookie).query({ contaId });
  return resposta.body.lancamentos as LancamentoDoExtrato[];
}

async function contasDaFamilia(cookie: string): Promise<Conta[]> {
  const resposta = await request(app).get('/contas').set('Cookie', cookie);
  return resposta.body.contas as Conta[];
}

async function metasDaFamilia(cookie: string): Promise<Meta[]> {
  const resposta = await request(app).get('/metas').set('Cookie', cookie);
  return resposta.body.metas as Meta[];
}

// ===========================================================================
// EF-07 §5 — RN-33: guardar cria uma TRANSFERENCIA (nunca DESPESA), com
// categoriaId nulo. Fonte: SKILL.md linha 61 (tabela de regras, RN-33);
// glossário "Guardar (o ato)", linha 47.
// ===========================================================================

describe('DoD §5 — RN-33: guardar cria uma TRANSFERENCIA (nunca DESPESA), categoriaId nulo', () => {
  it('a TRANSFERENCIA nasce com categoriaId nulo, valor quebrado exato, e nenhuma DESPESA é criada', async () => {
    const { cookie } = await novaFamiliaComCookie('RN-33 largura');
    const contaOrigem = await novaContaDebito(cookie, 'RN-33 conta', 733);
    await darRecebido(cookie, contaOrigem.id, 214459); // naoAlocado = 214459 (sem teto).
    const meta = await novaMeta(cookie, 'RN-33 cofrinho quebrado', 500001);

    const resposta = await guardar({ cookie, metaId: meta.id, contaOrigemId: contaOrigem.id, valorCentavos: 57193 });
    expect(resposta.status).toBe(200);
    expect(resposta.body.acumuladoCentavos).toBe(57193);

    const extrato = await extratoDaConta(cookie, contaOrigem.id);
    const transferencias = extrato.filter(l => l.tipo === 'TRANSFERENCIA');
    expect(transferencias).toHaveLength(1);
    expect(transferencias[0]?.contaDestinoId).toBe(meta.contaReservaId);
    expect(transferencias[0]?.valorCentavos).toBe(57193);
    // RN-33 na letra: categoriaId só existe em DESPESA (EF-04 §1) — nulo aqui
    // é a prova de que "guardar" nunca é gasto.
    expect(transferencias[0]?.categoriaId).toBeNull();
    // E nenhuma DESPESA foi criada por baixo dos panos — a regra não é só
    // "esta transferência não tem categoria", é "não existe despesa nenhuma".
    expect(extrato.some(l => l.tipo === 'DESPESA')).toBe(false);

    const contas = await contasDaFamilia(cookie);
    const linhaOrigem = contas.find(c => c.id === contaOrigem.id);
    expect(linhaOrigem?.saldoCentavos).toBe(733 + 214459 - 57193);
  });
});

// ===========================================================================
// EF-07 §5 — RN-34/D1: o teto. Acima é recusado; exatamente no limite é
// aceito; com naoAlocado ≤ 0 (incluindo o ZERO exato) qualquer valor é
// recusado. Fonte: SKILL.md linha 62 (tabela) e seção "D1 · RN-34 é um TETO,
// não um rótulo de tela" (linhas 84-92).
// ===========================================================================

describe('DoD §5 — RN-34/D1: o teto do "não alocado" (quebrado, três bordas)', () => {
  it('um centavo acima do não alocado é recusado (409) e o acumulado permanece intocado', async () => {
    const { cookie } = await novaFamiliaComCookie('RN-34 acima, quebrado');
    const contaOrigem = await novaContaDebito(cookie, 'RN-34 acima conta', 500003);
    await darRecebido(cookie, contaOrigem.id, 40507); // naoAlocado = 40507 (sem teto).
    const meta = await novaMeta(cookie, 'RN-34 acima cofrinho', 733001);

    const resposta = await guardar({ cookie, metaId: meta.id, contaOrigemId: contaOrigem.id, valorCentavos: 40508 });
    expect(resposta.status).toBe(409);
    expect(resposta.body.erro).toBe('teto_excedido');
    // A mensagem carrega o não-alocado REAL (não um valor fixo) — prova que a
    // recusa comparou contra o teto de verdade, não um limite hard-coded.
    expect(String(resposta.body.mensagem)).toContain('40507');

    const metas = await metasDaFamilia(cookie);
    expect(metas.find(m => m.id === meta.id)?.acumuladoCentavos).toBe(0);
  });

  it('exatamente o não alocado (93187, quebrado) é aceito — "não exceder" inclui a igualdade', async () => {
    const { cookie } = await novaFamiliaComCookie('RN-34 exato, quebrado');
    const contaOrigem = await novaContaDebito(cookie, 'RN-34 exato conta', 733);
    await darRecebido(cookie, contaOrigem.id, 93187);
    const meta = await novaMeta(cookie, 'RN-34 exato cofrinho', 500001);

    const resposta = await guardar({ cookie, metaId: meta.id, contaOrigemId: contaOrigem.id, valorCentavos: 93187 });
    expect(resposta.status).toBe(200);
    expect(resposta.body.acumuladoCentavos).toBe(93187);
  });

  it('não alocado exatamente ZERO (fronteira distinta de negativo) recusa até 1 centavo — D1, sem piso', async () => {
    // Distinto do caso negativo: aqui recebido == planejado (naoAlocado = 0
    // no ponto exato), não recebido < planejado. D1 diz "≤ 0" — o zero
    // precisa recusar tanto quanto o negativo, e nenhuma suíte irmã testa
    // essa borda exata (a fonte usa só um cenário com déficit negativo).
    const { cookie } = await novaFamiliaComCookie('RN-34 zero exato');
    const contaOrigem = await novaContaDebito(cookie, 'RN-34 zero conta', 500000);
    await darRecebido(cookie, contaOrigem.id, 47331);
    const categoriaId = await novaCategoria(cookie, 'RN-34 zero categoria');
    await definirTeto(cookie, competenciaAtual(), categoriaId, 47331); // naoAlocado = 47331 - 47331 = 0.
    const meta = await novaMeta(cookie, 'RN-34 zero cofrinho', 500001);

    const leitura = await lerCompetenciaAtual(cookie);
    expect(leitura.body.naoAlocadoCentavos).toBe(0);

    const resposta = await guardar({ cookie, metaId: meta.id, contaOrigemId: contaOrigem.id, valorCentavos: 1 });
    expect(resposta.status).toBe(409);
    expect(resposta.body.erro).toBe('teto_excedido');
  });
});

// ===========================================================================
// EF-07 §5 — RN-35: a conta RESERVA fica fora do orçamento e fora do lastro.
// Fonte: SKILL.md linha 63 (tabela) e "RN-35 é RN-27 por outro nome" (linha
// 63, "Onde é imposta" → EF-06). Diferente de "guardar reduz o lastro"
// (abaixo): aqui a prova é que a conta RESERVA de um COFRINHO fica fora do
// lastro DINAMICAMENTE — mesmo quando ela cresce por um caminho que NÃO é
// `guardar` (uma RECEITA batida direto nela). `metas.teste.ts` só prova o
// efeito via `guardar`; este teste prova a propriedade da CONTA em si.
// ===========================================================================

describe('DoD §5 — RN-35: a conta RESERVA do cofrinho fica fora do lastro, mesmo crescendo fora de "guardar"', () => {
  it('um crédito direto na conta RESERVA do cofrinho (bypassando guardar) não move o lastro nem um centavo', async () => {
    const { cookie } = await novaFamiliaComCookie('RN-35 dinâmico');
    // Carregada de efeito só: dá à família um caixa de débito de 733 (a base
    // do `lastroCentavos` conferido abaixo). Não precisa do binding.
    await novaContaDebito(cookie, 'RN-35 conta de débito', 733);
    const meta = await novaMeta(cookie, 'RN-35 cofrinho', 900001);

    const antes = await lerCompetenciaAtual(cookie);
    expect(antes.body.lastroCentavos).toBe(733); // só a DEBITO conta.

    // RECEITA direta na conta RESERVA do cofrinho — não é "guardar" (RN-33),
    // é o caminho que prova que a EXCLUSÃO do lastro é propriedade da conta
    // (RN-35/RN-27), não um efeito colateral só do endpoint de guardar.
    await darRecebido(cookie, meta.contaReservaId, 48213);

    const depois = await lerCompetenciaAtual(cookie);
    expect(depois.body.lastroCentavos).toBe(733); // idêntico — a reserva cresceu, o lastro não.

    // O dinheiro não sumiu — só ficou fora do lastro. Confirma que a conta
    // realmente tem o saldo (RN-35 é "fora do lastro", não "sem saldo").
    const contas = await contasDaFamilia(cookie);
    const linhaReserva = contas.find(c => c.id === meta.contaReservaId);
    expect(linhaReserva?.saldoCentavos).toBe(48213);
    expect(linhaReserva?.tipo).toBe('RESERVA');
  });
});

// ===========================================================================
// EF-07 §5 — "guardar não consome teto de categoria nenhuma" (item explícito
// do DoD). Fonte: SKILL.md, RN-33 (linha 61: "não consome teto de categoria
// nenhuma") e regra inviolável #3 do CONTEXT.md ("transferência não é despesa").
// ===========================================================================

describe('DoD §5 — guardar NÃO consome teto de categoria nenhuma (valores quebrados)', () => {
  it('teto, gasto e disponível da categoria ficam bit-a-bit idênticos antes e depois de guardar', async () => {
    const { cookie } = await novaFamiliaComCookie('sem-teto largura');
    const contaOrigem = await novaContaDebito(cookie, 'sem-teto conta', 733);
    await darRecebido(cookie, contaOrigem.id, 900001);
    const categoriaId = await novaCategoria(cookie, 'sem-teto categoria');
    await definirTeto(cookie, competenciaAtual(), categoriaId, 47331);
    const meta = await novaMeta(cookie, 'sem-teto cofrinho', 500001);

    const antes = await lerCompetenciaAtual(cookie);
    const linhaAntes = antes.body.categorias.find((c: { id: string }) => c.id === categoriaId);
    expect(linhaAntes.tetoCentavos).toBe(47331);
    expect(linhaAntes.gastoCentavos).toBe(0);
    expect(linhaAntes.disponivelCentavos).toBe(47331);

    const resposta = await guardar({ cookie, metaId: meta.id, contaOrigemId: contaOrigem.id, valorCentavos: 33333 });
    expect(resposta.status).toBe(200);

    const depois = await lerCompetenciaAtual(cookie);
    const linhaDepois = depois.body.categorias.find((c: { id: string }) => c.id === categoriaId);
    expect(linhaDepois.tetoCentavos).toBe(47331);
    expect(linhaDepois.gastoCentavos).toBe(0);
    expect(linhaDepois.disponivelCentavos).toBe(47331);
  });
});

// ===========================================================================
// EF-07 §5 — "guardar REDUZ o lastro" (item explícito do DoD, valor
// conferido). Fonte: EF-07 §2, "consequência que parece bug e não é" — SKILL.md
// linhas 65-75. Distinto do teste de RN-35 acima: ali a prova é que a RESERVA
// fica fora do lastro quando cresce sozinha; aqui a prova é o EFEITO completo
// do ato de guardar (a origem perde caixa) — os dois ângulos da mesma moeda.
// ===========================================================================

describe('DoD §5 — guardar REDUZ o lastro do mês, exatamente o valor guardado (quebrado)', () => {
  it('lastroCentavos cai 76829 (nem mais, nem menos) depois de guardar 76829', async () => {
    const { cookie } = await novaFamiliaComCookie('lastro reduz, quebrado');
    const contaOrigem = await novaContaDebito(cookie, 'lastro reduz conta', 911);
    await darRecebido(cookie, contaOrigem.id, 488137);
    const meta = await novaMeta(cookie, 'lastro reduz cofrinho', 900002);

    const antes = await lerCompetenciaAtual(cookie);
    expect(antes.body.lastroCentavos).toBe(911 + 488137);

    const resposta = await guardar({ cookie, metaId: meta.id, contaOrigemId: contaOrigem.id, valorCentavos: 76829 });
    expect(resposta.status).toBe(200);

    const depois = await lerCompetenciaAtual(cookie);
    expect(depois.body.lastroCentavos).toBe(911 + 488137 - 76829);
    expect(depois.body.lastroCentavos).toBe(antes.body.lastroCentavos - 76829);
  });
});

// ===========================================================================
// EF-07 §5 — D2: a conta de origem vem do CORPO; pedido sem ela é recusado;
// nada é inferido. Fonte: SKILL.md "D2 · A conta de ORIGEM vem do corpo da
// requisição, nunca inferida" (linhas 94-99).
// ===========================================================================

describe('DoD §5 — D2: sem contaOrigemId no corpo, o pedido é recusado — nunca "a única conta de débito"', () => {
  it('família com UMA ÚNICA conta DEBITO: omitir contaOrigemId ainda assim dá 422, sem inferir essa conta', async () => {
    // O cenário É a armadilha: se alguém "otimizasse" o serviço para inferir
    // a conta quando só existe uma candidata óbvia, este teste pegaria —
    // com DUAS contas o 422 provaria só a validação de schema, não D2.
    const { cookie } = await novaFamiliaComCookie('D2 conta única');
    await novaContaDebito(cookie, 'D2 única conta debito', 733001);
    const meta = await novaMeta(cookie, 'D2 cofrinho', 500001);

    const resposta = await guardar({ cookie, metaId: meta.id, valorCentavos: 4001 }); // sem contaOrigemId.
    expect(resposta.status).toBe(422);

    const metas = await metasDaFamilia(cookie);
    expect(metas.find(m => m.id === meta.id)?.acumuladoCentavos).toBe(0);
  });
});

// ===========================================================================
// EF-07 §5 — D3: unicidade 1:1 entre cofrinho e conta RESERVA; o acumulado de
// um cofrinho não contamina o de outro. Fonte: SKILL.md "D3 · A meta É um
// cofrinho, e cada cofrinho tem a PRÓPRIA conta RESERVA" (linhas 101-109).
// ===========================================================================

describe('DoD §5 — D3: dois cofrinhos, transferências diferentes, acumulados independentes (quebrado)', () => {
  it('três guardares intercalados em dois cofrinhos nunca somam no cofrinho errado', async () => {
    const { cookie } = await novaFamiliaComCookie('D3 largura');
    const contaOrigem = await novaContaDebito(cookie, 'D3 conta', 733);
    await darRecebido(cookie, contaOrigem.id, 900001);
    const cofrinhoUm = await novaMeta(cookie, 'D3 cofrinho um', 500001);
    const cofrinhoDois = await novaMeta(cookie, 'D3 cofrinho dois', 300002);
    expect(cofrinhoUm.contaReservaId).not.toBe(cofrinhoDois.contaReservaId);

    const g1 = await guardar({ cookie, metaId: cofrinhoUm.id, contaOrigemId: contaOrigem.id, valorCentavos: 18453 });
    expect(g1.status).toBe(200);
    const g2 = await guardar({ cookie, metaId: cofrinhoDois.id, contaOrigemId: contaOrigem.id, valorCentavos: 5209 });
    expect(g2.status).toBe(200);
    // Segundo guardar NO MESMO cofrinho um — a prova de que a soma respeita a
    // conta vinculada, não a ordem cronológica global das transferências.
    const g3 = await guardar({ cookie, metaId: cofrinhoUm.id, contaOrigemId: contaOrigem.id, valorCentavos: 3001 });
    expect(g3.status).toBe(200);
    expect(g3.body.acumuladoCentavos).toBe(18453 + 3001);

    const metas = await metasDaFamilia(cookie);
    const lidoUm = metas.find(m => m.id === cofrinhoUm.id);
    const lidoDois = metas.find(m => m.id === cofrinhoDois.id);
    expect(lidoUm?.acumuladoCentavos).toBe(21454); // 18453 + 3001 — só o que foi PARA ele.
    expect(lidoDois?.acumuladoCentavos).toBe(5209); // intocado pelas duas transferências do outro.
  });
});

// ===========================================================================
// EF-07 §5 — excluir cofrinho com transferência devolve erro de domínio,
// nunca 500. Fonte: `modulos/metas/servico.ts#excluirMeta` (comentário
// "vira erro de DOMÍNIO... nunca uma exceção não tratada, nunca 500");
// SKILL.md edge case "Excluir um cofrinho com acumulado > 0" (linhas 169-171)
// registra que a exclusão em si é comportamento do serviço, não fonte aberta.
// ===========================================================================

describe('DoD §5 — excluir cofrinho com transferência: 409 de domínio, nunca 500, e nada some pela metade', () => {
  it('DELETE responde 409 sem "stack" no corpo, e o cofrinho/conta seguem intactos com o acumulado certo', async () => {
    const { cookie } = await novaFamiliaComCookie('exclusão com transferência');
    const contaOrigem = await novaContaDebito(cookie, 'exclusão conta', 733);
    await darRecebido(cookie, contaOrigem.id, 900001);
    const meta = await novaMeta(cookie, 'exclusão cofrinho', 500001);
    const guardado = await guardar({ cookie, metaId: meta.id, contaOrigemId: contaOrigem.id, valorCentavos: 8117 });
    expect(guardado.status).toBe(200);

    const resposta = await request(app).delete(`/metas/${meta.id}`).set('Cookie', cookie);
    expect(resposta.status).toBe(409);
    expect(resposta.status).not.toBe(500);
    expect(resposta.body.erro).toBe('meta_com_lancamentos');
    expect(resposta.body).not.toHaveProperty('stack');

    const metas = await metasDaFamilia(cookie);
    const lida = metas.find(m => m.id === meta.id);
    expect(lida).toBeDefined();
    expect(lida?.acumuladoCentavos).toBe(8117); // a exclusão foi recusada por INTEIRO, não parcial.

    const contas = await contasDaFamilia(cookie);
    expect(contas.some(c => c.id === meta.contaReservaId)).toBe(true);
  });
});

// ===========================================================================
// EF-07 §5 — isolamento entre famílias: familiaId vem do TOKEN, nunca do
// request. Fonte: regra inviolável #1 do CONTEXT.md; SKILL.md "Membro... só
// enxerga e altera dado da própria família" (linha 32). `metas.teste.ts` já
// prova que B não LÊ/GUARDA/EDITA o cofrinho de A; aqui a largura é: (1) um
// `familiaId` FORJADO no corpo de criação é ignorado — o dono é sempre o
// token; (2) a conta de ORIGEM de outra família também é invisível a quem
// guarda, não só o cofrinho.
// ===========================================================================

describe('DoD §5 — isolamento: familiaId vem do token (campo forjado no corpo é ignorado)', () => {
  it('POST /metas com familiaId forjado de outra família no corpo cria o cofrinho na família da SESSÃO', async () => {
    const { familia: familiaA } = await novaFamiliaComCookie('Isolamento A — dona forjada');
    const { cookie: cookieB } = await novaFamiliaComCookie('Isolamento B — sessão real');

    const resposta = await request(app)
      .post('/metas')
      .set('Cookie', cookieB)
      .send({ nome: 'Cofrinho com familiaId forjado', alvoCentavos: 123457, familiaId: familiaA.familiaId });
    expect(resposta.status).toBe(201);

    const metasDeB = await metasDaFamilia(cookieB);
    expect(metasDeB.some(m => m.nome === 'Cofrinho com familiaId forjado')).toBe(true);

    // A família "vítima" do campo forjado nunca vê o cofrinho — se familiaId
    // do CORPO vencesse, ele apareceria aqui.
    const cookieA = await cookieDeSessao(familiaA.membroId);
    const metasDeA = await metasDaFamilia(cookieA);
    expect(metasDeA.some(m => m.nome === 'Cofrinho com familiaId forjado')).toBe(false);
  });

  it('guardar com contaOrigemId de OUTRA família responde 404 — a conta de origem também é isolada', async () => {
    const { cookie: cookieA } = await novaFamiliaComCookie('Isolamento origem A');
    const contaDeA = await novaContaDebito(cookieA, 'Conta da família A', 500000);

    const { cookie: cookieB } = await novaFamiliaComCookie('Isolamento origem B');
    const metaDeB = await novaMeta(cookieB, 'Cofrinho de B', 500001);

    const resposta = await guardar({
      cookie: cookieB,
      metaId: metaDeB.id,
      contaOrigemId: contaDeA.id, // rouba o id de uma conta de A.
      valorCentavos: 1001,
    });
    expect(resposta.status).toBe(404);
    expect(resposta.body.erro).toBe('conta_nao_encontrada');

    const metasDeB = await metasDaFamilia(cookieB);
    expect(metasDeB.find(m => m.id === metaDeB.id)?.acumuladoCentavos).toBe(0);
  });
});

// ===========================================================================
// EF-07 §5 — dois clientes sem refresh: a invalidação de "metas" e "contas"
// chega ao segundo cliente. Precedente: `api/testes/realtime.teste.ts`.
// `metas.teste.ts` já prova isso para o "guardar"; aqui a largura é a mutação
// de CRIAR — que também cria uma conta (D3) e portanto também precisa
// invalidar "contas", não só "metas".
// ===========================================================================

describe('DoD §5 — dois clientes sem refresh: CRIAR cofrinho invalida "metas" E "contas" no segundo cliente', () => {
  it('POST /metas emite invalidação de metas e contas para uma segunda sessão da mesma família', async () => {
    const familia = await criarFamiliaComMembro('Tempo real — criar cofrinho');
    const cookiePrincipal = await cookieDeSessao(familia.membroId);
    const cookieOutraAba = await cookieDeSessao(familia.membroId);

    const { io: conectarCliente } = await import('socket.io-client');
    const { CAMINHO_REALTIME } = await import('../src/realtime/servidor');

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
        .post('/metas')
        .set('Cookie', cookiePrincipal)
        .send({ nome: 'Tempo real — cofrinho novo', alvoCentavos: 734511 });
      expect(resposta.status).toBe(201);

      await new Promise(r => setTimeout(r, 400));

      expect(recebidos.some(e => e.recurso === 'metas')).toBe(true);
      expect(recebidos.some(e => e.recurso === 'contas')).toBe(true);
    } finally {
      socket.close();
    }
  });
});
