#!/usr/bin/env bash
# ============================================================================
# preator-perfil.sh — o CONTRATO entre este projeto e a fábrica.
#
# A fábrica não conhece Node, Drizzle ou Nuxt. Ela sabe que existe *um comando
# de build* e pergunta ao projeto qual é. Este arquivo é a resposta.
#
# Preenchido pela EF-00 (Plataforma). Antes dela estava comentado de propósito:
# o gate reportava PARCIAL com SKIPs bloqueantes, e esse era o veredito honesto
# enquanto não havia stack.
#
# ⛔ Credencial, token, senha e string de conexão NÃO entram aqui. O gate de
# navegação lê o usuário de teste de PREATOR_TEST_USER / PREATOR_TEST_PASS no
# AMBIENTE — e, se não achar, declara no veredito que não cobriu a área logada.
#
# ─────────────────────────────────────────────────────────────────────────────
# ANTES DE RODAR O GATE MESTRE: a stack precisa estar DE PÉ.
#
# Os gates `contrato` e `navegacao` consultam a API e o front RODANDO, e o gate
# `test` é de integração contra Postgres de verdade. O gate mestre não sobe
# nada sozinho (só `deploy-fresh` sobe, e ele é destrutivo e opcional):
#
#     docker compose up -d --build
#     bash preator/esteira/gates/prova-comportamento.sh .
#
# ─────────────────────────────────────────────────────────────────────────────

# ---------------------------------------------------------------------------
# ONDE ESTE PROJETO GUARDA SEU OVERLAY
# ---------------------------------------------------------------------------
OVERLAY=".preator"

# ---------------------------------------------------------------------------
# BUILD  —  compila a API e GERA O CONTRATO.
# ---------------------------------------------------------------------------
# A geração do contrato faz parte do build de propósito: ela precisa acontecer
# antes do typecheck do front (D-03), senão o front compila contra o tipo velho.
BUILD_CMD="pnpm run build"

# ---------------------------------------------------------------------------
# TESTE  —  integração, com Postgres de verdade. O gate EXIGE N>0 executados.
# ---------------------------------------------------------------------------
# Handler com fake não prova fiação. Aqui há banco, migration e HTTP reais.
# Precisa de DATABASE_URL_TESTE no ambiente (ver .env.example).
TEST_CMD="pnpm run teste"

# O vitest não imprime o resumo em nenhum dos formatos que o gate reconhece —
# ele acabaria somando "Test Files" com "Tests" e inflando a conta. Este comando
# lê o número real do relatório JSON da própria suíte.
TEST_COUNT_CMD="node scripts/contar-testes.mjs"

# ---------------------------------------------------------------------------
# FRONT  —  Nuxt em SSR sobre Vite
# ---------------------------------------------------------------------------
FRONT_DIR="web"
FRONT_BUILD="pnpm run build"
TYPECHECK_CMD="pnpm run typecheck"

# ---------------------------------------------------------------------------
# SUBIR O SISTEMA  —  o gate que pega o que o build nunca vê
# ---------------------------------------------------------------------------
# O compose de PRODUÇÃO é o alvo (D-02). O docker-compose.dev.yml sobe só o
# Postgres e nunca é alvo de gate — provar o dev-build seria o "verde stale"
# que a estrutura de portões existe para impedir.
COMPOSE="docker-compose.yml"
API_PORT=3000
FRONT_PORT=3001

# ---------------------------------------------------------------------------
# CONTRATO  —  o front importa o tipo gerado, não redeclara o modelo do back
# ---------------------------------------------------------------------------
OPENAPI_URL="$API_BASE/openapi.json"

# ---------------------------------------------------------------------------
# NAVEGAÇÃO  —  a prova de que a tela ABRE, não de que compila
# ---------------------------------------------------------------------------
# O crawler é deste projeto porque só ele conhece as sete rotas e o login.
# Neste produto TUDO é área logada: ele entra com PREATOR_TEST_USER/PASS e,
# sem elas, declara que cobriu só a tela de login.
#
# O gate roda o comando de dentro de FRONT_DIR — daí o `../`.
# Antes da primeira execução:  pnpm run crawl:preparar
CRAWL_CMD="node ../scripts/crawl-gate.mjs"
MAX_QUEBRADAS=0

# ---------------------------------------------------------------------------
# ONDE VIVEM SPEC E BOARD
# ---------------------------------------------------------------------------
# A fila é o GitHub Issues, não um arquivo em disco — por isso não há BOARD.
ESPEC_DIR="docs/especificacoes"
