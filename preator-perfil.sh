#!/usr/bin/env bash
# ============================================================================
# preator-perfil.sh — o CONTRATO entre o seu projeto e a fábrica.
#
# Copie este arquivo para a RAIZ do seu projeto com o nome `preator-perfil.sh`
# e ajuste os valores. É o único ponto de contato entre os dois lados.
#
# A fábrica não conhece .NET, Node, Java, Python ou Go. Ela sabe que existe
# *um comando de build* e pergunta ao projeto qual é. Por isso o mesmo conjunto
# de gates serve para qualquer stack.
#
# Um gate que não encontra o que precisa reporta SKIP explícito — e SKIP de gate
# bloqueante rebaixa o veredito a PARCIAL, nunca vira PASS silencioso. Deixar um
# campo em branco é uma escolha visível, não um atalho.
# ============================================================================

# ---------------------------------------------------------------------------
# ONDE ESTE PROJETO GUARDA SEU OVERLAY
# ---------------------------------------------------------------------------
# O overlay são as skills DESTE projeto: formato (convenções, templates de
# código), negócio específico e playbooks. Elas vivem no SEU repositório —
# a fábrica não prescreve caminho, só pergunta onde é.
OVERLAY=".preator"

# ---------------------------------------------------------------------------
# BUILD  —  o gate mais básico: compila?
# ---------------------------------------------------------------------------
# BUILD_CMD="dotnet build MinhaSolucao.sln -c Release"
# Node:    BUILD_CMD="npm run build"
# Java:    BUILD_CMD="mvn -q -DskipTests package"
# Go:      BUILD_CMD="go build ./..."
# Python:  BUILD_CMD="python -m compileall -q src"

# ---------------------------------------------------------------------------
# TESTE  —  atenção: o gate EXIGE N>0 testes realmente executados
# ---------------------------------------------------------------------------
# Prefira o filtro de INTEGRAÇÃO. Handler com fakes não prova fiação: foi o que
# deixou controller sem dispatch e evento sem consumidor passarem verdes.
# TEST_CMD="dotnet test --filter Categoria=Integracao"
# Se o seu runner não for reconhecido pelo gate (ele entende dotnet, jest,
# vitest, pytest e go test), declare como contar:
# TEST_COUNT_CMD="cat resultado.json | jq .total"

# ---------------------------------------------------------------------------
# FRONT  —  deixe vazio se o projeto não tem front
# ---------------------------------------------------------------------------
# FRONT_DIR="web"                    # relativo à raiz do projeto
# FRONT_BUILD="npm run build"
# TYPECHECK_CMD="npm run typecheck"  # opcional

# ---------------------------------------------------------------------------
# SUBIR O SISTEMA  —  o gate que pega o que o build nunca vê
# ---------------------------------------------------------------------------
# migration que não aplica, DI não registrada, extensão de banco faltando,
# FK cross-módulo fora de ordem, arquivo ausente na imagem.
# COMPOSE="docker-compose.local.yml"
# API_PORT=8080
# FRONT_PORT=3000
# API_BASE e FRONT_BASE derivam das portas; sobrescreva se não for localhost:
# API_BASE="https://staging.exemplo.internal"

# ---------------------------------------------------------------------------
# CONTRATO  —  o front importa o tipo gerado, não redeclara o modelo do back
# ---------------------------------------------------------------------------
# OPENAPI_URL="$API_BASE/swagger/v1/swagger.json"

# ---------------------------------------------------------------------------
# NAVEGAÇÃO  —  a prova de que a tela ABRE, não de que compila
# ---------------------------------------------------------------------------
# Só o seu projeto conhece suas rotas e seu login. Declare o crawler dele;
# sem isto, a fábrica usa um crawler genérico que só cobre rota pública.
# CRAWL_CMD="node scripts/crawl-gate.mjs"
# MAX_QUEBRADAS=0

# ---------------------------------------------------------------------------
# ONDE VIVEM SPEC E BOARD  —  opcional, usados pelos workflows
# ---------------------------------------------------------------------------
# ESPEC_DIR="docs/especificacoes"
# BOARD="docs/BOARD.md"

# ---------------------------------------------------------------------------
# ⛔ O QUE NÃO ENTRA AQUI
# ---------------------------------------------------------------------------
# Credencial, token, senha, string de conexão. Nada disso.
# O gate de navegação lê usuário de teste de PREATOR_TEST_USER e
# PREATOR_TEST_PASS no AMBIENTE — e, se não achar, diz no veredito que não
# cobriu a área logada em vez de fingir que cobriu.
