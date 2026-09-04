/**
 * REGISTRA O PWA — o service worker, e a escuta do botão Instalar (D-10,
 * `docs/decisoes/D-10-pwa-instalavel.md`, §5).
 *
 * Só no CLIENTE (sufixo `.client.ts`): não existe `navigator.serviceWorker`
 * nem `window` no servidor.
 *
 * Só FORA do dev (`import.meta.dev`): em `nuxt dev` o service worker disputa
 * com o HMR do Vite pelo cache de módulo e produz a classe de bug que
 * ninguém consegue reproduzir depois — sintoma no navegador, causa no
 * bundler. `import.meta.dev` (não `process.env.NODE_ENV`) porque a regra
 * `nuxt/prefer-import-meta` está ligada em `eslint.config.mjs`.
 */
export default defineNuxtPlugin(async () => {
  // O botão Instalar escuta desde já — `beforeinstallprompt` pode disparar
  // antes de qualquer tela montar (ver `composables/useInstalacaoPwa.ts`).
  // Isto NÃO depende do service worker estar registrado por este processo:
  // é independente de dev/produção, porque o próprio navegador só dispara o
  // evento quando JÁ considera o app instalável (o que, em dev, é raro —
  // mas não é este código que decide isso).
  iniciarEscutaDeInstalacao();

  if (import.meta.dev) return;

  if (!('serviceWorker' in navigator)) return;

  // Registro que falha NÃO pode virar `console.error`: o gate de navegação
  // reprova em erro de console, e um navegador sem suporte pleno a service
  // worker (ou uma rede que bloqueou `/sw.js`) não é defeito do produto — o
  // app continua funcionando, só sem a instalabilidade. O `catch` vazio é a
  // escolha certa aqui, não um descuido.
  try {
    await navigator.serviceWorker.register('/sw.js');
  } catch {
    // Intencionalmente vazio — ver o comentário acima.
  }
});
