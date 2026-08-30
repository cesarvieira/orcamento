/**
 * Os SEIS casos obrigatórios do DoD da EF-05 §5 (tarefa #72, papel `qa`) —
 * Postgres de verdade, HTTP real, mesmo padrão de `api/testes/apoio.ts` e
 * `preparar-banco.ts`. Handler com fake não prova fiação — é assim que
 * controller sem dispatch e evento sem consumidor passaram verdes nesta
 * fábrica (`preator/doutrina/LICOES.md`).
 *
 * ⛔ Regra #0: RN-23..RN-26 e D1 vêm de
 * `.preator/skills/negocio/faturas-e-ciclo-do-cartao/SKILL.md` — citando
 * `docs/especificacoes/EF-05-faturas.md` §1/§2/§5 como fonte primária. A
 * regra não é recontada aqui, só citada.
 *
 * ⛔ Este arquivo é DISJUNTO de `api/testes/faturas.teste.ts` (tarefa #70,
 * backend) e `api/testes/contas.teste.ts` — não toco neles. Os seis casos
 * abaixo são os MESMOS do DoD, com fixtures PRÓPRIAS para que esta suíte não
 * dependa, nem coincida por acaso, com a fixture de #70:
 *
 *   - #70 usa diaFechamento=5/diaVencimento=15 (15 > 5 ⇒ venceEm no MESMO
 *     mês). Aqui `diaVencimento ≤ diaFechamento` (venceEm no mês SEGUINTE) —
 *     o ramo de `venceEmDoCiclo` que #70 não exercita.
 *
 *   ⚠️ `diaFechamento` NÃO é uma constante fixa — é DERIVADO do relógio real
 *   (`hojeIso()`). Por quê: RN-08 restringe `diaFechamento` a 1..28, e o
 *   dia-do-mês de "hoje" varia de 1 a 31 — ou seja, PARA QUALQUER constante
 *   fixa escolhida, existe um dia do mês em que ela colide com "hoje". A
 *   colisão que importa é `diaFechamento === diaDeHoje`: nesse caso,
 *   `fechaEmDoCiclo` (`dia <= diaFechamento ⇒ mesmo mês`) crava `fechaEm`
 *   em HOJE, e `statusDoCiclo` (`hoje >= fechaEm`) já lê esse ciclo como
 *   FECHADA — nunca ABERTA. Os casos 1/4/5 exigem um ciclo CORRENTE
 *   genuinamente ABERTA; com uma constante fixa, esta suíte ficaria
 *   vermelha exatamente um dia por mês (o dia em que a constante bate com o
 *   relógio real) — vermelho que não é regressão, e que ensina a ignorar
 *   vermelho.
 *
 *   A correção: derivar `diaFechamento` de "hoje" por um deslocamento de 14
 *   dias no grupo cíclico Z/28 (`diaFechamentoSemColisao`, abaixo). Um
 *   deslocamento por uma constante `c` num grupo cíclico de tamanho `n` só
 *   tem ponto fixo quando `c ≡ 0 (mod n)`; aqui `c=14` e `n=28`, e
 *   `14 mod 28 = 14 ≠ 0` — logo NENHUM dia-do-mês de 1 a 28 produz
 *   `diaFechamentoSemColisao(d) === d`. Para `diaDeHoje` em 29/30/31 (fora
 *   do intervalo de RN-08) a diferença já é garantida porque o resultado
 *   nunca passa de 28. Conferido por força bruta para todo `d` de 1 a 31
 *   (nenhuma colisão) antes de escrever este arquivo.
 *
 *   - As datas dos casos 1/2/4/5/6 ficam ancoradas no passado (setembro de
 *     2025, um ano antes de qualquer "hoje" plausível desta suíte), com o
 *     DIA calculado a partir do `diaFechamento` derivado — nunca um número
 *     de dia hardcoded. O caso 3 atravessa a VIRADA DE ANO (novembro/2025 →
 *     janeiro/2026), arredondamento de ano em `comMesDeslocado` que a suíte
 *     de #70 (só agosto/setembro de um mesmo ano) nunca cobre.
 *
 * Achados de defeito em código de produção: reporto, não conserto (ver
 * relato final desta tarefa) — nenhum encontrado até aqui.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { fecharBanco } from '../src/db';
import { fechaEmDoCiclo } from '../src/modulos/faturas/dominio';
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
// Toda mutação de fatura emite invalidação (D-04/R3) — o emissor exige o
// servidor de tempo real de pé, mesmo padrão de `testes/faturas.teste.ts`.
let stack: StackDeTempoReal;

beforeAll(async () => {
  await limparBanco();
  familiaA = await criarFamiliaComMembro('Família A — casos do ciclo (#72)');
  familiaB = await criarFamiliaComMembro('Família B — casos do ciclo (#72)');
  cookieA = await cookieDeSessao(familiaA.membroId);
  cookieB = await cookieDeSessao(familiaB.membroId);
  stack = await subirServidorComRealtime();
});

afterAll(async () => {
  await stack.encerrar();
  await fecharBanco();
});

// ---------------------------------------------------------------------------
// Fixture DERIVADA do relógio real — ver o cabeçalho para a prova de que
// `diaFechamentoSemColisao` nunca coincide com o dia-do-mês de hoje.
// ---------------------------------------------------------------------------

/**
 * Cópia LOCAL — a produção não tem mais `hojeIso()` (D6, tarefa #91: o
 * cliente informa `hoje`/`data`, nunca o servidor calcula). Aqui ela segue
 * fazendo o papel do "relógio real" só para DERIVAR a fixture (ver o
 * cabeçalho do arquivo — `diaFechamentoSemColisao` precisa do dia-do-mês
 * real para nunca colidir).
 */
function hojeIso(): string {
  const agora = new Date();
  const mes = String(agora.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(agora.getUTCDate()).padStart(2, '0');
  return `${agora.getUTCFullYear()}-${mes}-${dia}`;
}

const HOJE = hojeIso();
const DIA_DE_HOJE = Number(HOJE.slice(8, 10)); // dia-do-mês real de hoje (1..31).

/**
 * Desloca `diaDeHoje` por 14 no grupo cíclico Z/28 (valores 1..28, a faixa
 * de RN-08). Deslocamento por constante não-nula módulo 28 não tem ponto
 * fixo — ver prova no cabeçalho do arquivo — então o resultado NUNCA é
 * igual a `diaDeHoje` quando `diaDeHoje` também está em 1..28; para
 * `diaDeHoje` em 29..31 a diferença já vem de graça (resultado ≤ 28).
 */
function diaFechamentoSemColisao(diaDeHoje: number): number {
  return (((diaDeHoje - 1) + 14) % 28) + 1;
}

const DIA_FECHAMENTO = diaFechamentoSemColisao(DIA_DE_HOJE);
/** Sempre ≤ DIA_FECHAMENTO e ≥ 1 (RN-08) — mantém o ramo de `venceEmDoCiclo` que #70 não exercita. */
const DIA_VENCIMENTO = Math.max(1, DIA_FECHAMENTO - 10);

/** O ciclo CORRENTE, calculado — nunca hardcoded — a partir do relógio real. */
const FECHA_EM_CORRENTE = fechaEmDoCiclo(DIA_FECHAMENTO, HOJE);

function data(ano: number, mes: number, dia: number): string {
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

// Âncora fixa no passado (bem antes de qualquer "hoje" plausível desta
// suíte) para os casos 1/2/4/5/6 — setembro tem 30 dias, folga de sobra
// para DIA_FECHAMENTO + 1 (no máximo 29, já que RN-08 crava DIA_FECHAMENTO
// em 1..28).
const ANO_ANCORA = 2025;
const MES_ANCORA = 9; // setembro/2025.

/** Compra no dia EXATO do fechamento — dia-do-mês igual a DIA_FECHAMENTO. */
const DATA_FECHADA = data(ANO_ANCORA, MES_ANCORA, DIA_FECHAMENTO);
/** Compra no dia SEGUINTE ao fechamento — MESMO mês civil, dia-do-mês maior. */
const DATA_DIA_SEGUINTE = data(ANO_ANCORA, MES_ANCORA, DIA_FECHAMENTO + 1);
/** dia ≤ diaFechamento ⇒ fecha no MESMO mês (RN-23): é a própria data da compra. */
const FECHA_EM_FECHADA = DATA_FECHADA;
/** dia > diaFechamento ⇒ fecha no mês SEGUINTE (RN-23). */
const FECHA_EM_DIA_SEGUINTE = data(ANO_ANCORA, MES_ANCORA + 1, DIA_FECHAMENTO);
/** diaVencimento ≤ diaFechamento ⇒ venceEm no mês SEGUINTE do fechaEm. */
const VENCE_EM_FECHADA = data(ANO_ANCORA, MES_ANCORA + 1, DIA_VENCIMENTO);

/** Só para não espalhar `!` pelo arquivo (proibido pelo lint). */
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

/**
 * D6 (2026-08-29, tarefa #91) — `?hoje=` é o dia corrente do CLIENTE, nunca
 * do relógio do servidor (era daí que vinha o defeito corrigido nesta
 * tarefa). Todos os chamadores desta suíte passam por aqui, então um só
 * lugar precisou aprender o novo campo obrigatório.
 */
async function listarFaturas(cookie: string, contaId: string) {
  return request(app).get('/faturas').query({ contaId, hoje: HOJE }).set('Cookie', cookie);
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
  nome = 'Cartão do ciclo (#72)',
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
  nome = 'Conta corrente (#72)',
  saldoInicialCentavos = 300000,
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

async function postarDespesa(
  dados: DadosDeDespesa & { quantidadeParcelas?: number },
): Promise<{ id: string; numeroParcela: number; data: string }[]> {
  const resposta = await request(app)
    .post('/lancamentos')
    .set('Cookie', dados.cookie)
    .send({
      tipo: 'DESPESA',
      descricao: dados.descricao ?? 'Compra (#72)',
      valorCentavos: dados.valorCentavos,
      data: dados.data,
      contaId: dados.contaId,
      categoriaId: dados.categoriaId,
      ...(dados.quantidadeParcelas ? { quantidadeParcelas: dados.quantidadeParcelas } : {}),
    });
  if (resposta.status !== 201) {
    throw new Error(`POST /lancamentos falhou (${resposta.status}): ${JSON.stringify(resposta.body)}`);
  }
  return resposta.body.lancamentos as { id: string; numeroParcela: number; data: string }[];
}

/** Uma compra À VISTA — devolve o id único do lançamento criado. */
async function novaDespesa(dados: DadosDeDespesa): Promise<string> {
  const [criado] = await postarDespesa(dados);
  return obrigatorio(criado, 'POST /lancamentos não devolveu nenhum lançamento criado').id;
}

/** Uma compra PARCELADA — devolve TODAS as parcelas geradas. */
async function novaCompraParcelada(
  dados: DadosDeDespesa & { quantidadeParcelas: number },
): Promise<{ id: string; numeroParcela: number; data: string }[]> {
  return postarDespesa(dados);
}

// ---------------------------------------------------------------------------
// Caso 1/2 (EF-05 §5, RN-23) — compra NO dia do fechamento vs no dia SEGUINTE.
//
// DATA_FECHADA e DATA_DIA_SEGUINTE compartilham ANO_ANCORA/MES_ANCORA por
// construção — MESMO mês civil, sempre, qualquer que seja DIA_FECHAMENTO —
// mas caem em DUAS faturas diferentes pelo ciclo (FECHA_EM_FECHADA vs
// FECHA_EM_DIA_SEGUINTE, meses diferentes). Um código que "somasse pelo mês
// civil" (armadilha 2 do protótipo, EF-05 §4 — `!l.mesRel`, que ignora
// `fechamento`) juntaria as duas na MESMA fatura; se a regra fosse violada,
// as asserções de itens/total abaixo falhariam.
// ---------------------------------------------------------------------------

describe('Caso 1/2 — RN-23: compra no dia do fechamento vs no dia seguinte (mês civil ≠ ciclo)', () => {
  it('compra no dia do fechamento fica na fatura que fecha HOJE; no dia seguinte, na fatura SEGUINTE', async () => {
    const cookie = cookieA;
    const categoriaId = await novaCategoria(cookie, 'Caso 1/2 categoria');
    const cartaoId = await novoCartao(cookie, 'Caso 1/2 cartão');

    // dia-do-mês igual a diaFechamento: cai no ciclo que fecha em FECHA_EM_FECHADA.
    const idNoFechamento = await novaDespesa({
      cookie,
      contaId: cartaoId,
      categoriaId,
      data: DATA_FECHADA,
      valorCentavos: 12000,
      descricao: 'Caso 1 — no fechamento',
    });
    // dia-do-mês estritamente maior, MESMO MÊS CIVIL: pela regra correta cai
    // no ciclo SEGUINTE — não na mesma fatura que a compra de cima, mesmo as
    // duas compartilhando ano/mês.
    const idDiaSeguinte = await novaDespesa({
      cookie,
      contaId: cartaoId,
      categoriaId,
      data: DATA_DIA_SEGUINTE,
      valorCentavos: 8000,
      descricao: 'Caso 2 — dia seguinte',
    });

    const resposta = await listarFaturas(cookie, cartaoId);
    expect(resposta.status).toBe(200);
    const faturas = resposta.body.faturas as Fatura[];
    // Três faturas: a que fecha em FECHA_EM_FECHADA, a que fecha em
    // FECHA_EM_DIA_SEGUINTE, e a do ciclo CORRENTE (sempre garantida, vazia).
    expect(faturas).toHaveLength(3);

    const faturaNoFechamento = faturaDoCiclo(faturas, FECHA_EM_FECHADA);
    expect(faturaNoFechamento.status).toBe('FECHADA');
    expect(faturaNoFechamento.itens.map(i => i.id)).toEqual([idNoFechamento]);
    expect(faturaNoFechamento.totalCentavos).toBe(12000);
    // Ramo de venceEm que #70 não exercita: diaVencimento ≤ diaFechamento ⇒ mês SEGUINTE do fechaEm.
    expect(faturaNoFechamento.venceEm).toBe(VENCE_EM_FECHADA);

    const faturaDiaSeguinte = faturaDoCiclo(faturas, FECHA_EM_DIA_SEGUINTE);
    expect(faturaDiaSeguinte.status).toBe('FECHADA');
    expect(faturaDiaSeguinte.itens.map(i => i.id)).toEqual([idDiaSeguinte]);
    expect(faturaDiaSeguinte.totalCentavos).toBe(8000);
    // As duas são faturas DIFERENTES — a prova de que a regra é o ciclo, não o mês civil.
    expect(faturaDiaSeguinte.id).not.toBe(faturaNoFechamento.id);

    // O ciclo corrente existe, vazio — nenhuma das duas despesas do passado o contaminou.
    const faturaCorrente = faturaDoCiclo(faturas, FECHA_EM_CORRENTE);
    expect(faturaCorrente.status).toBe('ABERTA');
    expect(faturaCorrente.totalCentavos).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Caso 3 (EF-05 §5) — parcela que atravessa ciclos, incluindo VIRADA DE ANO
// (novembro/2025 → dezembro/2025 → janeiro/2026), arredondamento que a
// suíte de #70 (só ago/set do mesmo ano) não cobre. Cada parcela é resolvida
// INDEPENDENTEMENTE pela mesma regra (skill: "não há tratamento especial de
// série atravessando ciclo"). Dia-do-mês 1 nas parcelas (em vez de um
// número fixo como 15) é seguro para QUALQUER DIA_FECHAMENTO derivado
// (1 ≤ diaFechamento sempre, RN-08), então o ciclo de cada parcela fecha no
// MESMO mês da própria data, qualquer que seja o valor derivado.
// ---------------------------------------------------------------------------

describe('Caso 3 — parcela que atravessa ciclos, com virada de ano', () => {
  it('cada parcela cai na fatura do SEU PRÓPRIO ciclo, mesmo cruzando o ano', async () => {
    const cookie = cookieA;
    const categoriaId = await novaCategoria(cookie, 'Caso 3 categoria');
    const cartaoId = await novoCartao(cookie, 'Caso 3 cartão');

    const dataDaPrimeira = data(2025, 11, 1);
    const parcelas = await novaCompraParcelada({
      cookie,
      contaId: cartaoId,
      categoriaId,
      data: dataDaPrimeira,
      valorCentavos: 9000,
      descricao: 'Caso 3 — compra parcelada',
      quantidadeParcelas: 3,
    });
    expect(parcelas).toHaveLength(3);
    const parcela1 = obrigatorio(parcelas.find(p => p.numeroParcela === 1), 'parcela 1 ausente');
    const parcela2 = obrigatorio(parcelas.find(p => p.numeroParcela === 2), 'parcela 2 ausente');
    const parcela3 = obrigatorio(parcelas.find(p => p.numeroParcela === 3), 'parcela 3 ausente');
    expect(parcela1.data).toBe(data(2025, 11, 1));
    expect(parcela2.data).toBe(data(2025, 12, 1));
    expect(parcela3.data).toBe(data(2026, 1, 1)); // virada de ano.

    const leitura = await listarFaturas(cookie, cartaoId);
    const faturas = leitura.body.faturas as Fatura[];

    // dia-do-mês 1 ≤ DIA_FECHAMENTO (sempre, RN-08: DIA_FECHAMENTO ≥ 1) ⇒
    // cada parcela fecha no MESMO mês da sua própria data.
    const faturaDaParcela1 = faturaDoCiclo(faturas, data(2025, 11, DIA_FECHAMENTO));
    const faturaDaParcela2 = faturaDoCiclo(faturas, data(2025, 12, DIA_FECHAMENTO));
    const faturaDaParcela3 = faturaDoCiclo(faturas, data(2026, 1, DIA_FECHAMENTO));

    expect(faturaDaParcela1.itens.map(i => i.id)).toEqual([parcela1.id]);
    expect(faturaDaParcela2.itens.map(i => i.id)).toEqual([parcela2.id]);
    expect(faturaDaParcela3.itens.map(i => i.id)).toEqual([parcela3.id]);
    // Três faturas DISTINTAS — não há "a fatura da série".
    const ids = new Set([faturaDaParcela1.id, faturaDaParcela2.id, faturaDaParcela3.id]);
    expect(ids.size).toBe(3);
    // Cada parcela é 3000 (9000/3, sem resíduo): a soma de cada fatura bate com a parcela isolada.
    expect(faturaDaParcela1.totalCentavos).toBe(3000);
    expect(faturaDaParcela2.totalCentavos).toBe(3000);
    expect(faturaDaParcela3.totalCentavos).toBe(3000);
  });
});

// ---------------------------------------------------------------------------
// Caso 4 (EF-05 §5, RN-24) — após o pagamento, o extrato filtrado por
// cartão continua correto: nenhum lançamento trocou de conta. Com UMA
// fatura paga e OUTRA ainda em aberto no MESMO cartão, para provar que o
// pagamento de uma não mexe na outra (armadilha 1, EF-05 §4: reatribuir
// lançamentos para a conta pagadora).
// ---------------------------------------------------------------------------

describe('Caso 4 — RN-24: extrato por cartão continua correto após o pagamento', () => {
  it('a compra paga mantém contaId=cartão; a compra da OUTRA fatura (não paga) também não é tocada', async () => {
    const cookie = cookieA;
    const categoriaId = await novaCategoria(cookie, 'Caso 4 categoria');
    const cartaoId = await novoCartao(cookie, 'Caso 4 cartão');
    const contaCorrenteId = await novaContaDebito(cookie, 'Caso 4 conta corrente', 300000);

    const compraFechadaId = await novaDespesa({
      cookie,
      contaId: cartaoId,
      categoriaId,
      data: DATA_FECHADA,
      valorCentavos: 25000,
      descricao: 'Caso 4 — fatura fechada',
    });
    // Uma segunda compra, em OUTRO ciclo (o corrente), que não será paga
    // nesta rodada — a prova de que pagar uma fatura não contamina a outra.
    const compraAbertaId = await novaDespesa({
      cookie,
      contaId: cartaoId,
      categoriaId,
      data: HOJE,
      valorCentavos: 9000,
      descricao: 'Caso 4 — fatura aberta',
    });

    const antes = await request(app).get('/lancamentos').set('Cookie', cookie).query({ contaId: cartaoId });
    const idsAntes = (antes.body.lancamentos as { id: string }[]).map(l => l.id);
    expect(idsAntes).toContain(compraFechadaId);
    expect(idsAntes).toContain(compraAbertaId);

    const leitura = await listarFaturas(cookie, cartaoId);
    const faturaFechada = faturaDoCiclo(leitura.body.faturas as Fatura[], FECHA_EM_FECHADA);
    expect(faturaFechada.totalCentavos).toBe(25000);

    const pagamento = await request(app)
      .post(`/faturas/${faturaFechada.id}/pagar`)
      .set('Cookie', cookie)
      .send({ pagaComContaId: contaCorrenteId, data: HOJE });
    expect(pagamento.status).toBe(200);
    expect(pagamento.body.status).toBe('PAGA');
    expect(pagamento.body.totalCentavos).toBe(25000);

    // ⛔ Armadilha 1 (EF-05 §5): o protótipo
    // reescreve `lancs.map(l => l.conta === id ? {...l, conta: contaPagadora} : l)`.
    // As DUAS compras originais (a paga E a não paga) têm que continuar com
    // contaId = cartão.
    const depois = await request(app).get('/lancamentos').set('Cookie', cookie).query({ contaId: cartaoId });
    const linhas = depois.body.lancamentos as { id: string; contaId: string; tipo: string }[];
    const linhaPaga = obrigatorio(linhas.find(l => l.id === compraFechadaId), 'compra da fatura paga sumiu do extrato do cartão');
    const linhaAberta = obrigatorio(linhas.find(l => l.id === compraAbertaId), 'compra da fatura ainda aberta sumiu do extrato do cartão');
    expect(linhaPaga.contaId).toBe(cartaoId);
    expect(linhaPaga.tipo).toBe('DESPESA');
    expect(linhaAberta.contaId).toBe(cartaoId);
    expect(linhaAberta.tipo).toBe('DESPESA');

    // O pagamento em si é um lançamento NOVO — TRANSFERENCIA da conta corrente para o cartão.
    const extratoDaCorrente = await request(app)
      .get('/lancamentos')
      .set('Cookie', cookie)
      .query({ contaId: contaCorrenteId });
    const transferencia = (
      extratoDaCorrente.body.lancamentos as { tipo: string; contaDestinoId: string | null; valorCentavos: number }[]
    ).find(l => l.tipo === 'TRANSFERENCIA' && l.contaDestinoId === cartaoId);
    expect(transferencia).toBeDefined();
    expect(transferencia?.valorCentavos).toBe(25000);

    // A fatura da compra AINDA ABERTA continua intacta e independente — pagar
    // a outra não mudou seu total nem seus itens.
    const leituraDepois = await listarFaturas(cookie, cartaoId);
    const faturasDepois = leituraDepois.body.faturas as Fatura[];
    expect(faturasDepois.map(f => f.id)).not.toContain(faturaFechada.id); // paga, sai da lista "em aberto" (D1).
    const faturaAindaAberta = faturaDoCiclo(faturasDepois, FECHA_EM_CORRENTE);
    expect(faturaAindaAberta.totalCentavos).toBe(9000);
    expect(faturaAindaAberta.itens.map(i => i.id)).toEqual([compraAbertaId]);
  });
});

// ---------------------------------------------------------------------------
// Caso 5 (EF-05 §5, RN-25/RN-26, D1) — limite livre = limite − Σ(faturas não
// pagas), e SÓ recompõe no pagamento, nunca no fechamento. O ponto central:
// comparar os DOIS números (a soma D1 vs a leitura estreita "só o ciclo
// corrente" que D1 rejeitou) e depois provar a TRANSIÇÃO — o limite livre
// muda exatamente quando (e só quando) a fatura fechada é paga.
// ---------------------------------------------------------------------------

describe('Caso 5 — D1: limite livre = limite − Σ(faturas não pagas); recompõe só no pagamento', () => {
  it('antes de pagar, desconta FECHADA + ABERTA; depois de pagar a FECHADA, desconta só a ABERTA', async () => {
    const cookie = cookieA;
    const categoriaId = await novaCategoria(cookie, 'Caso 5 categoria');
    const contaCorrenteId = await novaContaDebito(cookie, 'Caso 5 conta corrente', 500000);
    const limite = 400000;
    const cartaoId = await novoCartao(cookie, 'Caso 5 cartão', limite);

    // Fatura FECHADA (ciclo já fechou, ainda não paga).
    await novaDespesa({
      cookie,
      contaId: cartaoId,
      categoriaId,
      data: DATA_FECHADA,
      valorCentavos: 70000,
      descricao: 'Caso 5 — fechada',
    });
    // Fatura ABERTA (ciclo corrente, ainda acumulando).
    await novaDespesa({
      cookie,
      contaId: cartaoId,
      categoriaId,
      data: HOJE,
      valorCentavos: 20000,
      descricao: 'Caso 5 — corrente',
    });

    const antes = await listarFaturas(cookie, cartaoId);
    expect(antes.status).toBe(200);
    expect(antes.body.limiteCentavos).toBe(limite);
    const faturasAntes = antes.body.faturas as Fatura[];
    const fechada = faturaDoCiclo(faturasAntes, FECHA_EM_FECHADA);
    const aberta = faturaDoCiclo(faturasAntes, FECHA_EM_CORRENTE);
    expect(fechada.status).toBe('FECHADA');
    expect(aberta.status).toBe('ABERTA');
    expect(fechada.totalCentavos).toBe(70000);
    expect(aberta.totalCentavos).toBe(20000);

    // D1 — o valor CORRETO desconta as DUAS, mesmo a FECHADA já estando
    // "fechada" (fora do ciclo corrente) há tempos: fechar não devolveu limite.
    expect(antes.body.limiteLivreCentavos).toBe(limite - (70000 + 20000));
    // Explicitamente DIFERENTE da leitura estreita de RN-25 (só o ciclo
    // corrente) — a ambiguidade que D1 resolve. Se o código somasse só
    // `status = 'ABERTA'` (a armadilha de nomenclatura da skill), este valor
    // bateria com o de baixo, e a asserção acima já teria falhado antes.
    expect(antes.body.limiteLivreCentavos).not.toBe(limite - 20000);

    // Agora paga a FECHADA — RN-24/D1: só O PAGAMENTO recompõe o limite.
    const pagamento = await request(app)
      .post(`/faturas/${fechada.id}/pagar`)
      .set('Cookie', cookie)
      .send({ pagaComContaId: contaCorrenteId, data: HOJE });
    expect(pagamento.status).toBe(200);

    const depois = await listarFaturas(cookie, cartaoId);
    // O limite livre sobe EXATAMENTE pelo valor da fatura paga (70000) — nem
    // mais, nem menos: a ABERTA continua intacta e a paga sai da soma.
    expect(depois.body.limiteLivreCentavos).toBe(limite - 20000);
    expect(depois.body.limiteLivreCentavos).toBe(antes.body.limiteLivreCentavos + 70000);
    // E a fatura ABERTA, que nunca foi tocada, mantém seu total.
    const abertaDepois = faturaDoCiclo(depois.body.faturas as Fatura[], FECHA_EM_CORRENTE);
    expect(abertaDepois.totalCentavos).toBe(20000);
    expect(abertaDepois.status).toBe('ABERTA');
  });
});

// ---------------------------------------------------------------------------
// Caso 6 (EF-05 §5) — isolamento entre famílias E dois clientes da MESMA
// família vendo o pagamento sem refresh, provados a partir de UM ÚNICO POST
// real (não `emitirInvalidacao` chamado direto) — a rota de verdade,
// observada por três sockets ao mesmo tempo: dois de A, um de B.
// ---------------------------------------------------------------------------

describe('Caso 6 — isolamento entre famílias · dois clientes veem o pagamento sem refresh', () => {
  it('a família B nunca lê nem paga fatura de A (404, não 200/403)', async () => {
    const cookie = cookieA;
    const categoriaId = await novaCategoria(cookie, 'Caso 6 isolamento categoria');
    const cartaoId = await novoCartao(cookie, 'Caso 6 isolamento cartão');
    await novaDespesa({
      cookie,
      contaId: cartaoId,
      categoriaId,
      data: DATA_FECHADA,
      valorCentavos: 5000,
      descricao: 'Caso 6 — compra de A',
    });

    // B nem consegue LER a fatura de A pelo cartão de A.
    const leituraDeB = await listarFaturas(cookieB, cartaoId);
    expect(leituraDeB.status).toBe(404);

    // Nem PAGAR — mesmo sabendo o id da fatura (A lê com o próprio cookie).
    const leituraDeA = await listarFaturas(cookieA, cartaoId);
    const fatura = faturaDoCiclo(leituraDeA.body.faturas as Fatura[], FECHA_EM_FECHADA);
    const contaDeB = await novaContaDebito(cookieB, 'Caso 6 conta de B');
    const pagamentoDeB = await request(app)
      .post(`/faturas/${fatura.id}/pagar`)
      .set('Cookie', cookieB)
      .send({ pagaComContaId: contaDeB, data: HOJE });
    expect(pagamentoDeB.status).toBe(404);
    expect(pagamentoDeB.body.erro).toBe('fatura_nao_encontrada');
  });

  it('um POST real de pagamento invalida os DOIS clientes de A, sem refresh; B (outra família) não recebe nada', async () => {
    const { io: conectarCliente } = await import('socket.io-client');
    const { CAMINHO_REALTIME } = await import('../src/realtime/servidor');

    const cookie = cookieA;
    const categoriaId = await novaCategoria(cookie, 'Caso 6 tempo real categoria');
    const cartaoId = await novoCartao(cookie, 'Caso 6 tempo real cartão');
    const contaCorrenteId = await novaContaDebito(cookie, 'Caso 6 tempo real conta corrente', 100000);
    await novaDespesa({
      cookie,
      contaId: cartaoId,
      categoriaId,
      data: DATA_FECHADA,
      valorCentavos: 4000,
      descricao: 'Caso 6 — compra tempo real',
    });
    const leitura = await listarFaturas(cookie, cartaoId);
    const fatura = faturaDoCiclo(leitura.body.faturas as Fatura[], FECHA_EM_FECHADA);

    // Duas SESSÕES da MESMA família (dois clientes/abas) + uma sessão da
    // OUTRA família, na sala errada de propósito.
    const cookieOutraAba = await cookieDeSessao(familiaA.membroId);
    function conectar(cookieDaSessao: string) {
      return conectarCliente(stack.url, {
        path: CAMINHO_REALTIME,
        transports: ['websocket'],
        extraHeaders: { Cookie: cookieDaSessao },
        reconnection: false,
      });
    }
    const socket1DeA = conectar(cookie);
    const socket2DeA = conectar(cookieOutraAba);
    const socketDeB = conectar(cookieB);

    await Promise.all(
      [socket1DeA, socket2DeA, socketDeB].map(
        s =>
          new Promise<void>((resolver, rejeitar) => {
            s.once('connect', () => resolver());
            s.once('connect_error', rejeitar);
            setTimeout(() => rejeitar(new Error('timeout de conexão')), 8000);
          }),
      ),
    );

    try {
      const recebidoPor1: { recurso: string }[] = [];
      const recebidoPor2: { recurso: string }[] = [];
      const recebidoPorB: { recurso: string }[] = [];
      socket1DeA.on('recurso.alterado', (e: { recurso: string }) => recebidoPor1.push(e));
      socket2DeA.on('recurso.alterado', (e: { recurso: string }) => recebidoPor2.push(e));
      socketDeB.on('recurso.alterado', (e: { recurso: string }) => recebidoPorB.push(e));

      // O ato de verdade — a rota HTTP real de pagamento, não `emitirInvalidacao` chamado direto.
      const pagamento = await request(stack.http)
        .post(`/faturas/${fatura.id}/pagar`)
        .set('Cookie', cookie)
        .send({ pagaComContaId: contaCorrenteId, data: HOJE });
      expect(pagamento.status).toBe(200);

      await new Promise(r => setTimeout(r, 400));

      // Os DOIS clientes de A recebem — "sem refresh" é isto: nenhum dos dois pediu a página de novo.
      expect(recebidoPor1.some(e => e.recurso === 'faturas')).toBe(true);
      expect(recebidoPor1.some(e => e.recurso === 'contas')).toBe(true);
      expect(recebidoPor2.some(e => e.recurso === 'faturas')).toBe(true);
      expect(recebidoPor2.some(e => e.recurso === 'contas')).toBe(true);
      // B, de outra família, não recebe absolutamente nada deste pagamento.
      expect(recebidoPorB).toHaveLength(0);
    } finally {
      socket1DeA.close();
      socket2DeA.close();
      socketDeB.close();
    }
  });
});
