/**
 * OBSERVABILIDADE — a instrumentação do processo (D-08).
 *
 * ⚠️ `iniciarObservabilidade()` tem de rodar ANTES de qualquer outro import do
 * processo. O SDK instrumenta Express, `pg` e `http` por dentro, trocando os
 * módulos por versões instrumentadas: o que já foi carregado antes dele não é
 * alcançado, e o sintoma é o pior possível — o Sentry "funciona", só que sem
 * requisição, sem query e sem trace. Por isso `index.ts` abre com
 * `import './instrumentacao'` na PRIMEIRA linha.
 *
 * `SENTRY_DSN` vazio é o default e é um estado válido: nada é inicializado e
 * nada sai da máquina. É o que mantém a suíte offline e o gate de navegação
 * com zero erro de rede.
 *
 * Por isso este módulo se inicializa AO SER IMPORTADO (última linha do
 * arquivo), e não numa chamada no corpo de `index.ts`: em CommonJS, o corpo de
 * `index.ts` só roda depois de TODOS os `require` dele — inclusive o do `app`,
 * que já teria carregado o Express. Importar é o único gancho que roda cedo o
 * bastante. É também o padrão que a própria documentação do SDK usa.
 */
import * as Sentry from '@sentry/node';
import type { ErrorEvent, Event } from '@sentry/node';
import type { Express } from 'express';

import { ambiente } from './config/ambiente';

/**
 * Só vira `true` depois de um `Sentry.init` de verdade. Sem isto, um processo
 * que nunca chamou `iniciarObservabilidade()` — a suíte de testes, que importa
 * `criarApp` direto — instalaria um middleware de captura sobre um SDK que não
 * existe.
 */
let ligado = false;

export function sentryLigado(): boolean {
  return ligado;
}

/**
 * Nomes de campo cujo VALOR nunca pode sair desta máquina.
 *
 * Isto não é polimento: um evento de erro carrega, por padrão, o corpo da
 * requisição e os cabeçalhos. Sem esta limpeza, o primeiro 500 numa rota de
 * login manda a senha de alguém — e o primeiro 500 em rota autenticada manda
 * o cookie de sessão, que é a sessão inteira. A regra inviolável #1 do produto
 * (dado de família não vaza) não abre exceção para ferramenta de diagnóstico.
 */
const CHAVE_SENSIVEL = /senha|password|secret|segredo|token|authorization|cookie|api[-_]?key/i;

const OCULTO = '[removido]';

/** Fundo do poço da recursão. Evento aninhado mais fundo que isto não existe na prática. */
const PROFUNDIDADE_MAXIMA = 6;

/**
 * Substitui pelo marcador o valor de toda chave sensível, em qualquer
 * profundidade. Não remove a CHAVE: saber que havia um cookie ali ajuda a
 * depurar; saber qual era não ajuda em nada.
 *
 * Exportada porque é o coração da promessa da D-08, e promessa se prova —
 * `testes/sentry.teste.ts` a exercita diretamente.
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

/**
 * Uma query string com `token=...` some por inteiro. Aqui não dá para redigir
 * campo a campo com confiança — a string pode nem estar bem-formada — e o
 * valor de diagnóstico dela é baixo perto do risco.
 */
function redigirQueryString(query: unknown): unknown {
  if (typeof query !== 'string') return redigir(query);
  return CHAVE_SENSIVEL.test(query) ? OCULTO : query;
}

/**
 * A limpeza aplicada a TODO evento antes do envio — erro e transação.
 *
 * Mexe só nos lugares que carregam dado de quem usa. Em particular NÃO passa
 * pelo `exception`/`stacktrace`: é lá que mora o valor do evento, e redigir
 * por regex ali já transformou stack trace em charada em outros projetos.
 */
export function limparEvento<T extends Event>(evento: T): T {
  if (evento.request) {
    const requisicao = evento.request;
    if (requisicao.headers) requisicao.headers = redigir(requisicao.headers) as typeof requisicao.headers;
    if (requisicao.cookies) requisicao.cookies = redigir(requisicao.cookies) as typeof requisicao.cookies;
    if (requisicao.data !== undefined) requisicao.data = redigir(requisicao.data);
    if (requisicao.query_string !== undefined) {
      requisicao.query_string = redigirQueryString(requisicao.query_string) as typeof requisicao.query_string;
    }
  }

  if (evento.extra) evento.extra = redigir(evento.extra) as typeof evento.extra;
  if (evento.contexts) evento.contexts = redigir(evento.contexts) as typeof evento.contexts;

  if (evento.breadcrumbs) {
    evento.breadcrumbs = evento.breadcrumbs.map(migalha =>
      migalha.data ? { ...migalha, data: redigir(migalha.data) as typeof migalha.data } : migalha,
    );
  }

  return evento;
}

/** O ambiente como a instância do Sentry o enxerga. Vazio herda o `NODE_ENV`. */
export function ambienteDoSentry(): string {
  return ambiente.SENTRY_AMBIENTE || ambiente.NODE_ENV;
}

/**
 * Inicializa o SDK. Devolve `true` se ligou de fato — `false` quando o DSN
 * está vazio, que NÃO é erro: é o modo inerte.
 */
export function iniciarObservabilidade(): boolean {
  if (ligado) return true;
  if (!ambiente.SENTRY_DSN) return false;

  Sentry.init({
    dsn: ambiente.SENTRY_DSN,
    environment: ambienteDoSentry(),
    ...(ambiente.SENTRY_RELEASE ? { release: ambiente.SENTRY_RELEASE } : {}),
    tracesSampleRate: ambiente.SENTRY_TRACES_SAMPLE_RATE,
    // O default do SDK é mandar IP e cabeçalho de identificação junto. Aqui,
    // não: o que se quer saber é O QUE quebrou, não quem estava logado.
    sendDefaultPii: false,
    beforeSend: (evento: ErrorEvent) => limparEvento(evento),
    beforeSendTransaction: evento => limparEvento(evento),
  });

  ligado = true;
  return true;
}

/**
 * O middleware que manda para o Sentry o erro que ninguém tratou.
 *
 * Vai DEPOIS das rotas e do 404 e ANTES do `tratarErro` — que continua sendo
 * quem responde ao cliente, sempre na forma `Erro` do contrato. O Sentry
 * observa e repassa; ele não decide o que a pessoa vê.
 */
export function instalarCapturaDeErro(app: Express): void {
  if (!ligado) return;
  Sentry.setupExpressErrorHandler(app);
}

/**
 * Manda um evento e ESPERA a confirmação de entrega.
 *
 * É a diferença entre "o SDK aceitou" e "chegou lá". Todo processo curto —
 * a CLI de teste, um job — precisa disto: sem o flush, o processo termina
 * antes de o envelope sair, e o evento simplesmente não existe.
 */
export async function descarregar(msDeEspera = 5000): Promise<boolean> {
  if (!ligado) return false;
  return Sentry.flush(msDeEspera);
}

export { Sentry };

// O gancho. Vale para todo processo que importe este módulo — a API, a CLI de
// teste, e a suíte (onde o DSN é vazio e isto não faz absolutamente nada).
iniciarObservabilidade();
