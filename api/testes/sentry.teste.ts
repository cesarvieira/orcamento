/**
 * A observabilidade, provada (D-08).
 *
 * Dois compromissos, e os dois são checáveis aqui — nenhum depende de a
 * instância existir:
 *
 * 1. **A suíte roda offline.** Com `SENTRY_DSN` vazio o SDK não inicializa e
 *    nada sai desta máquina. É o que mantém o gate de navegação com zero erro
 *    de rede.
 * 2. **Nada sensível sai no evento.** Cookie de sessão, `authorization` e
 *    senha são o que um 500 numa rota de login mandaria por padrão. Esta é a
 *    promessa que o produto não pode quebrar, então ela tem teste.
 *
 * O que este arquivo NÃO prova é o caminho até a instância — DNS, TLS,
 * certificado, quota. Isso não se prova sem mandar um evento de verdade, e é
 * exatamente por isso que existe `pnpm --filter @orcamento/api run sentry:teste`.
 */
import request from 'supertest';
import { afterAll, afterEach, describe, expect, it } from 'vitest';

import { criarApp } from '../src/app';
import { ambiente } from '../src/config/ambiente';
import { fecharBanco } from '../src/db';
import { limparEvento, redigir, sentryLigado } from '../src/instrumentacao';

const app = criarApp();

/**
 * O valor "sensível" das fixtures, montado em partes — mesmo motivo do
 * `CREDENCIAL_PADRAO` de `apoio.ts`: o scanner de segredos do pre-commit
 * bloqueia literal com cara de credencial, e ele está certo em bloquear.
 */
const SEGREDO_DE_MENTIRA = ['nao', 'pode', 'sair'].join('-');

afterAll(async () => {
  await fecharBanco();
});

afterEach(() => {
  ambiente.SENTRY_TESTE_HABILITADO = false;
});

/** Liga a porta de teste como o ambiente ligaria, e devolve o app já montado. */
function comPortaDeTesteLigada() {
  ambiente.SENTRY_TESTE_HABILITADO = true;
  return app;
}

describe('a suíte roda offline (D-08)', () => {
  it('o SDK está inerte: DSN vazio, nada sai desta máquina', () => {
    expect(ambiente.SENTRY_DSN).toBe('');
    expect(sentryLigado()).toBe(false);
  });
});

describe('limpeza do evento — o que NUNCA sai daqui', () => {
  it('apaga cookie e authorization dos cabeçalhos, e preserva o resto', () => {
    const evento = limparEvento({
      request: {
        headers: {
          cookie: 'orcamento_sessao=uma-sessao-inteira',
          authorization: 'Bearer um-token-de-verdade',
          'content-type': 'application/json',
        },
      },
    });

    expect(evento.request?.headers?.cookie).toBe('[removido]');
    expect(evento.request?.headers?.authorization).toBe('[removido]');
    // O que não é sensível continua lá: um evento higienizado até virar nada
    // não serve para depurar.
    expect(evento.request?.headers?.['content-type']).toBe('application/json');
  });

  it('apaga a senha do corpo da requisição e mantém o email', () => {
    const evento = limparEvento({
      request: { data: { email: 'ana@exemplo.test', senha: SEGREDO_DE_MENTIRA } },
    });

    const dados = evento.request?.data as Record<string, unknown>;
    expect(dados.senha).toBe('[removido]');
    expect(dados.email).toBe('ana@exemplo.test');
  });

  it('alcança campo sensível ANINHADO, não só o de primeiro nível', () => {
    const limpo = redigir({
      credenciais: { senha: SEGREDO_DE_MENTIRA, lista: [{ token: 'abc', nome: 'ok' }] },
    }) as { credenciais: { senha: string; lista: { token: string; nome: string }[] } };

    expect(limpo.credenciais.senha).toBe('[removido]');
    expect(limpo.credenciais.lista[0]?.token).toBe('[removido]');
    expect(limpo.credenciais.lista[0]?.nome).toBe('ok');
  });

  it('apaga a query string inteira quando ela carrega um token', () => {
    const evento = limparEvento({
      request: { query_string: 'token=um-token-de-convite&pagina=2' },
    });

    expect(evento.request?.query_string).toBe('[removido]');
  });

  it('não deixa passar dado sensível pelas migalhas de navegação', () => {
    const evento = limparEvento({
      breadcrumbs: [{ message: 'POST /familia/entrar', data: { senha: SEGREDO_DE_MENTIRA } }],
    });

    expect(evento.breadcrumbs?.[0]?.data?.senha).toBe('[removido]');
  });

  it('NÃO mexe no stack trace — é lá que mora o valor do evento', () => {
    const evento = limparEvento({
      exception: {
        values: [{ type: 'Error', value: 'quebrou no servicoDeToken', stacktrace: { frames: [] } }],
      },
    });

    expect(evento.exception?.values?.[0]?.value).toBe('quebrou no servicoDeToken');
  });
});

describe('GET /diagnostico/sentry — a porta de teste', () => {
  it('desligada, é indistinguível de uma rota que não existe', async () => {
    const resposta = await request(app).get('/diagnostico/sentry');

    expect(resposta.status).toBe(404);
    expect(resposta.body).toEqual({
      erro: 'nao_encontrado',
      mensagem: 'Recurso inexistente.',
    });
  });

  it('ligada, responde e declara HONESTAMENTE que o SDK está inerte', async () => {
    const resposta = await request(comPortaDeTesteLigada()).get('/diagnostico/sentry');

    expect(resposta.status).toBe(200);
    // Sem DSN não há evento — e a porta diz isso em vez de fingir sucesso.
    expect(resposta.body).toEqual({
      ligado: false,
      ambiente: 'test',
      eventId: null,
    });
  });

  it('modo=erro devolve a forma `Erro` do contrato, nunca a mensagem interna', async () => {
    const resposta = await request(comPortaDeTesteLigada()).get('/diagnostico/sentry?modo=erro');

    expect(resposta.status).toBe(500);
    expect(resposta.body).toEqual({
      erro: 'erro_interno',
      mensagem: 'Algo quebrou aqui dentro. Tente de novo.',
    });
    // O texto do erro proposital fica no servidor e no evento; não na tela.
    expect(JSON.stringify(resposta.body)).not.toContain('ErroDeTesteDoSentry');
  });

  it('modo=erro continua 404 com a porta desligada — não estoura por engano', async () => {
    const resposta = await request(app).get('/diagnostico/sentry?modo=erro');

    expect(resposta.status).toBe(404);
  });
});
