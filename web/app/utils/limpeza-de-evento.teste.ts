/**
 * A promessa da D-08 do lado do front: nada sensível sai no evento.
 *
 * Espelha `api/testes/sentry.teste.ts` de propósito — as duas limpezas são
 * irmãs e precisam mover-se juntas. Um dos lados afrouxando sozinho é o
 * vazamento que ninguém procura.
 */
import { describe, expect, it } from 'vitest';

import { limparEvento, redigir } from './limpeza-de-evento';

/** Montado em partes: o scanner de segredos do pre-commit bloqueia literal com cara de credencial. */
const SEGREDO_DE_MENTIRA = ['nao', 'pode', 'sair'].join('-');

describe('limpeza do evento do Sentry (D-08)', () => {
  it('apaga o cookie de sessão que o SSR carrega, e preserva o resto', () => {
    const evento = limparEvento({
      request: {
        headers: {
          cookie: 'orcamento_sessao=uma-sessao-inteira',
          authorization: 'Bearer algo',
          'accept-language': 'pt-BR',
        },
      },
    });

    expect(evento.request?.headers?.cookie).toBe('[removido]');
    expect(evento.request?.headers?.authorization).toBe('[removido]');
    expect(evento.request?.headers?.['accept-language']).toBe('pt-BR');
  });

  it('alcança campo sensível aninhado', () => {
    const limpo = redigir({ corpo: { senha: SEGREDO_DE_MENTIRA, email: 'ana@exemplo.test' } }) as {
      corpo: { senha: string; email: string };
    };

    expect(limpo.corpo.senha).toBe('[removido]');
    expect(limpo.corpo.email).toBe('ana@exemplo.test');
  });

  it('apaga a query string inteira quando ela carrega um token', () => {
    const evento = limparEvento({ request: { query_string: 'token=um-convite&pagina=2' } });

    expect(evento.request?.query_string).toBe('[removido]');
  });

  it('deixa em paz o que não é sensível', () => {
    const evento = limparEvento({ request: { query_string: 'pagina=2' } });

    expect(evento.request?.query_string).toBe('pagina=2');
  });
});
