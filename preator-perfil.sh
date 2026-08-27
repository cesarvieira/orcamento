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
# RODAR O GATE MESTRE
#
# Os gates `contrato` e `navegacao` consultam a API e o front RODANDO, e o gate
# `test` é de integração contra Postgres de verdade (o de DEV, 5433 — ver
# docker-compose.dev.yml, sempre no ar). STACK_UP_CMD/STACK_DOWN_CMD abaixo
# sobem e derrubam o stack de PRODUÇÃO sozinhos — não precisa mais fazer isso
# na mão:
#
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

# `NUXT_BUILD_DIR` isola o build do gate do `.nuxt` que o `pnpm dev` usa.
# Sem isso, `nuxt build` apaga o `.nuxt/manifest/meta/dev.json` — o alvo do
# alias `#app-manifest` em desenvolvimento — e o front de dev quebra com um
# erro que não diz nada sobre a causa. Mesma razão das portas 3010/3011: a
# prova não atropela o ambiente que fica no ar.
FRONT_BUILD="NUXT_BUILD_DIR=.nuxt-gate pnpm run build"
TYPECHECK_CMD="NUXT_BUILD_DIR=.nuxt-gate pnpm run typecheck"

# ---------------------------------------------------------------------------
# ESTÁTICO  —  o que se prova sem subir nada. Os dois são OPCIONAIS e
# NÃO-BLOQUEANTES: reprovam visivelmente na tabela do veredito, mas não
# derrubam o carimbo. Estilo e código morto não quebram comportamento.
# ---------------------------------------------------------------------------
# Rodam da RAIZ do projeto, não de FRONT_DIR. `pnpm`, como todo o resto deste
# perfil — o exemplo da fábrica traz `npm`/`npx` porque é agnóstico.
LINT_CMD="pnpm run lint"
DEADCODE_CMD="pnpm run knip"

# Estes dois já rodavam no `.githooks/pre-push`, e SÓ lá — foi assim que a
# EF-02 fechou com PROVA_DE_COMPORTAMENTO=PASS carregando cinco exports sem
# consumidor e uma etiqueta @fundacao vencida, pegos só na hora do push,
# depois do merge. Hook que o gate mestre não enxerga é portão cego: quem
# carimba pronto é o gate, então é ele que precisa ver.

# ---------------------------------------------------------------------------
# SUBIR O SISTEMA  —  o gate que pega o que o build nunca vê
# ---------------------------------------------------------------------------
# O compose de PRODUÇÃO é o alvo (D-02). O docker-compose.dev.yml sobe só o
# Postgres e nunca é alvo de gate — provar o dev-build seria o "verde stale"
# que a estrutura de portões existe para impedir.
#
# Portas ISOLADAS do ambiente de dev (que fica no ar o tempo todo em 3000/3001
# via `pnpm dev` nativo — colidir com ele foi o motivo do gate travar em
# 'contrato' numa execução real). O stack de teste sobe num projeto docker
# compose à parte (`-p orcamento-teste`), então nunca compartilha container
# com o que já está rodando.
COMPOSE="docker-compose.yml"
API_PORT=3010
FRONT_PORT=3011

STACK_UP_CMD="API_PORT=$API_PORT FRONT_PORT=$FRONT_PORT API_BASE_PUBLICA=http://localhost:$API_PORT ORIGEM_WEB=http://localhost:$FRONT_PORT docker compose -f $COMPOSE -p orcamento-teste up -d --build"
STACK_DOWN_CMD="docker compose -f $COMPOSE -p orcamento-teste down"

# ---------------------------------------------------------------------------
# CONTRATO  —  o front importa o tipo gerado, não redeclara o modelo do back
# ---------------------------------------------------------------------------
# ⚠️ Não use $API_BASE aqui: no momento em que este arquivo carrega, o
# raiz.sh ainda não corrigiu $API_BASE para a porta que ACABAMOS de declarar
# acima — ele só faz essa correção DEPOIS do perfil terminar de carregar.
# $API_PORT, por outro lado, já é o valor certo (foi setado duas linhas
# acima, no mesmo arquivo) — é ele que deve alimentar qualquer URL derivada
# aqui dentro. Confira com `bash preator/esteira/raiz.sh` se tiver dúvida.
OPENAPI_URL="http://localhost:$API_PORT/openapi.json"

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
