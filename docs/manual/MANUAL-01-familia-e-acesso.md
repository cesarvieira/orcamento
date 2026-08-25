# MANUAL as-built — EF-01 Família e acesso

> O que foi **construído**, não o que a EF previu. Nasce na implantação; é a base para entender o
> módulo sem ler o código. Ver [EF-01](../especificacoes/EF-01-familia-e-acesso.md) (o contrato) e
> [MC-01](../especificacoes/MC-01-familia-e-acesso.md) (o que falta).

- **Identificação:** Família e acesso · EF-01 · história [#15](https://github.com/cesarvieira/orcamento/issues/15) · tarefas [#32](https://github.com/cesarvieira/orcamento/issues/32) (backend) e [#33](https://github.com/cesarvieira/orcamento/issues/33) (frontend)
- **Construído por:** agentes `backend` e `frontend` (Sonnet 5, tier padrão), em worktrees isolados
- **Data:** 2026-08-25 · **Commits:** `9bac267` (T1) → mesclado em `e1340db`; `da44fee` (T2) →
  mesclado em `e56c54a`
- **Confiança:** Alta (código + gate re-executado pelo condutor, independente do relato dos
  agentes — inclusive depois de um agente travar por watchdog no meio da tarefa, ver abaixo)

---

## Backend — `api/src/modulos/familia`

- **Google OAuth:** `google.ts` verifica o `idToken` com `google-auth-library`
  (`OAuth2Client.verifyIdToken`, `audience: GOOGLE_CLIENT_ID`). Sem `GOOGLE_CLIENT_ID` no
  ambiente, a verificação recusa com erro claro em vez de aceitar sem checar — mesmo padrão de
  "declarar indisponível" que o resto da fábrica usa. Seam de teste
  (`definirVerificadorDeIdTokenGoogle`/`restaurarVerificadorDeIdTokenGoogle`) evita bater na rede
  do Google nos testes de integração.
- **Convite:** `convites.ts` — `POST /convites` (autenticado, `familiaId` da sessão) persiste
  token único + `expiraEm` (`CONVITE_TTL_HORAS`, default 72h) e despacha por `email.ts`, um driver
  plugável (`MAIL_DRIVER`: `log` em teste, outros em produção — D-07).
- **Identidade:** `identidade-servico.ts` resolve RN-04: ao aceitar convite, se já existe uma
  `Identidade` com aquele email (de outro provedor), vincula ao `Membro` existente em vez de criar
  pessoa nova.
- **Aceite:** `POST /convites/:token/aceitar` (`rotas.ts`) — corpo `AceitarConvite` (união
  discriminada `metodo: 'senha' | 'google'`). Valida RN-02 (email idêntico ao convidado, ou
  verificado do Google), RN-03 (expiração/uso único), chama `identidade-servico` para resolver
  RN-04, marca `usadoEm`, abre sessão, e dispara `emitirInvalidacao({ familiaId, recurso:
'familia' })` — primeiro handler de domínio a usar o emissor que a EF-00 deixou pronto.
- **Testes:** `api/testes/convites.teste.ts` (12) e `google.teste.ts` (7), somados aos que já
  existiam (32) — 51 testes de integração, N>0 real, HTTP→Postgres.

## Frontend — `web/`

- **`useGoogle.ts`** (novo): carrega o script do Google Identity Services (`accounts.google.com/
gsi/client`) **sob demanda**, só quando `useRuntimeConfig().public.googleClientId` está
  preenchido. Vazio (o caso desta máquina — `GOOGLE_CLIENT_ID` não configurado) mantém o botão
  "Google" inerte ("em breve"), sem carregar script nem gerar erro de console — é o caminho que
  roda de verdade no gate aqui.
- **`useSessao.ts`** ganhou `entrarComGoogle(idToken)`, espelhando `entrar()`.
- **`useConvite.ts`** (novo): `criarConvite()` e `aceitarConvite()`, ambos tipados pelo contrato
  gerado (`CriarConvite`/`ConviteCriado`/`AceitarConvite`), sem redeclarar modelo.
- **`web/pages/mais/convidar.vue`** (novo): campo de email, `POST /convites`, mensagem de sucesso
  ("Convite enviado para X — expira em breve"). Sem lista persistente — ver MC-01 EF01-MC-001.
- **`web/pages/convite/[token].vue`** (novo): formulário nome/email/senha ou Google, `POST /convites/
:token/aceitar`. Mensagens de erro de RN-02/RN-03 vêm **sempre** da resposta da API, nunca
  pré-validadas no cliente.
- **`web/middleware/sessao.global.ts`**: `/convite/*` virou rota pública (junto de `/entrar`) —
  necessário para quem chega por link de convite sem sessão nenhuma.
- **`web/nuxt.config.ts`**: novo `runtimeConfig.public.googleClientId`, mesmo padrão de `apiBase`,
  lido de `GOOGLE_CLIENT_ID`/`NUXT_PUBLIC_GOOGLE_CLIENT_ID`. **Não** foi plumbado em
  `docker-compose.yml` (raiz, fora do escopo desta tarefa) — quando alguém configurar a credencial
  de verdade, falta esse fio para produção.
- **`web/pages/mais.vue` → `web/pages/mais/index.vue`:** renomeado. Nuxt trata um arquivo `mais.vue`
  coexistindo com uma pasta `mais/` como pai/filho de rota; sem `<NuxtPage/>` em `mais.vue`, `/mais/
convidar` casava a URL mas renderizava o conteúdo de `mais.vue`. Renomear para `mais/index.vue`
  resolve sem mudar a rota pública (`/mais` continua igual).
- **`entrar.vue`:** botão Google real; Apple, "esqueci senha" e "criar conta da família" continuam
  inertes — não estão no escopo da EF-01 fechada (§3 só lista entrar · convidar · aceitar).

## O que a EF-00 já tinha deixado pronto (não foi refeito)

Schema completo (`Familia`/`Membro`/`Identidade`/`Convite`/`Sessao`, com `emailVerificado` e TTL
previstos), rotas de sessão por senha, middleware de tenant, e `emitirInvalidacao` com o comentário
`@fundacao` esperando exatamente este handler.

## Prova rodada (evidência)

Re-executada pelo condutor, **independente do relato dos agentes**, em três níveis:

1. Tarefa #32 (branch `tarefa/32-familia-backend`): o agente travou por watchdog de stream (600s
   sem progresso) antes de rodar o gate, mas o commit final ficou completo e correto. O condutor
   rodou o gate mestre do zero — `PROVA_DE_COMPORTAMENTO=PASS`, 51 testes.
2. Tarefa #33 (branch `tarefa/33-familia-frontend`): agente concluiu e relatou PASS; condutor
   re-executou do zero, mesmo veredito, e ainda verificou manualmente (script Playwright ad hoc)
   as duas telas que o crawler não cobre (`/mais/convidar`, `/convite/:token`).
3. História inteira (branch `historia/15-ef-01-familia-e-acesso`), **do zero**, depois do merge das
   duas tarefas — `PROVA_DE_COMPORTAMENTO=PASS`.

```
build        PASS  (bloqueante)
test(N>0)    PASS  (bloqueante) — 51 testes executados
front        PASS  (bloqueante)
typecheck    PASS
contrato     PASS  (bloqueante)
navegacao    PASS  (bloqueante) — 10 rotas abertas, 0 quebradas
PROVA_DE_COMPORTAMENTO=PASS
```

## Ambiente desta máquina (não é do produto — fica registrado para quem retomar)

- Portas 3000/3001 do host ficaram ocupadas por processos nativos de outros projetos durante toda
  a condução; API/web de produção foram publicadas em `3010`/`3011` só para rodar os gates
  (`API_PORT`/`FRONT_PORT`/`API_BASE_PUBLICA`/`ORIGEM_WEB` no `docker compose up`) —
  `preator-perfil.sh` continua declarando 3000/3001, que é o correto em ambiente sem esse conflito.
- Um restart de Docker/WSL no meio da condução recriou o Postgres de dev
  (`orcamento-dev-postgres-1`) na porta default (5432) em vez de 5433 do `.env.dev` — corrigido
  subindo de novo com `--env-file .env.dev`.
- O checkout local (não commitado) de `preator/` no repo principal tinha `prova-comportamento.sh`
  com quase todos os gates comentados, de uma sessão anterior não relacionada a esta história — o
  condutor restaurou o arquivo ao estado commitado (`git checkout --`) antes do carimbo final da
  história, para não fechar com um veredito artificialmente incompleto. Os worktrees das tarefas
  nunca tiveram esse problema (submódulo clonado limpo a cada `git worktree add`).

## O que não foi portado do mockup

Não se aplica — a própria EF-01 declara que não há mockup para as telas de entrar/convidar/aceitar
(único módulo cuja superfície não vem do desenho).
