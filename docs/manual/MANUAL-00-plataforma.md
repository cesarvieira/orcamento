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

`pnpm` (workspace em `pnpm-workspace.yaml`) amarra os três — migrado de `npm` depois do fechamento
inicial da história, a pedido do humano. `BUILD_CMD` roda `tsc` na API e, na mesma passada, emite o
OpenAPI e gera `packages/contrato` — de propósito, para o front nunca compilar contra um tipo velho
(D-03). Os dois `Dockerfile` usam `corepack prepare pnpm@11.10.0` e `--ignore-scripts` nos estágios
de imagem (não há `.git` nem `scripts/` no contexto de build, então o hook de git da raiz não tem
o que religar ali).

## Qualidade — lint, format e hooks

- **ESLint** (flat config, `eslint.config.mjs` + `eslint.shared.rules.mjs` na raiz) cobre o
  monorepo inteiro num só arquivo — sem turbo aqui, um config resolve para api/web/packages/scripts
  sem duplicar por pacote. Regras carregadas do projeto `leilaodeumminuto` como referência
  (stylistic, TypeScript, Vue/Nuxt). `packages/contrato/src/gerado/**` e `src/index.ts` (saída do
  OpenAPI) ficam fora do lint — são gerados, não se editam.
- **Prettier** cobre `json/md/yml/yaml/scss/css`; TypeScript/Vue ficam com o ESLint (`@stylistic`),
  para não ter duas ferramentas competindo pela mesma formatação.
- **`.githooks/pre-commit`** ganhou um segundo bloco (o primeiro, do scanner de segredo, é da
  fábrica e não se toca): `pnpm exec lint-staged` nos arquivos staged. **`.githooks/pre-push`**
  (novo) roda lint completo + typecheck (api e web) + build antes de liberar o push — mais barato
  que o gate mestre (sem banco, sem stack de pé), mais caro que o pre-commit. `scripts/
instalar-hooks.mjs` (script `prepare` do `package.json`) fixa `core.hooksPath=.githooks` a cada
  `pnpm install`, para o segundo bloco nunca depender de alguém lembrar de religar.
- **CSS não vive mais em `.vue`.** Todo `<style scoped>` virou `<style lang="scss" src="~/assets/
scss/..." scoped>`, apontando para um parcial em `web/app/assets/scss/{layouts,pages,components}/`.
  `web/app/assets/css/base.css` virou `web/app/assets/scss/base.scss`. Precisa do pacote `sass` (dart-sass)
  como devDependency do `web` — o Vite não compila `.scss` sem ele.

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
- **Cliente:** `web/app/composables/useRealtime.ts` — conecta só após hidratação (evita socket no SSR),
  descarta eventos com o próprio `origemClienteId`, e resincroniza a competência ativa ao
  reconectar. **Este último trecho não tem teste automatizado** — ver MC-00.

## Shell responsivo

- `web/app/layouts/default.vue` — tab bar (< 768px) / sidebar (≥ 768px), extraído do mockup: sidebar
  252px `#14325a`, item 42px, ativo em branco; tab bar grid `1fr 1fr 76px 1fr 1fr` com FAB central;
  topo 76px. Fontes (Manrope) e ícones (Tabler) empacotados via `pnpm`, não CDN — o gate de
  navegação cobra zero erro de rede.
- `web/app/layouts/limpo.vue` — layout sem moldura, disponível para telas pré-família (`entrar.vue`
  não usa mais: o visual novo do mockup é full-bleed, incompatível com o wrapper centralizado de
  380px do `limpo`). Segue reservado para a EF-01 (aceite de convite), que decide seu próprio
  visual quando tiver mockup.
- `web/app/pages/entrar.vue` — atualizado 2026-08-24 contra o mockup (Claude Design, projeto
  `b7d13c37-0d57-4a92-9df6-c50357cb587d`): mobile com hero escuro + cartão branco flutuante;
  desktop com painel de marca (44%, `#14325a`, headline + 3 bullets) e cartão centralizado
  (412px). **Só email+senha é real.** Google, Apple, "criar conta da família" e "esqueci minha
  senha" aparecem como no mockup mas são inertes — clicar mostra "em breve" em vez de abrir um
  fluxo que não existe (Google OAuth, cadastro de família e recuperação de senha são da EF-01,
  ainda sem EF escrita). Decisão do humano, não da IA: visual completo, lógica só do que está
  especificado.
- `web/app/config/navegacao.ts` — as sete rotas de domínio num só lugar (fonte para tab bar e sidebar).
- `web/app/components/MolduraDeModulo.vue` — cada `web/app/pages/*.vue` de domínio (`orcamento`, `contas`,
  `extrato`, `faturas`, `metas`, `fechamento`, `mais`) é hoje essa moldura, marcando de quem é a
  tela — o conteúdo de domínio é das EFs 01-08. `index.vue` redireciona para a home real.
- `web/app/middleware/sessao.global.ts` — guarda de rota global: sem sessão válida, redireciona para
  `/entrar`.

## Contrato

`packages/contrato` é gerado (`packages/contrato/gerar.mjs`) do OpenAPI que a API emite
(`api/src/openapi/emitir.ts` + `registro.ts` + `esquemas.ts`). O front importa os tipos gerados
(ex. `SessaoAtual`, `Invalidacao`) via `web/app/composables/useApi.ts` e `useRealtime.ts` — nenhum
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

## Observabilidade — Sentry (D-08)

> Acrescentado na história [#114](https://github.com/cesarvieira/orcamento/issues/114), depois do
> fechamento inicial da EF-00. Passo a passo de operação em
> [`.preator/playbooks/sentry.md`](../../.preator/playbooks/sentry.md).

Instância **self-hosted**, que **não** vive neste repositório: aqui só se consome um DSN. O
`docker-compose.yml` daqui é o alvo do `deploy-fresh`, e os ~20 contêineres do Sentry o tornariam
improvável de subir do zero em tempo de gate.

`SENTRY_DSN` vazio (o default) = SDK não inicializa e nada sai da máquina. É o que mantém a suíte
de integração offline e o gate de navegação com zero erro de rede.

| Onde  | Arquivo                                                       | Nota                                                                                                                              |
| ----- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| API   | `api/src/instrumentacao.ts`                                   | importado na **primeira linha** de `index.ts` — o SDK instrumenta Express e `pg` por dentro e não alcança o que já foi carregado  |
| API   | `api/src/app.ts`                                              | a captura entra entre o 404 e o `tratarErro`; quem responde ao cliente continua sendo o `tratarErro`, na forma `Erro` do contrato |
| Front | `web/sentry.client.config.ts` · `web/sentry.server.config.ts` | exigência do `@sentry/nuxt`: arquivos de raiz. **Não** criam `web/server/`                                                        |
| Front | `web/Dockerfile`                                              | o CMD carrega o config com `--import` antes do servidor, pelo mesmo motivo da primeira linha da API                               |

**Nada sensível sai no evento.** `sendDefaultPii: false` mais uma limpeza que apaga o valor de
todo campo cujo nome case com senha/token/cookie/authorization/secret, em qualquer profundidade —
duas implementações irmãs (`api/src/instrumentacao.ts` e `web/app/utils/limpeza-de-evento.ts`),
provadas em `api/testes/sentry.teste.ts` e `web/app/utils/limpeza-de-evento.teste.ts`. O stack
trace não é limpo, de propósito.

**Três portas para provar que está viva, a qualquer momento:**

| Porta    | Comando / caminho                               | Depende de                                                                   |
| -------- | ----------------------------------------------- | ---------------------------------------------------------------------------- |
| CLI      | `pnpm --filter @orcamento/api run sentry:teste` | nada — nem stack no ar, nem chave ligada. Sai `1` se não confirmar a entrega |
| Endpoint | `GET /diagnostico/sentry` (`?modo=erro`)        | `SENTRY_TESTE_HABILITADO=true`; fora isso, 404                               |
| Tela     | `/mais/diagnostico`                             | `NUXT_PUBLIC_SENTRY_TESTE_HABILITADO=true` + sessão; fora isso, 404          |

## Prova rodada (evidência)

Re-executada pelo condutor, **independente do relato do agente**, três vezes:

1. Na branch `tarefa/24-ef-00-plataforma`, duas execuções seguidas (para descartar flakiness de
   ordem) — `PROVA_DE_COMPORTAMENTO=PASS` nas duas, 32 testes.
2. Na branch `historia/14-ef-00-plataforma`, **do zero**: `pnpm install` fresco, `docker compose
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

## PWA instalável

Referência técnica e decisões: [D-10](../decisoes/D-10-pwa-instalavel.md).

**O que existe:**

- `web/public/manifest.webmanifest` — metadados de instalação (nome, ícones, display `standalone`).
- `web/public/sw.js` — service worker estático, registrado só no cliente e só em produção.
- `web/public/offline.html` — página sem dados, servida quando navegação falha por rede (exigência
  do navegador para considerar o app instalável; não é um modo offline completo).
- `web/public/icones/` — imagens (192px, 512px, maskable-512px, apple-touch-icon, favicon);
  fornecidas; apenas a maskable é gerada por script.
- `web/app/plugins/pwa.client.ts` — registra o service worker em produção, escuta
  `beforeinstallprompt` e `appinstalled`.
- `web/app/composables/useInstalacaoPwa.ts` — state do evento de instalação, expõe `podeInstalar`
  e `instalar()`.
- Botão _Instalar o app_ em `web/app/layouts/default.vue` (sidebar) e `web/app/pages/mais/index.vue`
  (menu).

**Como instala um usuário:**

O navegador dispara `beforeinstallprompt` quando manifesto, ícones e service worker foram validados
**e** o app ainda não está instalado — nenhuma ação do app força isto. Ao clicar no botão, o app
chama `evento.prompt()` para o navegador exibir o prompt nativo. Após instalar, o evento
`appinstalled` limpa o estado e o botão some — **sem `localStorage`, sem heurística de user agent,
sem state que possa divergir**. Comportamento está correto por construção.

**O que o service worker cacheia e o que nunca cacheia:**

Esta é a regra de segurança da decisão D-10 §1. **Toda tela deste produto é área logada — o HTML
já sai do servidor com o saldo dentro.** Um cache que respondesse HTML do cliente serviria a última
tela logada **antes de qualquer verificação de sessão**, no aparelho onde outra pessoa da casa
abre o app depois.

| O que                         | Service worker faz                           | Por quê                                                   |
| ----------------------------- | -------------------------------------------- | --------------------------------------------------------- |
| `/_nuxt/*` (JS e CSS do Vite) | **cacheia** — cache-first, atualiza na rede  | nome versionado por hash; se está no cache, é byte a byte |
| Fontes (`.woff2`)             | **cacheia** — cache-first, atualiza na rede  | asset estático, versionado por nome                       |
| Ícones (`/icones/*`)          | **cacheia** — cache-first, atualiza na rede  | asset estático, versionado por nome                       |
| **HTML de qualquer rota** (/) | **NUNCA cacheia** — passa direto para a rede | dado financeiro do cliente logado — sem cache é seguro    |
| `/api/*`                      | **NUNCA cacheia** — passa direto para a rede | requisições ao servidor, nunca guardadas                  |
| `/realtime` (socket)          | **NUNCA cacheia** — passa direto para a rede | conexão bidirecional, sem HTTP                            |

O filtro é **lista de permissão, nunca bloqueio** — e essa moldura é permanente: acrescentar um
padrão à permissão reabre a regra de segurança acima e requer revisão de segurança. Ver `web/public/sw.js`
e D-10 para o raciocínio completo.

O cache é invalidado quando `VERSAO_CACHE` muda em `web/public/sw.js` — o `activate` apaga a
versão anterior. Alteração no `sw.js` é alteração de segurança, não de performance.

**Como verificar instalabilidade (Chrome/Edge):**

1. Abrir as ferramentas do desenvolvedor (`F12`).
2. Aba _Application_ → _Manifest_.
3. Procurar por erros (ícones ausentes, `display: standalone` faltando, etc.).
4. Se nada aparecer vermelho e o app não está instalado, clicar em _Install_ — é o que o próprio
   navegador ofereceria em produção.

**Regenerar o ícone maskable:**

O ícone `icone-maskable-512.png` é gerado por `scripts/gerar-icone-maskable.mjs` a partir de
`icone-512.png`. Se a arte mudar:

```bash
pnpm run build:icone-maskable
```

O script usa Playwright (já no monorepo para o gate) para desenhar o ícone centrado numa zona
segura (78% do quadro), com fundo amostrado da própria arte (`#1881a9`). A saída é idempotente:
roda duas vezes, sai sempre a mesma imagem (byte a byte, a menos que Chromium mude de versão).

**Pendência — iOS:**

O Safari não expõe `beforeinstallprompt` e nenhum site dispara instalação automaticamente lá. O
fluxo é manual (_Compartilhar_ → _Adicionar à Tela de Início_). Escrever instrução de usuário é
decisão de UX e produto, fora do escopo de EF-00 — registrada como pendência conhecida em
[EF-00 §5](../especificacoes/EF-00-plataforma.md).

## O que não foi portado do mockup

`support.js` (runtime gerado do dc-runtime) e as props de demonstração `cenarioSemLastro` /
`cartaoAbateSaldoNaHora` — conforme EF-00 §4.
