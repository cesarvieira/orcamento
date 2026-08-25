# =============================================================================
# Imagem de produção da API. Serve tanto ao serviço `api` quanto ao one-shot
# `migrate` do compose — o que muda é o comando, não a imagem.
#
# O contexto de build é a RAIZ do monorepo, porque o workspace do pnpm precisa
# do pnpm-workspace.yaml e do package.json de cima para resolver as dependências.
# =============================================================================
FROM node:22-alpine AS dependencias
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.10.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json api/
COPY web/package.json web/
COPY packages/contrato/package.json packages/contrato/

# Instala o workspace inteiro (inclui devDependencies: o tsc do build precisa
# delas). A imagem final não leva esta camada.
# --ignore-scripts: o "prepare" da raiz religa git hooks (scripts/instalar-hooks.mjs)
# — não existe .git nem scripts/ neste contexto de build, só package.json.
RUN pnpm install --frozen-lockfile --ignore-scripts

# -----------------------------------------------------------------------------
FROM dependencias AS build
WORKDIR /app

COPY tsconfig.base.json ./
COPY api/ api/

RUN pnpm --filter @orcamento/api run build

# -----------------------------------------------------------------------------
FROM node:22-alpine AS producao
WORKDIR /app

ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@11.10.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json api/
COPY web/package.json web/
COPY packages/contrato/package.json packages/contrato/

RUN pnpm install --frozen-lockfile --ignore-scripts --prod --filter @orcamento/api...

COPY --from=build /app/api/dist api/dist
# O SQL das migrations vai JUNTO: o serviço `migrate` roda desta imagem, e uma
# imagem sem o SQL sobe, migra nada e deixa o banco vazio em silêncio.
COPY api/drizzle api/drizzle

WORKDIR /app/api

EXPOSE 3000

CMD ["node", "dist/index.js"]
