# syntax=docker/dockerfile:1
# =============================================================================
# Imagem de produção do front.
#
# ⚠️ O artefato do Nuxt em SSR é um SERVIDOR NODE (.output/server/index.mjs),
# não HTML estático (D-01). Não troque isto por um nginx servindo `dist/`: o
# render de servidor é o que faz a sessão em cookie httpOnly funcionar.
#
# O contexto de build é a RAIZ do monorepo: o front importa
# `@orcamento/contrato`, que é outro workspace.
# =============================================================================
FROM node:22-alpine AS dependencias
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.10.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# O workspace declara `patchedDependencies`; sem o diretorio o pnpm falha
# com ENOENT antes mesmo de resolver as dependencias.
COPY patches/ patches/
COPY api/package.json api/
COPY web/package.json web/
COPY packages/contrato/package.json packages/contrato/

# `nuxt prepare` do postinstall precisa do fonte do web; ainda não copiamos.
RUN pnpm install --frozen-lockfile --ignore-scripts

# -----------------------------------------------------------------------------
FROM dependencias AS build
WORKDIR /app

ARG API_BASE_PUBLICA=http://localhost:3000
ENV NUXT_PUBLIC_API_BASE=$API_BASE_PUBLICA

# O release é o SHA do commit (D-09), conhecido no momento do build — não é
# segredo, então ARG/ENV normal, igual a API_BASE_PUBLICA acima. Aqui ele
# serve DOIS propósitos: vira o default do runtimeConfig que o `nuxt build`
# grava no bundle (nuxt.config.ts:85, o navegador lê dali), e é o nome que o
# `sentry-vite-plugin` associa ao source map que sobe (quando há token). O
# mesmo `ARG`/`ENV` volta a ser declarado no stage `producao`, abaixo — sem
# isso o SSR, que lê `process.env` cru no container final, receberia sempre
# vazio (ver o comentário de lá).
ARG SENTRY_RELEASE=
ENV NUXT_PUBLIC_SENTRY_RELEASE=$SENTRY_RELEASE

COPY tsconfig.base.json ./
# O contrato é GERADO e versionado: entra pronto na imagem. Regenerá-lo aqui
# exigiria o fonte da API dentro do build do front — acoplamento sem ganho.
COPY packages/contrato packages/contrato
COPY web/ web/

# ⛔ SENTRY_AUTH_TOKEN NÃO é ARG. Um ARG fica gravado no histórico de camada
# da imagem, e a imagem é artefato distribuído — pior que arquivo versionado
# (D-09, D-07). O secret mount só existe DENTRO deste RUN: nunca vira camada,
# nunca vira ENV da imagem final. `nuxt.config.ts` continua lendo
# `process.env.SENTRY_AUTH_TOKEN` sem mudança nenhuma — sem token no mount, a
# variável simplesmente chega vazia e o build segue sem mapa e sem upload.
RUN --mount=type=secret,id=sentry_auth_token \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)" \
    pnpm --filter @orcamento/web run build

# -----------------------------------------------------------------------------
FROM node:22-alpine AS producao
WORKDIR /app

ENV NODE_ENV=production
ENV NITRO_PORT=3001
ENV NITRO_HOST=0.0.0.0

# `ARG` não atravessa `FROM`: este é um stage NOVO, sem nenhuma variável do
# stage `build` — nem `NUXT_PUBLIC_SENTRY_RELEASE`, nem `NUXT_PUBLIC_API_BASE`
# (esta sobrevive porque o Nuxt já a compilou dentro do bundle do cliente; o
# release, não — `sentry.server.config.ts` lê `process.env` CRU no processo
# que roda AQUI, no container final, então precisa da variável de novo, neste
# stage). Redeclarar o `ARG` é obrigatório por regra do Docker: um `ARG`
# declarado antes de um `FROM` só sobrevive àquele `FROM` se for redeclarado
# depois dele — não basta ele já existir lá em cima.
ARG SENTRY_RELEASE=
ENV NUXT_PUBLIC_SENTRY_RELEASE=$SENTRY_RELEASE

# O `.output` do Nitro é autocontido: traz as próprias dependências.
COPY --from=build /app/web/.output ./

EXPOSE 3001

# `--import` do config do Sentry ANTES do servidor, e é regra, não estilo: o SDK
# instrumenta `http`, `fetch` e o Nitro por dentro, e não alcança o que já foi
# carregado antes dele. Sem esta flag a observabilidade do SSR "funciona" —
# sem requisição, sem trace, e sem o erro que a gente foi lá procurar.
#
# O arquivo é gerado pelo módulo em todo build, e é inerte com DSN vazio: a
# flag não cria dependência de o Sentry estar configurado. Ver D-08.
CMD ["node", "--import", "./server/sentry.server.config.mjs", "server/index.mjs"]
