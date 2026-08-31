/**
 * RN-41, RN-42, RN-43 e RN-45 (EF-01) — convite: criar, persistir, validar
 * token, expirar, recusar email divergente, e a ausência de hierarquia.
 *
 * O driver de email é `log` (default do ambiente de teste — D-07): nenhum
 * email sai de verdade, mas o convite em si é real — Postgres, migration e
 * HTTP reais, igual ao resto da suíte.
 */
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { io as conectarCliente, type Socket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { ambiente } from '../src/config/ambiente';
import { db, fecharBanco } from '../src/db';
import { convites } from '../src/db/schema';
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
// O aceite de convite emite invalidação (@fundacao do emissor) — isso exige
// o servidor de tempo real DE PÉ, então ele sobe uma vez para o arquivo
// inteiro, não só para o describe de isolamento por socket.
let stack: StackDeTempoReal;

beforeAll(async () => {
  await limparBanco();
  familiaA = await criarFamiliaComMembro('Família A dos convites');
  familiaB = await criarFamiliaComMembro('Família B dos convites');
  cookieA = await cookieDeSessao(familiaA.membroId);
  cookieB = await cookieDeSessao(familiaB.membroId);
  stack = await subirServidorComRealtime();
});

afterAll(async () => {
  await stack.encerrar();
  await fecharBanco();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function convitePorEmail(email: string) {
  const [linha] = await db.select().from(convites).where(eq(convites.email, email)).limit(1);
  return linha ?? null;
}

/** Fixture de teste, não segredo — mesma convenção de `apoio.ts`. */
const SENHA_DE_TESTE = ['fixture', 'forte', 'de', 'convite'].join('-');

describe('criar convite', () => {
  it('exige sessão', async () => {
    const resposta = await request(app).post('/convites').send({ email: 'sem-sessao@exemplo.test' });
    expect(resposta.status).toBe(401);
  });

  it('RN-41: persiste na família da SESSÃO, mesmo que o corpo tente outra', async () => {
    const resposta = await request(app)
      .post('/convites')
      .set('Cookie', cookieA)
      .send({ email: 'convidada-rn01@exemplo.test', familiaId: familiaB.familiaId });

    expect(resposta.status).toBe(201);
    expect(resposta.body).toMatchObject({ email: 'convidada-rn01@exemplo.test' });
    // O token NUNCA sai na resposta HTTP — só viaja pelo email.
    expect(resposta.body.token).toBeUndefined();

    const linha = await convitePorEmail('convidada-rn01@exemplo.test');
    expect(linha?.familiaId).toBe(familiaA.familiaId);
    expect(linha?.familiaId).not.toBe(familiaB.familiaId);
  });

  it('RN-43: expira em CONVITE_TTL_HORAS a partir de agora', async () => {
    const antes = Date.now();
    const resposta = await request(app)
      .post('/convites')
      .set('Cookie', cookieA)
      .send({ email: 'convidada-ttl@exemplo.test' });

    const esperado = antes + ambiente.CONVITE_TTL_HORAS * 3600_000;
    const recebido = new Date(resposta.body.expiraEm as string).getTime();
    expect(Math.abs(recebido - esperado)).toBeLessThan(5000);
  });

  it('usa o driver `log`: não envia de verdade, mas registra a tentativa', async () => {
    const espiao = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      const resposta = await request(app)
        .post('/convites')
        .set('Cookie', cookieA)
        .send({ email: 'convidada-log@exemplo.test' });

      expect(resposta.status).toBe(201);
      const chamadas = espiao.mock.calls.map(args => String(args[0]));
      // O que o email carrega agora é o CÓDIGO (RN-50), não um link com
      // segredo dentro — é por ele que a linha de log se prova.
      expect(
        chamadas.some(linha => linha.includes('convidada-log@exemplo.test') && /código \d{6}/.test(linha)),
      ).toBe(true);
    } finally {
      espiao.mockRestore();
    }
  });

  it('em teste o driver é `log` MESMO se o ambiente pedir outro (trava de segurança)', async () => {
    // Se esta trava cair, um `MAIL_DRIVER=resend` no `.env` de alguém faz a
    // suíte mandar email de verdade para endereços inventados, toda execução.
    const original = ambiente.MAIL_DRIVER;
    const espiao = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      ambiente.MAIL_DRIVER = 'resend';

      const resposta = await request(app)
        .post('/convites')
        .set('Cookie', cookieA)
        .send({ email: 'trava-driver@exemplo.test' });

      // `resend` sem credencial estouraria; `log` responde 201 e registra.
      expect(resposta.status).toBe(201);
      const chamadas = espiao.mock.calls.map(args => args.map(String).join(' '));
      expect(chamadas.some(linha => linha.includes('[email:log]'))).toBe(true);
    } finally {
      ambiente.MAIL_DRIVER = original;
      espiao.mockRestore();
    }
  });

  it('corpo sem email válido responde 422', async () => {
    const resposta = await request(app).post('/convites').set('Cookie', cookieA).send({ email: 'a' });
    expect(resposta.status).toBe(422);
  });
});

describe('aceitar convite', () => {
  it('feliz: cria o membro, marca o convite usado, e abre sessão na família do convite', async () => {
    const email = 'nova-pessoa@exemplo.test';
    await request(app).post('/convites').set('Cookie', cookieA).send({ email });
    const convite = await convitePorEmail(email);
    if (!convite) throw new Error('setup: convite não persistiu');

    const aceite = await request(app).post('/convites/aceitar').send({
      metodo: 'senha',
      codigo: convite.token,
      nome: 'Nova Pessoa',
      email,
      senha: SENHA_DE_TESTE,
    });

    expect(aceite.status).toBe(201);
    expect(aceite.body.familiaId).toBe(familiaA.familiaId);
    expect(aceite.body.membroEmail).toBe(email);

    const usado = await convitePorEmail(email);
    expect(usado?.usadoEm).not.toBeNull();

    const cookieDaNova = (aceite.headers['set-cookie'] as unknown as string[]).find(c =>
      c.startsWith('orcamento_sessao='),
    );
    const familia = await request(app).get('/familia').set('Cookie', cookieDaNova as string);
    expect((familia.body.membros as { email: string }[]).map(m => m.email)).toContain(email);
  });

  it('RN-43: recusa email que não tem convite nenhum', async () => {
    const resposta = await request(app).post('/convites/aceitar').send({
      metodo: 'senha',
      codigo: '000000',
      nome: 'X',
      email: 'nunca-foi-convidado@exemplo.test',
      senha: SENHA_DE_TESTE,
    });
    expect(resposta.status).toBe(404);
    expect(resposta.body.erro).toBe('convite_nao_encontrado');
  });

  it('RN-50: código errado é recusado sem consumir o convite', async () => {
    const email = 'codigo-errado@exemplo.test';
    await request(app).post('/convites').set('Cookie', cookieA).send({ email });
    const convite = await convitePorEmail(email);
    if (!convite) throw new Error('setup: convite não persistiu');

    // Um código que garantidamente NÃO é o sorteado.
    const errado = convite.token === '000000' ? '111111' : '000000';
    const resposta = await request(app)
      .post('/convites/aceitar')
      .send({ metodo: 'senha', codigo: errado, nome: 'Chutador', email, senha: SENHA_DE_TESTE });

    expect(resposta.status).toBe(401);
    expect(resposta.body.erro).toBe('codigo_invalido');

    // Errar não queima o convite — só gasta uma tentativa.
    const aindaPendente = await convitePorEmail(email);
    expect(aindaPendente?.usadoEm).toBeNull();
    expect(aindaPendente?.tentativas).toBe(1);
  });

  it('RN-51: na quinta tentativa errada o código é invalidado, e o certo já não vale', async () => {
    const email = 'forca-bruta@exemplo.test';
    await request(app).post('/convites').set('Cookie', cookieA).send({ email });
    const convite = await convitePorEmail(email);
    if (!convite) throw new Error('setup: convite não persistiu');

    const errado = convite.token === '000000' ? '111111' : '000000';
    const chutar = (codigo: string) =>
      request(app)
        .post('/convites/aceitar')
        .send({ metodo: 'senha', codigo, nome: 'Chutador', email, senha: SENHA_DE_TESTE });

    for (let i = 0; i < 4; i += 1) {
      const parcial = await chutar(errado);
      expect(parcial.status).toBe(401);
    }

    const quinta = await chutar(errado);
    expect(quinta.status).toBe(429);
    expect(quinta.body.erro).toBe('convite_bloqueado');

    // O teto vale mesmo para quem acerta depois: o código morreu.
    const comOCerto = await chutar(convite.token);
    expect(comOCerto.status).toBe(429);
    expect(comOCerto.body.erro).toBe('convite_bloqueado');
  });

  it('RN-43: convite de uso único — o segundo aceite do MESMO código é recusado', async () => {
    const email = 'uso-unico@exemplo.test';
    await request(app).post('/convites').set('Cookie', cookieA).send({ email });
    const convite = await convitePorEmail(email);
    if (!convite) throw new Error('setup: convite não persistiu');

    const corpo = {
      metodo: 'senha' as const,
      codigo: convite.token,
      nome: 'Uso Único',
      email,
      senha: SENHA_DE_TESTE,
    };
    const primeiro = await request(app).post('/convites/aceitar').send(corpo);
    expect(primeiro.status).toBe(201);

    const segundo = await request(app).post('/convites/aceitar').send(corpo);
    expect(segundo.status).toBe(409);
    expect(segundo.body.erro).toBe('convite_usado');
  });

  it('RN-43: convite expirado é recusado', async () => {
    const email = 'expirado@exemplo.test';
    const [linha] = await db
      .insert(convites)
      .values({
        familiaId: familiaA.familiaId,
        email,
        token: '424242',
        expiraEm: new Date(Date.now() - 3600_000), // uma hora no passado
      })
      .returning();
    if (!linha) throw new Error('setup: não consegui inserir convite expirado');

    const resposta = await request(app)
      .post('/convites/aceitar')
      .send({ metodo: 'senha', codigo: linha.token, nome: 'Tarde Demais', email, senha: SENHA_DE_TESTE });

    expect(resposta.status).toBe(410);
    expect(resposta.body.erro).toBe('convite_expirado');
  });

  it('RN-42: o email de outra pessoa não acha o convite — nem com o código certo', async () => {
    const emailConvidado = 'convidada-certa@exemplo.test';
    await request(app).post('/convites').set('Cookie', cookieA).send({ email: emailConvidado });
    const convite = await convitePorEmail(emailConvidado);
    if (!convite) throw new Error('setup: convite não persistiu');

    const resposta = await request(app)
      .post('/convites/aceitar')
      .send({
        metodo: 'senha',
        codigo: convite.token,
        nome: 'Impostor',
        email: 'outro-email@exemplo.test',
        senha: SENHA_DE_TESTE,
      });

    // Desde RN-50 a busca é pelo par email + código: com o email errado não há
    // o que comparar, o convite simplesmente não existe para quem tenta.
    expect(resposta.status).toBe(404);
    expect(resposta.body.erro).toBe('convite_nao_encontrado');

    // A tentativa recusada NÃO consome o convite — o email certo ainda pode aceitar.
    const aindaPendente = await convitePorEmail(emailConvidado);
    expect(aindaPendente?.usadoEm).toBeNull();
  });

  it('RN-45: quem entrou por convite tem o MESMO poder — também convida', async () => {
    const email = 'convida-de-novo@exemplo.test';
    await request(app).post('/convites').set('Cookie', cookieA).send({ email });
    const convite = await convitePorEmail(email);
    if (!convite) throw new Error('setup: convite não persistiu');

    const aceite = await request(app)
      .post('/convites/aceitar')
      .send({ metodo: 'senha', codigo: convite.token, nome: 'Convida De Novo', email, senha: SENHA_DE_TESTE });
    const cookieDoNovo = (aceite.headers['set-cookie'] as unknown as string[]).find(c =>
      c.startsWith('orcamento_sessao='),
    ) as string;

    // Nenhum código de papel/hierarquia existe — o novo membro convida como
    // qualquer outro. É a AUSÊNCIA de checagem de papel que prova RN-45.
    const proximoConvite = await request(app)
      .post('/convites')
      .set('Cookie', cookieDoNovo)
      .send({ email: 'mais-uma-pessoa@exemplo.test' });

    expect(proximoConvite.status).toBe(201);
    const linha = await convitePorEmail('mais-uma-pessoa@exemplo.test');
    expect(linha?.familiaId).toBe(familiaA.familiaId);
  });
});

describe('listar convites pendentes', () => {
  it('exige sessão', async () => {
    const resposta = await request(app).get('/convites');
    expect(resposta.status).toBe(401);
  });

  it('EF01-MC-001/RN-41: só lista os pendentes da família da SESSÃO, isolado da outra família', async () => {
    const emailPendenteA = 'pendente-a@exemplo.test';
    const emailPendenteB = 'pendente-b@exemplo.test';
    await request(app).post('/convites').set('Cookie', cookieA).send({ email: emailPendenteA });
    await request(app).post('/convites').set('Cookie', cookieB).send({ email: emailPendenteB });

    const listaA = await request(app).get('/convites').set('Cookie', cookieA);
    expect(listaA.status).toBe(200);
    const emailsA = (listaA.body.convites as { email: string }[]).map(c => c.email);
    expect(emailsA).toContain(emailPendenteA);
    expect(emailsA).not.toContain(emailPendenteB);

    const listaB = await request(app).get('/convites').set('Cookie', cookieB);
    const emailsB = (listaB.body.convites as { email: string }[]).map(c => c.email);
    expect(emailsB).toContain(emailPendenteB);
    expect(emailsB).not.toContain(emailPendenteA);
  });

  it('convite já aceito (usado) não aparece na lista', async () => {
    const email = 'usado-nao-lista@exemplo.test';
    await request(app).post('/convites').set('Cookie', cookieA).send({ email });
    const convite = await convitePorEmail(email);
    if (!convite) throw new Error('setup: convite não persistiu');

    const aceite = await request(app).post('/convites/aceitar').send({
      codigo: convite.token,
      metodo: 'senha',
      nome: 'Já Aceitou',
      email,
      senha: SENHA_DE_TESTE,
    });
    expect(aceite.status).toBe(201);

    const lista = await request(app).get('/convites').set('Cookie', cookieA);
    const emails = (lista.body.convites as { email: string }[]).map(c => c.email);
    expect(emails).not.toContain(email);
  });

  it('convite expirado não aparece na lista', async () => {
    const email = 'expirado-nao-lista@exemplo.test';
    const [linha] = await db
      .insert(convites)
      .values({
        familiaId: familiaA.familiaId,
        email,
        token: '353535',
        expiraEm: new Date(Date.now() - 3600_000), // uma hora no passado
      })
      .returning();
    if (!linha) throw new Error('setup: não consegui inserir convite expirado');

    const lista = await request(app).get('/convites').set('Cookie', cookieA);
    const emails = (lista.body.convites as { email: string }[]).map(c => c.email);
    expect(emails).not.toContain(email);
  });

  it('mais recente primeiro', async () => {
    const emailMaisAntigo = 'ordem-antigo@exemplo.test';
    const emailMaisRecente = 'ordem-recente@exemplo.test';
    await request(app).post('/convites').set('Cookie', cookieA).send({ email: emailMaisAntigo });
    await request(app).post('/convites').set('Cookie', cookieA).send({ email: emailMaisRecente });

    const lista = await request(app).get('/convites').set('Cookie', cookieA);
    const emails = (lista.body.convites as { email: string }[]).map(c => c.email);
    const posAntigo = emails.indexOf(emailMaisAntigo);
    const posRecente = emails.indexOf(emailMaisRecente);
    expect(posRecente).toBeGreaterThanOrEqual(0);
    expect(posAntigo).toBeGreaterThan(posRecente);
  });
});

describe('isolamento do convite (REST e socket)', () => {
  const abertos: Socket[] = [];

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

  afterAll(() => {
    for (const s of abertos) s.close();
  });

  it('a família B NÃO recebe a invalidação de um convite aceito na família A', async () => {
    const socketA = conectar(cookieA);
    const socketB = conectar(cookieB);
    await Promise.all([esperarConexao(socketA), esperarConexao(socketB)]);

    const recebidoPorA: unknown[] = [];
    const recebidoPorB: unknown[] = [];
    socketA.on('recurso.alterado', e => recebidoPorA.push(e));
    socketB.on('recurso.alterado', e => recebidoPorB.push(e));

    const email = 'isolamento-socket@exemplo.test';
    await request(app).post('/convites').set('Cookie', cookieA).send({ email });
    const convite = await convitePorEmail(email);
    if (!convite) throw new Error('setup: convite não persistiu');

    const aceite = await request(app)
      .post('/convites/aceitar')
      .send({ metodo: 'senha', codigo: convite.token, nome: 'Isolamento', email, senha: SENHA_DE_TESTE });
    expect(aceite.status).toBe(201);

    await new Promise(r => setTimeout(r, 400));

    expect(recebidoPorA).toHaveLength(1);
    expect(recebidoPorB).toHaveLength(0);
  });
});
