/**
 * O TERCEIRO ESTADO da sessão: "não deu para perguntar".
 *
 * Este arquivo existe por causa de um defeito real: `carregar()` engolia
 * qualquer falha num `catch` e devolvia `null`, então uma API inalcançável
 * (porta errada, contêiner fora do ar) chegava ao middleware indistinguível
 * de um logout. O sintoma era um F5 que não sobrevivia à sessão — SSR não
 * alcançava a API e redirecionava para `/entrar`; o cliente alcançava e
 * redirecionava para `/` — e nada nele apontava para a causa.
 *
 * O que se prova aqui é a distinção: 401 é RESPOSTA, o resto é SILÊNCIO.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiInalcancavel, useSessao } from './useSessao';

const BASE_FALSA = 'http://localhost:3000';

/** O erro que o `$fetch` levanta num HTTP com status — mesma forma do ofetch. */
function erroHttp(status: number) {
  return Object.assign(new Error(`HTTP ${status}`), { statusCode: status, status });
}

/** O erro de quem nem chegou a falar com o servidor. Não tem status nenhum. */
function erroDeRede() {
  return Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
}

let vezesQueLeuABase = 0;

/** Instala os auto-imports que o composable usa, com o `$fetch` sob controle. */
function comApi(resposta: () => unknown) {
  vezesQueLeuABase = 0;
  Object.assign(globalThis, {
    useApi: () => vi.fn(async () => resposta()),
    useApiBase: () => {
      vezesQueLeuABase += 1;
      return BASE_FALSA;
    },
  });
}

beforeEach(() => {
  // Os auto-imports precisam existir ANTES de qualquer `useSessao()` — o
  // composable resolve `useApi()` já na primeira linha.
  comApi(() => {
    throw erroHttp(401);
  });
  // `useState` do shim é module-level: sem isto, o estado vaza entre testes.
  useSessao().sessao.value = null;
});

describe('carregar() — os três estados da sessão', () => {
  it('a API respondendo devolve a sessão', async () => {
    const sessaoDaApi = {
      membroId: 'm1',
      membroNome: 'Ana',
      membroEmail: 'ana@exemplo.test',
      familiaId: 'f1',
      familiaNome: 'Silva',
    };
    comApi(() => sessaoDaApi);

    const { carregar, sessao } = useSessao();

    await expect(carregar()).resolves.toEqual(sessaoDaApi);
    expect(sessao.value).toEqual(sessaoDaApi);
  });

  it('401 é RESPOSTA: não há sessão, e `null` é a verdade', async () => {
    comApi(() => {
      throw erroHttp(401);
    });

    const { carregar, sessao } = useSessao();

    await expect(carregar()).resolves.toBeNull();
    expect(sessao.value).toBeNull();
  });

  it('API fora do ar NÃO vira logout — estoura, e o erro diz o endereço', async () => {
    comApi(() => {
      throw erroDeRede();
    });

    const { carregar } = useSessao();

    await expect(carregar()).rejects.toThrow(ApiInalcancavel);
    // O endereço no texto é o que resolve o caso em dez segundos em vez de
    // meia hora: foi a divergência entre a porta da API e a que o SSR chama
    // que produziu o defeito original.
    await expect(carregar()).rejects.toThrow(BASE_FALSA);
  });

  it('lê a base da API no SETUP, não depois do await', () => {
    comApi(() => {
      throw erroDeRede();
    });

    useSessao();

    // Regressão medida no artefato de produção: `useApiBase()` chamado dentro
    // do `catch` — depois do primeiro `await` — levanta "Nuxt instance
    // unavailable" e SUBSTITUI o erro real, deixando a tela num 500 genérico
    // e o diagnóstico em lugar nenhum. Todo composable do Nuxt tem de ser
    // resolvido enquanto o contexto existe.
    expect(vezesQueLeuABase).toBe(1);
  });

  it('500 também é silêncio, não logout — o servidor não disse nada sobre sessão', async () => {
    comApi(() => {
      throw erroHttp(500);
    });

    await expect(useSessao().carregar()).rejects.toThrow(ApiInalcancavel);
  });

  it('falhando, NÃO descarta a sessão que já se tinha', async () => {
    // O `$fetch` é resolvido na PRIMEIRA linha de `useSessao()`, então a falha
    // se instala antes de pegar o composable — trocá-la depois não alcançaria
    // o `api` que o `carregar()` já fechou.
    comApi(() => {
      throw erroDeRede();
    });

    const { carregar, sessao } = useSessao();
    sessao.value = {
      membroId: 'm1',
      membroNome: 'Ana',
      membroEmail: 'ana@exemplo.test',
      familiaId: 'f1',
      familiaNome: 'Silva',
    };

    await expect(carregar()).rejects.toThrow(ApiInalcancavel);
    // Sem saber se a sessão existe, jogar fora a que se tinha é a pior das
    // opções: derrubaria quem está logado por causa de um blip de rede.
    expect(sessao.value).not.toBeNull();
  });
});
