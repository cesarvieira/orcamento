/**
 * O SERVICE WORKER — arquivo estático, sem build (D-10, `docs/decisoes/D-10-pwa-instalavel.md`).
 *
 * Ele não existe para dar offline: existe porque, sem ele, o Chrome não
 * considera o app instalável — `beforeinstallprompt` não dispara sem service
 * worker registrado e sem uma resposta offline válida. A pergunta que rege
 * este arquivo não é "quanto dá para cachear?", é "qual é o MENOR cache que
 * ainda satisfaz a checagem?".
 *
 * A REGRA DE CACHE É LISTA DE PERMISSÃO, nunca de bloqueio — e a razão é de
 * segurança, não de estilo. Toda tela deste produto é área logada e o HTML já
 * sai do servidor COM o saldo dentro (SSR, D-01): um service worker que
 * respondesse HTML do cache serviria a última tela logada antes de qualquer
 * verificação de sessão, no aparelho onde outra pessoa da casa abre o app
 * depois. É a regra inviolável #1 (`.preator/CONTEXT.md`) reaberta do lado do
 * cliente. Por isso: o que NÃO casar com a lista de permissão abaixo vai
 * direto para a rede — nunca para o cache.
 *
 * Mudar a LISTA de arquivos pré-carregados é barato (o `activate` limpa a
 * versão anterior). Mudar a ESTRATÉGIA é alteração de segurança: acrescentar
 * um padrão à lista de permissão reabre a regra inviolável #1 para revisão.
 */

/**
 * A versão do cache. Mudar esta constante é o único jeito de invalidar tudo —
 * o `activate` apaga qualquer cache cujo nome não seja este.
 *
 * `v1` → `v2`: a arte do ícone foi trocada (pacote `appstore-images` novo,
 * D-10 §6). Os ARQUIVOS da `PRE_CARGA` continuam com os mesmos nomes, e é
 * exatamente por isso que a versão precisou subir: `install` só popula o
 * cache com este nome, e `activate` só apaga cache com nome DIFERENTE — quem
 * já tinha o app instalado continuaria servindo os bytes da arte velha para
 * sempre, sem nunca reparar que o arquivo mudou no servidor.
 */
const VERSAO_CACHE = 'orcamento-pwa-v2';

/** O mínimo que o `install` pré-carrega: a resposta offline e os ícones do manifesto. */
const PRE_CARGA = [
  '/offline.html',
  '/icones/icone-192.png',
  '/icones/icone-512.png',
  '/icones/icone-maskable-512.png',
  '/icones/apple-touch-icon.png',
  '/icones/favicon-96.png',
  '/icones/favicon-48.png',
  '/icones/favicon-32.png',
  '/icones/favicon-16.png',
];

async function prepararCache() {
  const cache = await caches.open(VERSAO_CACHE);
  await cache.addAll(PRE_CARGA);
  self.skipWaiting();
}

self.addEventListener('install', (evento) => {
  evento.waitUntil(prepararCache());
});

async function limparCachesAntigos() {
  const nomes = await caches.keys();
  await Promise.all(
    nomes.filter(nome => nome !== VERSAO_CACHE).map(nome => caches.delete(nome)),
  );
  self.clients.claim();
}

self.addEventListener('activate', (evento) => {
  evento.waitUntil(limparCachesAntigos());
});

/**
 * Asset ESTÁTICO E VERSIONADO — a única categoria que este service worker
 * cacheia. O que autoriza cachear é o NOME: o Vite grava o hash do conteúdo
 * no nome de `/_nuxt/*`, então um arquivo com esse nome que está no cache é,
 * por construção, byte a byte o que a rede devolveria — não há versão velha a
 * servir por engano, e não há dado de família dentro. Ícone e fonte entram
 * pela mesma razão: são arquivo estático versionado por conteúdo, não tela.
 */
function ehAssetVersionado(url) {
  return url.pathname.startsWith('/_nuxt/') ||
    url.pathname.startsWith('/icones/') ||
    url.pathname.endsWith('.woff2');
}

/**
 * Navegação — SEMPRE rede. Nunca guarda a resposta: é aqui que a última tela
 * logada seria servida sem verificação de sessão, se este caminho não
 * existisse. Só cai no cache quando a rede falha de verdade, e só para
 * devolver a `/offline.html` sem dado nenhum.
 */
async function responderNavegacao(requisicao) {
  try {
    return await fetch(requisicao);
  } catch {
    const doCache = await caches.match('/offline.html');
    if (doCache) return doCache;

    // SEGUNDA LINHA DE DEFESA — não é o caminho normal. `/offline.html` está
    // no `PRE_CARGA` do `install`, e `cache.addAll` é atômico: se o install
    // terminou (só depois dele o `skipWaiting()` roda), a página está no
    // cache. Isto existe para uma EVICÇÃO PARCIAL do Cache Storage depois
    // disso — o navegador pode liberar espaço e derrubar só essa entrada.
    // Sem isto, `caches.match` resolveria `undefined`, `respondWith`
    // receberia isso, e a navegação morreria com erro de rede exatamente no
    // caso que esta página existe para cobrir. Não remova por achar
    // redundante com o cache: os dois cobrem falhas diferentes.
    return new Response('Sem conexão.', {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

/** Asset versionado — cache-first, gravando no cache o que a rede devolver. */
async function responderAssetVersionado(requisicao) {
  const doCache = await caches.match(requisicao);
  if (doCache) return doCache;

  const daRede = await fetch(requisicao);

  // Só grava resposta BOA no cache. `daRede.ok` (2xx) exclui também os casos
  // de `type` que interessam aqui: uma resposta `opaque`/`opaqueredirect`
  // (cross-origin sem CORS) já chega com `ok: false` por definição, então
  // esta única checagem também cobre esse caso sem precisar olhar `type` à
  // parte. Cachear um 404/5xx sobreviveria ao problema que o causou: até a
  // próxima troca de `VERSAO_CACHE`, esse erro seria servido como se fosse
  // o asset — pior que não cachear, porque não se autocorrige sozinho.
  if (daRede.ok) {
    const cache = await caches.open(VERSAO_CACHE);
    await cache.put(requisicao, daRede.clone());
  }
  return daRede;
}

self.addEventListener('fetch', (evento) => {
  const requisicao = evento.request;
  const url = new URL(requisicao.url);

  // Não-GET, ou origem diferente (a API vive em outra origem, D-01) — não
  // intercepta. Sem `respondWith`, o navegador segue o caminho normal dele.
  if (requisicao.method !== 'GET' || url.origin !== self.location.origin) return;

  if (requisicao.mode === 'navigate') {
    evento.respondWith(responderNavegacao(requisicao));
    return;
  }

  if (ehAssetVersionado(url)) {
    evento.respondWith(responderAssetVersionado(requisicao));
    return;
  }

  // Qualquer outra coisa — `/api/*`, o socket (`/realtime`), e o que mais
  // existir — deixa passar. Sem `respondWith`, vai para a rede normalmente.
});
