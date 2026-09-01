/**
 * Nuxt em SSR — que é o padrão e é o que queremos (D-01).
 *
 * A sessão vive em cookie `httpOnly` justamente porque o render de servidor não
 * enxerga `localStorage`.
 *
 * ⛔ NÃO existe `web/server/`. O Nuxt oferece rotas de servidor próprias; usá-las
 * criaria um segundo backend ao lado do `api/` — o caminho paralelo que a
 * doutrina proíbe. A API é o `api/`.
 */
export default defineNuxtConfig({
  /**
   * Observabilidade (D-08). O módulo carrega `sentry.client.config.ts` e
   * `sentry.server.config.ts` da raiz de `web/` — e os dois só inicializam o
   * SDK quando há DSN. Sem DSN, o módulo entra no build e não faz nada:
   * nenhuma requisição sai, e o gate de navegação segue com zero erro de rede.
   *
   * ⛔ Isto NÃO cria `web/server/`. O módulo se pendura no Nitro que já existe
   * para o SSR; nenhuma rota de servidor nova nasce daqui.
   */
  modules: ['@sentry/nuxt/module'],
  ssr: true,

  /**
   * As ferramentas de dev do Nuxt (painel de rotas, componentes, payload do
   * SSR, timings). O próprio Nuxt só as carrega em `nuxt dev` — `nuxt build`
   * não as inclui no artefato —, então ligar aqui não vaza para produção nem
   * para o que o gate prova. `@nuxt/devtools` já vem com o Nuxt; não é
   * dependência nova.
   */
  devtools: { enabled: true },

  app: {
    head: {
      htmlAttrs: { lang: 'pt-BR' },
      title: 'Orçamento Familiar',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content: 'Orçamento familiar por envelope com lastro.',
        },
      ],
    },
  },

  // Manrope e os ícones do Tabler vêm do pacote, não de CDN. O gate de
  // navegação cobra ZERO erro de rede no artefato de deploy, e uma fonte que
  // depende de um host externo transforma um hiccup de DNS em gate vermelho.
  css: [
    '@fontsource/manrope/400.css',
    '@fontsource/manrope/500.css',
    '@fontsource/manrope/600.css',
    '@fontsource/manrope/700.css',
    '@fontsource/manrope/800.css',
    '@tabler/icons-webfont/dist/tabler-icons.min.css',
    '~/assets/scss/base.scss',
  ],

  runtimeConfig: {
    // Privado — só o servidor Nuxt lê. É como o SSR alcança a API dentro da
    // rede do compose. Sobrescrito por NUXT_API_BASE_INTERNA.
    apiBaseInterna: 'http://localhost:3000',
    public: {
      // Público — vai para o HTML. É como o NAVEGADOR alcança a API, e também
      // a origem do socket. Sobrescrito por NUXT_PUBLIC_API_BASE.
      apiBase: 'http://localhost:3000',
      // Público — o client id do Google Identity Services. Vazio por padrão:
      // sem segredo configurado neste ambiente, o botão "Entrar com Google"
      // fica inerte em vez de tentar carregar um script sem client id.
      // Sobrescrito por NUXT_PUBLIC_GOOGLE_CLIENT_ID.
      googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',

      // --- Observabilidade (D-08) ------------------------------------------
      // O DSN da instância SELF-HOSTED do Sentry. Vazio por padrão: o SDK não
      // inicializa e NADA sai da máquina. É público por construção — o do
      // navegador sai no HTML —, mas quem o tem escreve na sua instância.
      // Sobrescrito por NUXT_PUBLIC_SENTRY_DSN.
      sentryDsn: '',
      // Separa dev, prova e produção dentro da instância.
      sentryAmbiente: process.env.NODE_ENV ?? 'development',
      // 0 = só captura de erro, sem trace. O disco da instância é seu.
      sentryTracesSampleRate: 0,
      // Liga a tela `/mais/diagnostico`. `false` inclusive em produção: ela
      // quebra de propósito. Liga para diagnosticar, desliga depois.
      sentryTesteHabilitado: false,
    },
  },

  /**
   * O diretório de build. Existe como variável porque o GATE e o ambiente de
   * DEV não podem disputar o mesmo `.nuxt`.
   *
   * Medido: `nuxt build` APAGA o `.nuxt/manifest/meta/dev.json` e escreve um
   * manifesto de build no lugar. É o arquivo para onde o alias `#app-manifest`
   * aponta em desenvolvimento — então rodar o gate com o `pnpm dev` no ar
   * derrubava o front com "Failed to resolve import #app-manifest", e o
   * sintoma não dizia nada sobre a causa.
   *
   * O gate passa `NUXT_BUILD_DIR=.nuxt-gate` (ver `preator-perfil.sh`) e
   * compila num diretório só dele. Mesma razão das portas 3010/3011: o
   * ambiente de dev fica no ar o tempo todo e a prova não pode atropelá-lo.
   */
  buildDir: process.env.NUXT_BUILD_DIR || '.nuxt',

  // O contrato é TypeScript vindo de um workspace: o Nitro precisa transpilá-lo
  // em vez de tentar carregá-lo como JavaScript já compilado.
  build: {
    transpile: ['@orcamento/contrato'],
  },

  /**
   * Source map do cliente — e por que ele é OPT-IN.
   *
   * Sem source map, o stack trace do navegador chega minificado e quase
   * inútil. Com ele ligado sempre, todo artefato de produção passa a carregar
   * os `.map` — peso a mais e o código-fonte recuperável por quem adivinhar a
   * URL, mesmo sem Sentry nenhum na jogada.
   *
   * Então ele acompanha a intenção: existe `SENTRY_AUTH_TOKEN` no build? Emite
   * (`hidden`: gera o arquivo, sem o comentário que o aponta) e sobe para a
   * instância. Não existe? Build normal, sem mapa e sem upload — e nada quebra.
   *
   * ⚠️ O upload ainda depende do binário do `@sentry/cli`, que este monorepo
   * NÃO instala por padrão (ver `allowBuilds` em `pnpm-workspace.yaml`). São
   * as duas coisas juntas, e o playbook diz isso.
   */
  sourcemap: { client: process.env.SENTRY_AUTH_TOKEN ? 'hidden' : false },

  compatibilityDate: '2025-07-15',

  nitro: {
    compatibilityDate: '2025-07-15',
  },

  typescript: {
    strict: true,
    // O typecheck roda pelo gate, com `nuxt typecheck` — não a cada build.
    typeCheck: false,
  },

  sentry: {
    sourceMapsUploadOptions: {
      enabled: Boolean(process.env.SENTRY_AUTH_TOKEN),
      // A instância self-hosted. Sem isto o `sentry-cli` fala com o sentry.io.
      url: process.env.SENTRY_URL ?? '',
      org: process.env.SENTRY_ORG ?? '',
      project: process.env.SENTRY_PROJETO ?? '',
      authToken: process.env.SENTRY_AUTH_TOKEN ?? '',
    },
  },
});
