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
  compatibilityDate: '2025-07-15',

  ssr: true,

  devtools: { enabled: false },

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
    '~/assets/css/base.css',
  ],

  runtimeConfig: {
    // Privado — só o servidor Nuxt lê. É como o SSR alcança a API dentro da
    // rede do compose. Sobrescrito por NUXT_API_BASE_INTERNA.
    apiBaseInterna: 'http://localhost:3000',
    public: {
      // Público — vai para o HTML. É como o NAVEGADOR alcança a API, e também
      // a origem do socket. Sobrescrito por NUXT_PUBLIC_API_BASE.
      apiBase: 'http://localhost:3000',
    },
  },

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

  typescript: {
    strict: true,
    // O typecheck roda pelo gate, com `nuxt typecheck` — não a cada build.
    typeCheck: false,
  },

  // O contrato é TypeScript vindo de um workspace: o Nitro precisa transpilá-lo
  // em vez de tentar carregá-lo como JavaScript já compilado.
  build: {
    transpile: ['@orcamento/contrato'],
  },

  nitro: {
    compatibilityDate: '2025-07-15',
  },
});
