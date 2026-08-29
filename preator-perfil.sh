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
# erro que não diz nada sobre a causa. Mesma razão da derivação de portas
# mais abaixo ("SUBIR O SISTEMA"): a prova não atropela o ambiente que fica
# no ar.
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
# PROJETO COMPOSE E PORTAS DERIVAM DO WORKTREE, por dois motivos — o segundo
# hoje maior que o primeiro:
#
#   1. (motivo original) não colidir com o ambiente de DEV, que fica no ar o
#      tempo todo: 3000/3001 via `pnpm dev` nativo, 5433 via
#      docker-compose.dev.yml. Foi o que travou o gate em 'contrato' numa
#      execução real, antes desta tarefa existir.
#
#   2. (motivo maior — tarefa #83, medido na história #20) GATES CONCORRENTES.
#      Com projeto e portas FIXOS (`-p orcamento-teste`, 3010/3011), dois
#      worktrees rodando `prova-comportamento.sh` ao mesmo tempo disputavam o
#      MESMO stack. Isso já produziu dois FAIL falsos nesta história: o gate
#      do revisor de #77 falhou em contrato/navegacao enquanto o gate de #78
#      rodava, e o gate de #78 repetiu o FAIL e ainda por cima SOBRESCREVEU
#      um `.prova-comportamento.json` VÁLIDO — sem re-execução isolada, uma
#      tarefa correta não teria mesclado, e o motivo pareceria ser o código.
#
# A DERIVAÇÃO (não um hash cru — ver por quê): todo worktree que o condutor
# abre segue o contrato documentado em CONDUTOR.md —
# `.preator/tmp/worktrees/<t>-<slug>` —, onde <t> é o número da
# tarefa/issue do GitHub. Esse número nunca se repete. Extraindo <t> do nome
# da pasta e reservando um BLOCO de 3 portas consecutivas por tarefa
# (api, front, postgres), a colisão entre worktrees numerados fica
# IMPOSSÍVEL por construção: tarefas diferentes → <t> diferente → blocos
# disjuntos, sempre — sem depender de sorte de hash.
#
# Pasta SEM número no início (ex.: a árvore principal, fora de
# .preator-worktrees — este é o único caso real hoje) cai num HASH do
# caminho absoluto: determinístico para aquele caminho, mas sem a mesma
# garantia matemática entre dois caminhos fora do contrato. Só nesse ramo,
# o perfil CONSULTA o Docker antes de liberar a porta — se ela já pertencer
# a um projeto compose de OUTRO nome, o perfil FALHA ALTO (o raiz.sh já sabe
# reportar "perfil falhou ao carregar") em vez de deixar o gate confundir
# "porta de outro projeto" com "meu serviço não respondeu". Um erro claro
# aqui é infinitamente melhor que o FAIL falso que esta tarefa conserta.
#
# O NOME do projeto compose não depende do número: é a própria pasta do
# worktree, sanitizada — e `git worktree add` já garante essa pasta única no
# disco, então dois worktrees NUNCA compartilham projeto compose.
COMPOSE="docker-compose.yml"

# __pf_* são temporários desta derivação — descartados no fim (mesmo padrão
# de __portas_antes em raiz.sh). Localização vem do PRÓPRIO ARQUIVO
# (BASH_SOURCE), não do $PWD de quem chamou: $PWD muda conforme quem roda o
# gate; onde este arquivo mora, não.
__pf_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
__pf_pasta="$(basename "$__pf_dir")"

__pf_proj_raw="orcamento-${__pf_pasta}"
PROJETO_COMPOSE="$(printf '%s' "$__pf_proj_raw" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9-]+/-/g; s/^-+//; s/-+$//')"

__pf_base=20000
if [[ "$__pf_pasta" =~ ^([0-9]+)- ]]; then
  __pf_n="${BASH_REMATCH[1]}"
  __pf_origem="numero-da-tarefa"
else
  # fallback: hash estável do caminho, faixa própria (60000+) que nunca
  # sobrepõe a faixa numerada (válido até a tarefa nº 13333 — se este projeto
  # chegar lá, revise a faixa)
  __pf_hash="$(printf '%s' "$__pf_dir" | cksum | cut -d' ' -f1)"
  __pf_n=$(( __pf_hash % 1000 ))
  __pf_base=60000
  __pf_origem="hash-do-caminho"
fi

API_PORT=$(( __pf_base + __pf_n * 3 ))
FRONT_PORT=$(( __pf_base + __pf_n * 3 + 1 ))
POSTGRES_PORT=$(( __pf_base + __pf_n * 3 + 2 ))

# só o ramo hash precisa da checagem: o ramo numerado já é livre de colisão
# por construção. Custo pago só quando o Docker existe e este é o caminho
# raro (pasta fora do contrato de worktree).
if [ "$__pf_origem" = "hash-do-caminho" ] && command -v docker >/dev/null 2>&1; then
  for __pf_porta in "$API_PORT" "$FRONT_PORT" "$POSTGRES_PORT"; do
    __pf_dono="$(docker ps --format '{{.Ports}}|{{.Label "com.docker.compose.project"}}' 2>/dev/null \
      | grep -E ":${__pf_porta}->" | cut -d'|' -f2 | grep -vxF "$PROJETO_COMPOSE" | head -1)"
    if [ -n "$__pf_dono" ]; then
      echo "preator-perfil.sh: porta $__pf_porta (hash de '$__pf_dir') já" >&2
      echo "  pertence ao projeto compose '$__pf_dono' — colisão de hash no" >&2
      echo "  fallback (esta pasta não segue o contrato numerado de worktree)." >&2
      echo "  Não libero: FAIL alto aqui vale mais que repetir o FAIL falso" >&2
      echo "  da história #20." >&2
      unset __pf_dir __pf_pasta __pf_proj_raw __pf_base __pf_n __pf_hash __pf_origem __pf_porta __pf_dono
      return 1 2>/dev/null || exit 1
    fi
  done
fi

# ---------------------------------------------------------------------------
# BANCO DE TESTE  —  vetor #4 da concorrência entre gates (tarefa #84).
# ---------------------------------------------------------------------------
# `api/testes/preparar-banco.ts` derruba o schema inteiro a cada execução.
# Antes desta tarefa, todo worktree apontava pro MESMO `orcamento_teste` no
# Postgres de DEV (5433, sempre no ar) — duas suítes concorrentes não
# "misturavam dados", uma derrubava o schema embaixo da outra. Foi assim que
# o gate de #82 viu 401 virar 404, e o revisor de #83 viu FK quebrar, os dois
# sem nenhuma linha de causa no diff.
#
# A correção NÃO sobe um Postgres por worktree — o de dev é um servidor só,
# compartilhado de propósito, e não deriva porta (ver POSTGRES_PORT acima,
# que é de OUTRO Postgres: o do compose de PRODUÇÃO). Aqui cada worktree
# ganha um DATABASE diferente dentro do MESMO servidor de dev.
#
# MESMA derivação de <t>/hash da seção anterior — reaproveita __pf_n e
# __pf_origem, não inventa um segundo esquema. O prefixo n/h evita a única
# colisão que restaria: o namespace numerado (<t>, sem teto) e o namespace
# hash (mod 1000) podem produzir o mesmo número por coincidência — sem o
# prefixo, a tarefa #84 e um fallback de hash que caísse em 84 apontariam
# pro MESMO banco.
if [ "$__pf_origem" = "numero-da-tarefa" ]; then
  __pf_banco_sufixo="n${__pf_n}"
else
  __pf_banco_sufixo="h${__pf_n}"
fi
BANCO_TESTE_DERIVADO="orcamento_teste_${__pf_banco_sufixo}"

# Só o NOME viaja daqui — nenhuma credencial, nem string de conexão: o
# cabeçalho deste arquivo já proíbe isso ("Credencial, token, senha e string
# de conexão NÃO entram aqui"), e é `api/testes/preparar-banco.ts` quem já
# monta a URL da suíte a partir de partes nomeadas (usuário/senha/porta, os
# defaults do docker-compose.dev.yml). Reaproveitar esse único lugar — em vez
# de montar uma SEGUNDA URL aqui — é o que evita dois esquemas divergentes.
#
# `preparar-banco.ts` só troca o NOME do banco por este valor quando
# `DATABASE_URL_TESTE` não estiver explícito no ambiente: quem já tem
# `.env.test` (carregado dentro do processo Node, por cima disto) continua
# vencendo sempre — a derivação nunca sobrescreve o que já foi decidido lá.
export BANCO_TESTE_DERIVADO

echo "preator-perfil.sh: banco de teste derivado = ${BANCO_TESTE_DERIVADO} (origem: ${__pf_origem})" >&2

unset __pf_dir __pf_pasta __pf_proj_raw __pf_base __pf_n __pf_hash __pf_origem __pf_porta __pf_dono __pf_banco_sufixo

STACK_UP_CMD="API_PORT=$API_PORT FRONT_PORT=$FRONT_PORT POSTGRES_PORT=$POSTGRES_PORT API_BASE_PUBLICA=http://localhost:$API_PORT ORIGEM_WEB=http://localhost:$FRONT_PORT docker compose -f $COMPOSE -p $PROJETO_COMPOSE up -d --build"
STACK_DOWN_CMD="docker compose -f $COMPOSE -p $PROJETO_COMPOSE down"

# ---------------------------------------------------------------------------
# CONTRATO  —  o front importa o tipo gerado, não redeclara o modelo do back
# ---------------------------------------------------------------------------
# ⚠️ Não use $API_BASE aqui: no momento em que este arquivo carrega, o
# raiz.sh ainda não corrigiu $API_BASE para a porta que ACABAMOS de declarar
# acima — ele só faz essa correção DEPOIS do perfil terminar de carregar.
# $API_PORT, por outro lado, já é o valor certo (foi derivado mais acima,
# no mesmo arquivo) — é ele que deve alimentar qualquer URL derivada aqui
# dentro. Confira com `bash preator/esteira/raiz.sh` se tiver dúvida.
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
