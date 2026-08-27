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

  compatibilityDate: '2025-07-15',

  nitro: {
    compatibilityDate: '2025-07-15',
  },

  typescript: {
    strict: true,
    // O typecheck roda pelo gate, com `nuxt typecheck` — não a cada build.
    typeCheck: false,
  },
});
