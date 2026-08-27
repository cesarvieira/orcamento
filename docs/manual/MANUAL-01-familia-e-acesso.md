# MANUAL as-built — EF-01 Família e acesso

> O que foi **construído**, não o que a EF previu. Nasce na implantação; é a base para entender o
> módulo sem ler o código. Ver [EF-01](../especificacoes/EF-01-familia-e-acesso.md) (o contrato) e
> [MC-01](../especificacoes/MC-01-familia-e-acesso.md) (o que falta).

- **Identificação:** Família e acesso · EF-01 · história [#15](https://github.com/cesarvieira/orcamento/issues/15) · tarefas [#32](https://github.com/cesarvieira/orcamento/issues/32)/[#33](https://github.com/cesarvieira/orcamento/issues/33) (fechamento inicial) e [#35](https://github.com/cesarvieira/orcamento/issues/35)/[#36](https://github.com/cesarvieira/orcamento/issues/36) (addendum — fechou `EF01-MC-001`, ainda antes do merge do PR)
- **Construído por:** agentes `backend` e `frontend` (Sonnet 5, tier padrão), em worktrees isolados
- **Data:** 2026-08-25 · **Commits:** `9bac267` (T1) → `e1340db`; `da44fee` (T2) → `e56c54a`;
  `b9aa7f4` (T3, `GET /convites`) → `acc2445`; `b433391` (T4, lista no front) → mesclado
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
- **Aceite:** `POST /convites/aceitar` (`rotas.ts`) — corpo `AceitarConvite` (união
  discriminada `metodo: 'senha' | 'google'`), com **email + código de 6 dígitos** (RN-10): o
  convite é procurado pelo par, nunca pelo código sozinho. RN-02 deixou de ser comparação depois
  do fato — com o email errado não se acha convite nenhum. Valida RN-03 (expiração/uso único),
  RN-11 (teto de 5 tentativas), chama `identidade-servico` para resolver
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
- **`web/app/pages/mais/convidar.vue`** (novo): campo de email, `POST /convites`, mensagem de sucesso
  ("Convite enviado para X — expira em breve"), e lista de convites pendentes da família (ver
  addendum abaixo — a listagem foi fechada em #35/#36, depois do fechamento inicial da história).
- **`web/app/pages/convite/[token].vue`** (novo): formulário nome/email/senha ou Google, `POST /convites/
:token/aceitar`. Mensagens de erro de RN-02/RN-03 vêm **sempre** da resposta da API, nunca
  pré-validadas no cliente.
- **`web/app/middleware/sessao.global.ts`**: `/convite/*` virou rota pública (junto de `/entrar`) —
  necessário para quem chega por link de convite sem sessão nenhuma.
- **`web/nuxt.config.ts`**: novo `runtimeConfig.public.googleClientId`, mesmo padrão de `apiBase`,
  lido de `GOOGLE_CLIENT_ID`/`NUXT_PUBLIC_GOOGLE_CLIENT_ID`. Plumbado em `docker-compose.yml`
  depois (fora do escopo original da tarefa, a pedido do humano): `GOOGLE_CLIENT_ID` no serviço
  `api` e `NUXT_PUBLIC_GOOGLE_CLIENT_ID` no `web`, ambos da mesma variável — se divergirem, todo
  token é recusado por audiência. Medido: com a variável no ambiente, o valor aparece no HTML
  servido pelo container **sem rebuild** (`NUXT_PUBLIC_*` sobrescreve `runtimeConfig.public` em
  tempo de execução); sem ela, chega vazia e o botão segue inerte — que é como o gate roda. Como
  obter a credencial: [playbook](../../.preator/playbooks/google-client-id.md).
- **`web/app/pages/mais.vue` → `web/app/pages/mais/index.vue`:** renomeado. Nuxt trata um arquivo `mais.vue`
  coexistindo com uma pasta `mais/` como pai/filho de rota; sem `<NuxtPage/>` em `mais.vue`, `/mais/
convidar` casava a URL mas renderizava o conteúdo de `mais.vue`. Renomear para `mais/index.vue`
  resolve sem mudar a rota pública (`/mais` continua igual).
- **`entrar.vue`:** botão Google real; Apple, "esqueci senha" e "criar conta da família" continuam
  inertes — não estão no escopo da EF-01 fechada (§3 só lista entrar · convidar · aceitar).

## Addendum — listagem de convites pendentes (#35/#36)

Fechado o pedido inicial da história, a lacuna `EF01-MC-001` (sem forma de listar convites
pendentes) foi identificada e corrigida ainda dentro da mesma história, antes do merge do PR #34:

- **`GET /convites`** (`api/src/modulos/familia/rotas.ts`, tarefa #35): autenticado, lista os
  convites da família da sessão (`familiaId` de `familiaDaRequisicao`, nunca do request — RN-01)
  que não foram usados nem expiraram, mais recente primeiro. Serviço
  `listarConvitesPendentes(db, familiaId)` em `convites.ts`. Schemas novos no contrato:
  `ConvitePendente` (`{id, email, expiraEm}`) e `ConvitesPendentes` (wrapper `{convites: [...]}`,
  mesmo padrão de `FamiliaAtual`). 5 testes novos de integração (isolamento entre famílias, convite
  usado/expirado não aparece, ordem).
- **Frontend** (tarefa #36): `useConvite.ts` ganhou `listarConvitesPendentes()`; `convidar.vue`
  carrega a lista ao montar e insere o convite novo no topo, localmente, ao enviar com sucesso
  (sem nova ida à API) — email e data de expiração formatada, reaproveitando a linguagem visual de
  `mais.vue` (`.lista`/`.linha`), sem componente novo.

Ambas re-verificadas de forma independente pelo condutor (gate mestre re-executado do zero + script
Playwright ad hoc confirmando a lista carregando e atualizando na tela real).

## Addendum — recuperação de senha (RN-12 a RN-16)

"Esqueci minha senha" era inerte porque a EF não tinha regra. A decisão do humano de 2026-08-26
fechou RN-12 a RN-16 e o fluxo foi construído:

- **`recuperacao-servico.ts`** (novo): `pedirRecuperacao` sorteia o código de 6 dígitos e o guarda
  na identidade de senha; `concluirRecuperacao` valida por **email + código** com o mesmo teto de
  RN-11, grava o hash novo e devolve o `membroId`. Reaproveita `gerarCodigo`/`TENTATIVAS_MAXIMAS`
  (`sessao-servico.ts`) e `gerarHashDeSenha` (`senha.ts`) — nada de criptografia nova.
- **`POST /recuperacoes`** responde **202 com corpo idêntico** exista ou não a conta (RN-13). O
  texto mora numa constante única: duas cópias divergem e viram o oráculo que a regra fecha.
- **`POST /recuperacoes/concluir`** encerra todas as sessões (RN-14, via
  `encerrarSessoesDoMembro`) **antes** de abrir a nova — na ordem inversa a sessão recém-criada
  morreria junto e a pessoa trocaria a senha para continuar de fora.
- **RN-15 e a correção que ela obrigou:** quem só tinha Google ganha uma identidade de senha com
  segredo nulo (não loga, `conferirSenha(…, null)` é `false`). Isso cria a possibilidade de **duas
  identidades para o mesmo email**, e `POST /sessoes` buscava só por email com `.limit(1)` — viraria
  loteria. O login passou a filtrar `provedor = 'senha'`.
- **`/recuperar`** (`web/app/pages/recuperar.vue`): duas etapas na mesma tela, no padrão visual de
  `/entrar`. O link em `/entrar` deixou de ser "em breve". RN-14 é avisada **antes** de a pessoa
  trocar, não depois.
- **11 testes novos** (`api/testes/recuperacao.teste.ts`), um por regra — incluindo o de RN-13, que
  compara status **e** corpo entre email que existe e email que não existe.

Dois consertos caíram junto, ambos defeitos reais encontrados no caminho:

1. Os corpos **texto** dos emails de convite e confirmação ainda mandavam só o link, sem o código —
   uma edição por script do turno anterior falhou em silêncio (o interpretador não decodificava os
   literais acentuados). Só as versões HTML tinham sido atualizadas, então quem lê email em texto
   puro recebia um link que não autoriza nada.
2. A mensagem de RN-06 no login ainda dizia "o link foi enviado", mentira desde RN-10.

### Entrar com Google habilitado no dev

A credencial real já estava em `.env.dev`; o que faltava era **o front enxergá-la**. O Nuxt carrega
`.env` a partir do seu próprio `rootDir` (`web/`), não da raiz do monorepo — a mesma armadilha de
caminho que já apareceu nesta EF —, então a API lia o client id e o navegador recebia string vazia,
deixando o botão inerte. `web/package.json` passou a rodar `nuxt dev --port 3001 --dotenv
../.env.dev`, que é o mecanismo documentado do Nuxt para apontar o arquivo. **Nada foi duplicado:**
continua havendo um único lugar com o valor.

Medido, não presumido: subindo o dev numa porta separada, `/entrar` passou a sair com
`googleClientId` preenchido no payload e zero ocorrências de "em breve". O client id não é segredo
— viaja no próprio ID token e sai no HTML por definição; o client _secret_ não é usado neste fluxo,
porque o Identity Services entrega um ID token ao navegador e quem o valida é a API.

O caminho de produção já estava fiado (`docker-compose.yml` repassa `GOOGLE_CLIENT_ID` para `api` e
`NUXT_PUBLIC_GOOGLE_CLIENT_ID` para `web`). O que continua fora do nosso alcance é o Console do
Google: as _Authorized JavaScript origins_ precisam listar as origens de onde o app é servido.

### Entrar com Google: de One Tap para código de autorização

Habilitado o client id, o botão passou a abrir — e a falhar. O log do navegador deu os três
sinais: `Not signed in with the identity provider`, `FedCM get() rejects with NetworkError`, e
`initialize() is called multiple times`.

A causa não era configuração: era **o fluxo errado**. `useGoogle` usava
`google.accounts.id.prompt()`, que é **One Tap** — ele só aparece para quem já tem sessão Google
aberta no navegador. Quem não tem não recebe tela de login nenhuma; recebe o erro acima e fica sem
caminho. Os outros dois avisos eram defeitos do mesmo código: `isNotDisplayed`/`isSkippedMoment`
são os métodos que o FedCM está aposentando, e `initialize()` era chamado a cada clique.

Não existe forma suportada de abrir o seletor de conta a partir de um botão nosso no fluxo de ID
token — quem abre é o botão que o próprio Google renderiza, e adotá-lo custaria o padrão visual da
tela. **Decisão do humano:** trocar para o fluxo de **código de autorização**.

- **Front** (`useGoogle.ts`): `google.accounts.oauth2.initCodeClient({ ux_mode: 'popup' })` +
  `requestCode()`, disparado do nosso botão, funcionando sem sessão Google prévia. O cliente é
  criado a cada chamada de propósito — guardá-lo entre cliques era a origem do aviso de
  inicialização repetida. Escopo `openid email profile`: sem `openid` o Google devolveria só um
  access token, e a API não teria o `email_verified` que RN-02 exige.
- **API** (`google.ts`): `perfilDoGoogle(codigoAutorizacao)` troca o código por tokens
  (`OAuth2Client.getToken`, com `redirect_uri: 'postmessage'` — o valor que o Google exige para
  código vindo de popup) e **ainda verifica** o ID token devolvido. Trocar já prova que falamos com
  o Google, mas é o ID token que carrega `email_verified`.
- **Contrato:** `LoginGoogle.idToken` → `codigoAutorizacao`; em `AceitarConvite` o método `google`
  passa a levar `codigo` (os 6 dígitos do convite, RN-10) **e** `codigoAutorizacao` (o do OAuth).
  Os nomes são distintos de propósito: são provas de coisas opostas — "fui convidado" e "sou dono
  deste email".
- **Segredo novo:** `GOOGLE_CLIENT_SECRET`, entregue pelo compose **só** ao serviço `api`. É o
  primeiro segredo de verdade deste projeto; ver os riscos em MC-01.

O seam de teste acompanhou a fronteira: `definirVerificadorDeIdTokenGoogle` virou
`definirResolvedorDeGoogle`, mockando "código → perfil" em vez de "ID token → perfil". O resto do
fluxo — rota, banco, sessão, RN-04 — continua real nos 7 testes de `google.teste.ts`.

### Sessão: "Manter conectada" saiu, "Sair" entrou na sidebar

A caixa **"Manter conectada"** foi removida de `/entrar`. Ela era decorativa: o `lembrar` nunca era
enviado à API nem influenciava o cookie — prometia uma escolha que não existia. Manter conectado
**já é** o comportamento, e não por acidente: `SESSAO_TTL_HORAS` vale 720 (30 dias) e o cookie sai
com `expires`, então a sessão sobrevive a fechar o navegador. O CSS órfão
(`.entrar__lembrar`, `.entrar__checkbox`) foi removido junto, e `.entrar__linha` passou de
`space-between` para `flex-end` — com um item só, o primeiro empurraria o link para o lado errado.

Como a sessão agora só termina por decisão de quem usa, **sair precisa estar sempre à mão**. O
botão existia apenas em `/mais`, que no desktop é a tela redundante — quem navega pela sidebar
nunca passa por lá e ficava sem saída. `layouts/default.vue` ganhou um **Sair** no pé da sidebar,
chamando o mesmo `sair()` de `useSessao`. No mobile nada muda: `/mais` continua com o seu.

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
   duas tarefas — `PROVA_DE_COMPORTAMENTO=PASS`. Neste ponto o condutor também restaurou uma
   modificação local não commitada em `preator/` (o checkout do repo principal tinha o gate mestre
   com quase tudo comentado, de uma sessão anterior não relacionada) — sem isso, o carimbo da
   história teria saído com apenas 1 de 6 checagens.
4. Tarefa #35 (branch `tarefa/35-convites-listagem`): re-executado do zero, `PASS`, 56 testes (5
   novos).
5. Tarefa #36 (branch `tarefa/36-convites-lista-frontend`): re-executado do zero, `PASS`, mais
   verificação manual (Playwright ad hoc) confirmando a lista carregando e atualizando em
   `/mais/convidar` de verdade.

```
build        PASS  (bloqueante)
test(N>0)    PASS  (bloqueante) — 56 testes executados (após #35/#36; 51 no fechamento inicial)
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
