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

COPY tsconfig.base.json ./
# O contrato é GERADO e versionado: entra pronto na imagem. Regenerá-lo aqui
# exigiria o fonte da API dentro do build do front — acoplamento sem ganho.
COPY packages/contrato packages/contrato
COPY web/ web/

RUN pnpm --filter @orcamento/web run build

# -----------------------------------------------------------------------------
FROM node:22-alpine AS producao
WORKDIR /app

ENV NODE_ENV=production
ENV NITRO_PORT=3001
ENV NITRO_HOST=0.0.0.0

# O `.output` do Nitro é autocontido: traz as próprias dependências.
COPY --from=build /app/web/.output ./

EXPOSE 3001

CMD ["node", "server/index.mjs"]
