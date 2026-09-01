/**
 * LIMPEZA DO EVENTO — o que nunca sai desta máquina rumo ao Sentry (D-08).
 *
 * Funções puras, sem estado, como as demais deste diretório.
 *
 * ⚠️ Esta é a IRMÃ de `api/src/instrumentacao.ts`. As duas existem porque o
 * front e a API são processos diferentes com SDKs diferentes, e as duas
 * precisam mover-se JUNTAS: relaxar a regra de um lado e não do outro
 * cria um vazamento que ninguém procura, porque "isso já está tratado".
 *
 * Onde ela morde de verdade é no SSR: é lá que o evento carrega o cabeçalho da
 * requisição que chegou ao Nuxt — o cookie de sessão inteiro, incluído. No
 * navegador o SDK já manda bem menos, mas o custo de aplicar nos dois é zero.
 */

/** Nomes de campo cujo VALOR nunca sai daqui. Mesma lista da API, de propósito. */
const CHAVE_SENSIVEL = /senha|password|secret|segredo|token|authorization|cookie|api[-_]?key/i;

const OCULTO = '[removido]';

/** Fundo do poço da recursão. */
const PROFUNDIDADE_MAXIMA = 6;

/**
 * Substitui pelo marcador o valor de toda chave sensível, em qualquer
 * profundidade. Não remove a chave: saber que havia um cookie ali ajuda a
 * depurar; saber qual era não ajuda em nada.
 */
export function redigir(valor: unknown, profundidade = 0): unknown {
  if (profundidade > PROFUNDIDADE_MAXIMA || valor === null || typeof valor !== 'object') {
    return valor;
  }

  if (Array.isArray(valor)) {
    return valor.map(item => redigir(item, profundidade + 1));
  }

  const saida: Record<string, unknown> = {};
  for (const [chave, conteudo] of Object.entries(valor as Record<string, unknown>)) {
    saida[chave] = CHAVE_SENSIVEL.test(chave) ? OCULTO : redigir(conteudo, profundidade + 1);
  }
  return saida;
}

/** A forma mínima de evento que esta limpeza conhece — o resto ela não toca. */
interface EventoLimpavel {
  request?: {
    headers?: Record<string, unknown>;
    cookies?: unknown;
    data?: unknown;
    query_string?: unknown;
  };
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
}

/**
 * A limpeza aplicada a todo evento antes do envio.
 *
 * NÃO passa pelo `exception`/`stacktrace`: é lá que mora o valor do evento, e
 * redigir por regex ali transforma stack trace em charada.
 */
export function limparEvento<T extends EventoLimpavel>(evento: T): T {
  const requisicao = evento.request;
  if (requisicao) {
    if (requisicao.headers) {
      requisicao.headers = redigir(requisicao.headers) as Record<string, unknown>;
    }
    if (requisicao.cookies) requisicao.cookies = redigir(requisicao.cookies);
    if (requisicao.data !== undefined) requisicao.data = redigir(requisicao.data);
    if (typeof requisicao.query_string === 'string') {
      requisicao.query_string = CHAVE_SENSIVEL.test(requisicao.query_string)
        ? OCULTO
        : requisicao.query_string;
    }
  }

  if (evento.extra) evento.extra = redigir(evento.extra) as Record<string, unknown>;
  if (evento.contexts) evento.contexts = redigir(evento.contexts) as Record<string, unknown>;

  return evento;
}
