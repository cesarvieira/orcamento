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

COPY package.json package-lock.json ./
COPY api/package.json api/
COPY web/package.json web/
COPY packages/contrato/package.json packages/contrato/

# `nuxt prepare` do postinstall precisa do fonte do web; ainda não copiamos.
RUN npm ci --ignore-scripts

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

RUN npm run -w web build

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
