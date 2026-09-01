# D-08 — Observabilidade por Sentry self-hosted, dirigida por DSN

- **Status:** aceita
- **Data:** 2026-09-01

## Contexto

Até aqui, um erro em produção só existia no `console.error` do
`tratarErro` (`api/src/http/middleware/erro.ts`) e no log de acesso. Isso responde _"quebrou?"_
mas não responde nenhuma das perguntas que importam depois: **em qual rota, com qual entrada, para
qual família, quantas vezes, desde quando, e ainda está quebrando?** No front é pior — um erro no
navegador de quem usa não deixa rastro nenhum do lado de cá.

Três restrições reais moldaram a decisão:

1. **A suíte roda offline.** O gate de teste é de integração contra Postgres de verdade e não pode
   depender de host externo. O mesmo vale para o gate de navegação, que cobra **zero erro de rede**
   no artefato de deploy — um SDK tentando falar com um coletor inalcançável pinta o gate de
   vermelho por um motivo que não é o produto.
2. **Este produto guarda dado financeiro de família.** Um evento de erro carrega, por padrão,
   corpo de requisição, cookie e cabeçalho. Mandar isso cru para um coletor é vazar sessão e
   dado de família — a regra inviolável #1 do `.preator/CONTEXT.md` não abre exceção para
   ferramenta de diagnóstico.
3. **Ninguém confia em observabilidade que não se prova.** Integração de erro tem uma falha de
   modo silencioso clássica: parece instalada, e no dia do incidente não chega evento nenhum.
   Descobrir isso no incidente é descobrir tarde.

## Decisão

**Sentry, em instância self-hosted, ligado exclusivamente por `SENTRY_DSN` — e inerte quando o DSN
está vazio.**

Três partes, e as três são a decisão:

**1 · O DSN é a chave geral.** `SENTRY_DSN` vazio significa SDK inicializado e inerte: nada sai da
máquina. É esse default que mantém a suíte offline, o gate de navegação limpo e o compose de prova
sem dependência externa. Ligar é preencher uma variável de ambiente — em nenhum momento é mexer em
código.

**2 · A stack do Sentry NÃO é versionada neste repositório.** O `docker-compose.yml` daqui é o
artefato de deploy que o gate `deploy-fresh` prova do zero (D-02). O `getsentry/self-hosted` são
~20 contêineres — Kafka, ClickHouse, Snuba, Relay, Redis — e pede na faixa de 4 vCPU / 16 GB.
Enfiá-lo ali destruiria a propriedade que dá valor ao gate: subir a stack inteira do zero em tempo
de gate. **Este repositório consome um DSN.** Subir e operar a instância é assunto do
[playbook](../../.preator/playbooks/sentry.md).

**3 · Nenhum dado sensível sai daqui.** `sendDefaultPii: false` e um `beforeSend` que remove
`cookie`, `authorization` e campos de senha/token antes do envio — com teste que prova a remoção,
porque isto é requisito, não polimento.

**E a integração é testável a qualquer momento, por três portas:**

| Porta    | O que é                                         | O que ela prova                                                                                                      |
| -------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| CLI      | `pnpm --filter @orcamento/api run sentry:teste` | o processo alcança a instância e o evento chega — sem precisar de stack no ar                                        |
| Endpoint | `GET /diagnostico/sentry` (`?modo=erro`)        | a fiação do middleware de erro do Express: erro não tratado vira evento **e** resposta no formato `Erro` do contrato |
| Tela     | `/mais/diagnostico`                             | o SDK do navegador e o do SSR                                                                                        |

As três só existem com `SENTRY_TESTE_HABILITADO=true` (a CLI é a exceção: é comando, não superfície
exposta). Desligada — o default, inclusive em produção — o endpoint devolve 404 e a tela não existe.

## Alternativas consideradas

**Sentry SaaS (sentry.io).** Descartado por decisão do humano em 2026-09-01: dado de erro de um
produto financeiro familiar não sai para terceiro. Nada no código muda entre SaaS e self-hosted —
só o host do DSN —, então a porta continua aberta se a decisão mudar.

**GlitchTip no lugar do Sentry self-hosted.** Fala o mesmo protocolo dos SDKs e roda com Django +
Postgres + Redis, contra os ~20 contêineres do Sentry. Descartado **por ora**, não por mérito: a
escolha é do humano, e como tudo aqui é dirigido por DSN, trocar um pelo outro é mudança de
variável de ambiente. Fica registrado como o caminho de fuga se operar o Sentry self-hosted se
mostrar caro demais.

**Só log estruturado (pino/JSON) + agregador de log.** Descartado: resolve busca, não resolve
agrupamento. A pergunta _"este erro é novo ou é o mesmo de ontem, e quantas pessoas ele atingiu?"_
é o que se responde num incidente, e agregador de log não a responde sem construir em cima —
construir agrupador de erro é o produto de outra pessoa.

**Nada — seguir com `console.error`.** Descartado: já é o estado atual, e é ele que faz erro de
front ser invisível deste lado.

**Endpoint de teste sempre ligado.** Descartado: rota que estoura de propósito, aberta em produção,
é convite a ruído e a abuso. Por isso a chave `SENTRY_TESTE_HABILITADO`, `false` por padrão —
liga-se para diagnosticar e desliga-se depois.

**Testar só com um teste automatizado.** Descartado: o teste prova o código _daqui_. O que
apodrece em silêncio é o caminho até a instância — DNS, TLS, certificado próprio, quota, rede do
compose. Isso só se prova mandando um evento de verdade, e por isso a CLI existe e **sai com código
diferente de zero** quando não confirma a entrega.

## Consequências

- **Observabilidade é integração de primeira classe**, como o email (D-07): adaptador no código,
  configuração no ambiente, credencial nunca versionada.
- **Uma dependência operacional nova que é sua:** a instância self-hosted precisa de upgrade,
  retenção e disco. Ela não está neste repositório e não é provada por gate nenhum daqui — o gate
  prova que o produto **funciona com ela vazia**, que é o contrato que este repositório assina.
- **`SENTRY_TESTE_HABILITADO` é chave de diagnóstico em produção.** Ligada, existe uma rota que
  estoura de propósito. Ligue para diagnosticar, desligue depois.
- **Source map é opt-in duplo:** `SENTRY_AUTH_TOKEN` no build **e** `'@sentry/cli': true` no
  `pnpm-workspace.yaml`. Sem os dois, o build passa e o stack trace do front chega minificado.
- O endpoint de diagnóstico **entra no contrato** (`openapi.json` e `packages/contrato`), como toda
  rota deste projeto (D-03). Rota que não se registra não existe.
