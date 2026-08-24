# MANUAL as-built — EF-00 Plataforma

> O que foi **construído**, não o que a EF previu. Nasce na implantação; é a base para entender o
> módulo sem ler o código. Ver [EF-00](../especificacoes/EF-00-plataforma.md) (o contrato) e
> [MC-00](../especificacoes/MC-00-plataforma.md) (o que falta).

- **Identificação:** Plataforma · EF-00 · história [#14](https://github.com/cesarvieira/orcamento/issues/14) · tarefa [#24](https://github.com/cesarvieira/orcamento/issues/24)
- **Construído por:** agente `architect` (Opus 5, esforço máximo), papel de tier alto
- **Data:** 2026-08-24 · **Commit:** `b6c05a7` (tarefa) → mesclado em `b20164b` (história)
- **Confiança:** Alta (código + gate re-executado pelo condutor, independente do relato do agente)

---

## Monorepo

```
api/            TypeScript · Express 5 · Drizzle ORM · porta 3000 (interna)
web/            Nuxt 3 SSR sobre Vite · porta 3001
packages/contrato   saída do OpenAPI da api — o front importa daqui, nunca redeclara
scripts/        seed.ts · crawl-gate.mjs · contar-testes.mjs
```

`npm` workspaces na raiz (`package.json`) amarram os três. `BUILD_CMD` roda `tsc` na API e, na
mesma passada, emite o OpenAPI e gera `packages/contrato` — de propósito, para o front nunca
compilar contra um tipo velho (D-03).

## Banco de dados

- **Schema:** `api/src/db/schema.ts` (Drizzle, fonte única).
- **Migration:** `api/drizzle/0000_mean_toro.sql`, gerada por `drizzle-kit generate` — não escrita
  à mão. Aplica do zero em banco limpo (`api/src/db/migrar.ts`, serviço `migrate` do compose).
- **Conexão:** `api/src/db/index.ts` — `drizzle(pool)` de `drizzle-orm/node-postgres`.
- **Dinheiro:** `integer` em centavos, conforme D-06 — nenhuma coluna monetária usa `numeric`/`float`.
- **Rastreamento de migration:** o drizzle grava em `drizzle.__drizzle_migrations`, fora do schema
  `public`. Relevante para quem escrever setup de teste: derrubar só `public` não reseta o
  histórico de migrations — a segunda execução da suíte encontrava "já apliquei" contra tabelas que
  não existiam mais. `api/testes/preparar-banco.ts` derruba o schema inteiro (`DROP SCHEMA public,
  drizzle CASCADE`) por isso.

## Tenant e sessão

- **Middleware:** `api/src/http/middleware/tenant.ts`. `familiaId` deriva **só** do cookie de
  sessão assinado (`api/src/modulos/familia/sessao-servico.ts`); qualquer `familiaId`/`familia_id`
  em query ou corpo é descartado antes do handler, com log do que foi descartado.
  - Implementação: a query do Express 5 é substituída por uma **cópia limpa** via
    `Object.defineProperty` — o objeto original é um getter preguiçoso, e um `delete` nele não
    "gruda": a chave reaparecia na leitura seguinte de outro middleware. Mutar não bastava; a troca
    do objeto inteiro, sim.
  - Rotas com `:familiaId` no path são **recusadas no registro** (`registrarRota`), não filtradas
    em runtime — o roteador do Express preenche `req.params` depois do middleware de tenant rodar,
    então filtrar ali seria tarde demais.
- **Sessão:** `api/src/modulos/familia/sessao-servico.ts` + `senha.ts` — email/senha, cookie
  `httpOnly`/`SameSite=Lax`, TTL de `SESSAO_TTL_HORAS`. Rotas em
  `api/src/modulos/familia/rotas.ts` (`POST /sessoes`, `GET /sessoes/atual`, `POST /entrar`
  conforme a tela). **Só email/senha** — Google OAuth e convite/aceite ficam para a EF-01.

## Tempo real

- **Servidor:** `api/src/realtime/servidor.ts` — Socket.IO em `/realtime`, mesma porta da API. A
  room (`familia:<id>`) é resolvida **no handshake**, do cookie de sessão — nunca de payload do
  cliente. Handshake sem cookie válido é recusado antes do `connection`.
- **Emissor:** `api/src/realtime/emissor.ts` — emite só **invalidação** (o quê mudou, não o dado),
  com `origemClienteId` para o remetente descartar o próprio eco.
- **Cliente:** `web/composables/useRealtime.ts` — conecta só após hidratação (evita socket no SSR),
  descarta eventos com o próprio `origemClienteId`, e resincroniza a competência ativa ao
  reconectar. **Este último trecho não tem teste automatizado** — ver MC-00.

## Shell responsivo

- `web/layouts/default.vue` — tab bar (< 768px) / sidebar (≥ 768px), extraído do mockup: sidebar
  252px `#14325a`, item 42px, ativo em branco; tab bar grid `1fr 1fr 76px 1fr 1fr` com FAB central;
  topo 76px. Fontes (Manrope) e ícones (Tabler) empacotados via `npm`, não CDN — o gate de
  navegação cobra zero erro de rede.
- `web/layouts/limpo.vue` — layout sem moldura, usado por `entrar.vue`.
- `web/config/navegacao.ts` — as sete rotas de domínio num só lugar (fonte para tab bar e sidebar).
- `web/components/MolduraDeModulo.vue` — cada `web/pages/*.vue` de domínio (`orcamento`, `contas`,
  `extrato`, `faturas`, `metas`, `fechamento`, `mais`) é hoje essa moldura, marcando de quem é a
  tela — o conteúdo de domínio é das EFs 01-08. `index.vue` redireciona para a home real.
- `web/middleware/sessao.global.ts` — guarda de rota global: sem sessão válida, redireciona para
  `/entrar`.

## Contrato

`packages/contrato` é gerado (`packages/contrato/gerar.mjs`) do OpenAPI que a API emite
(`api/src/openapi/emitir.ts` + `registro.ts` + `esquemas.ts`). O front importa os tipos gerados
(ex. `SessaoAtual`, `Invalidacao`) via `web/composables/useApi.ts` e `useRealtime.ts` — nenhum
modelo é redeclarado (R6).

## Docker / ambiente

- `docker-compose.yml` — produção, alvo dos gates: `postgres` → `migrate` (roda migration e,
  se `SEMEAR=true`, o seed) → `api` → `web`, nessa ordem de dependência/healthcheck.
- `docker-compose.dev.yml` — só Postgres, para rodar `api`/`web` fora de container em
  desenvolvimento.
- `.env.example` documenta todas as variáveis, incluindo `PREATOR_TEST_USER`/`PREATOR_TEST_PASS`
  (as credenciais que `scripts/seed.ts` cria).
- `preator-perfil.sh` preenchido: `BUILD_CMD`, `TEST_CMD` (+ `TEST_COUNT_CMD` próprio, porque o
  vitest não imprime um resumo nos formatos que o gate reconhece), `FRONT_DIR`/`FRONT_BUILD`/
  `TYPECHECK_CMD`, `COMPOSE`/`API_PORT`/`FRONT_PORT`, `OPENAPI_URL`, `CRAWL_CMD`/`MAX_QUEBRADAS`.

## Prova rodada (evidência)

Re-executada pelo condutor, **independente do relato do agente**, três vezes:

1. Na branch `tarefa/24-ef-00-plataforma`, duas execuções seguidas (para descartar flakiness de
   ordem) — `PROVA_DE_COMPORTAMENTO=PASS` nas duas, 32 testes.
2. Na branch `historia/14-ef-00-plataforma`, **do zero**: `npm install` fresco, `docker compose
   down -v` + `up -d --build` (banco limpo, imagens reconstruídas) — `PROVA_DE_COMPORTAMENTO=PASS`.

```
build        PASS  (bloqueante)
test(N>0)    PASS  (bloqueante) — 32 testes executados
front        PASS  (bloqueante)
typecheck    PASS
contrato     PASS  (bloqueante)
navegacao    PASS  (bloqueante) — 10 rotas abertas, 0 quebradas
PROVA_DE_COMPORTAMENTO=PASS
```

Ambiente desta máquina: a porta 3000 do host está ocupada por um container de outro projeto
(`epros-novo-web`); a API de produção foi publicada em `3010` só para rodar o gate
(`API_PORT=3010` na hora do `docker compose up`) — `preator-perfil.sh` e `.env.example` continuam
declarando 3000, que é a porta correta em qualquer ambiente sem esse conflito.

## O que não foi portado do mockup

`support.js` (runtime gerado do dc-runtime) e as props de demonstração `cenarioSemLastro` /
`cartaoAbateSaldoNaHora` — conforme EF-00 §4.
