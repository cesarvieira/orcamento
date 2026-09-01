# D-09 — Deploy em produção: uma imagem, dois subdomínios, e o release que vem do build

- **Status:** proposta
- **Data:** 2026-09-01

## Contexto

Este produto nunca esteve no ar. Existe um artefato de deploy provado do zero por gate
([D-02](D-02-dois-composes.md)) e não existe endereço público nenhum. A decisão é sobre como um vira
o outro.

Quatro restrições reais moldaram o que segue. Nenhuma delas é preferência.

**1 · A topologia de domínio não é livre — quem a decide é o cookie.** A sessão é `SameSite=Lax`
(`api/src/modulos/familia/sessao-servico.ts:189`), e a regra do cookie é **site**, não origem: site
é esquema + domínio registrável. Isso já foi **medido** e o resultado está registrado no
`.env.example`, simulando a topologia com `*.localhost`:

| Front → API                                           | Resultado                |
| ----------------------------------------------------- | ------------------------ |
| `app.orcamento.localhost` → `api.orcamento.localhost` | login 201, sessão 200 ✅ |
| `orcamento.localhost` → `localhost`                   | login 201, sessão 401 ❌ |

Ou seja: subdomínios irmãos funcionam, domínios registráveis diferentes não. Escolher hospedagem sem
olhar para isto é escolher o arranjo em que a pessoa entra e a requisição seguinte já não a conhece.

**2 · O servidor não é folha em branco.** É um Ubuntu com Portainer e um Traefik já no ar terminando
TLS para outras coisas. A decisão precisa caber nele, não pedir que ele seja reconstruído.

**3 · O build de produção não cabe no servidor.** O artefato do front é um build de monorepo —
`pnpm install` do workspace inteiro, `tsc`, Vite. Buildar isso na máquina de produção a cada deploy
põe toolchain, lockfile e código-fonte lá dentro, e transforma rollback em "buildar de novo o commit
velho".

**4 · Os defaults do compose foram desenhados para o gate, e em produção são armadilha.** Até hoje o
`docker-compose.yml` teve uma audiência só: o gate, que precisa subir com zero configuração. Daí
`SEMEAR` ter default `true` — o que em produção semeia a família de teste (`ana@exemplo.test`) no
banco real — e `SESSAO_SEGREDO` apenas **avisar** quando está com o valor de desenvolvimento
(`api/src/config/ambiente.ts:151`), em vez de recusar subir. Dar um endereço público ao artefato sem
mexer nisso é publicar as armadilhas junto.

## Decisão

**O front é `app.cesarvieira.dev` e a API é `api.cesarvieira.dev`. A imagem é construída uma vez no
CI, publicada no GHCR, e é ela — a mesma que o gate prova — que roda em produção.**

Cinco partes, e as cinco são a decisão:

**1 · Subdomínios irmãos, por imposição do cookie.** `app.cesarvieira.dev` e `api.cesarvieira.dev`.
Não é escolha estética: é a única topologia de dois hosts que a restrição da seção anterior permite.
O `ORIGEM_WEB` aponta para o front em `https://`, que é também o que faz o cookie virar `Secure` — a
condição está no mesmo `sessao-servico.ts:189`.

**2 · A imagem é o release, e se constrói uma vez.** O GitHub Actions builda `api` e `web` e publica
em `ghcr.io/cesarvieira/orcamento-{api,web}` com **duas tags**: `latest`, que se move, e
`sha-<commit>`, que não. A tag imutável é o que torna rollback possível; sem ela, "voltar" é
rebuildar.

**3 · Um artefato, mais um overlay de roteamento.** O `docker-compose.yml` ganha `image:` **ao
lado** do `build:` que já tem. Local e no gate, `up -d --build` continua buildando e apenas passa a
taggear — `deploy-fresh` prova o mesmo artefato de sempre. No servidor a imagem vem do registry e o
`up` não builda. O que é **só** de produção — labels do Traefik, rede externa do proxy, nenhuma
porta publicada — vive num `docker-compose.producao.yml` aplicado por cima.

**4 · O Actions publica; o Portainer puxa.** O workflow dispara um webhook do Portainer, que re-puxa
as imagens e sobe o stack. Não existe chave SSH. E o job **verifica**:
`GET https://api.cesarvieira.dev/health` em retry até responder, senão falha. Deploy disparado não é
deploy provado — é a mesma régua do Portão B aplicada à publicação.

**5 · O release é o SHA, cravado na imagem no build.** O `SENTRY_RELEASE` da API e o do front entram
como `ARG`/`ENV` no build, onde o SHA é conhecido. O env do stack vira override opcional, não a
fonte.

## O que esta decisão muda em decisões anteriores

Três decisões vigentes ficam com um fato a menos ou a mais. Registrado aqui porque fato que muda e
não se reescreve vira mentira com carimbo de aceito.

**[D-02](D-02-dois-composes.md) continua valendo, e ganha uma nota.** Os composes continuam dois, e
o de produção continua sendo o único alvo de gate. O `docker-compose.producao.yml` **não é um
terceiro compose**: não sobe serviço nenhum sozinho, não é alvo de gate, e não contém uma linha de
configuração de aplicação — só roteamento. A tabela da D-02 segue correta.

**[D-08](D-08-observabilidade.md) tem uma consequência que muda de estado.** Ela registra que source
map é **opt-in duplo** — `SENTRY_AUTH_TOKEN` no build e `'@sentry/cli': true` no
`pnpm-workspace.yaml` — e que sem os dois o stack trace do front chega minificado. O mecanismo
continua idêntico; o que muda é que, a partir daqui, **os dois estão ligados**, e o custo que o
comentário do `pnpm-workspace.yaml` descrevia como evitado passa a ser pago (ver Consequências).

**[D-07](D-07-ambiente-e-segredos.md) ganha uma borda mais afiada.** "Credencial nunca em arquivo
versionado" passa a ler-se também como **credencial nunca em `ARG` de build**: um `ARG` fica no
histórico de camada da imagem, e imagem é artefato distribuído — pior que arquivo versionado, porque
viaja para fora do repositório. O `SENTRY_AUTH_TOKEN` entra por _secret mount_ do BuildKit.

## Alternativas consideradas

**SSH do Actions para o servidor.** Descartado: exige uma chave privada com acesso ao servidor
guardada no GitHub. O webhook alcança o mesmo resultado com uma URL cujo poder é estritamente
"redeployar este stack" — e a diferença importa no dia em que um segredo vaza.

**GitOps por polling do Portainer.** Descartado: o deploy deixa de ser um evento com hora, autor e
log, e some o lugar onde pendurar a verificação do `/health`. Publicar é ação; ação sem registro não
se audita.

**Buildar no servidor.** Descartado por três motivos somados: põe toolchain e fonte na máquina de
produção, torna cada deploy lento, e faz rollback significar "rebuildar o commit velho" em vez de
"apontar para a imagem que já existe".

**Um terceiro compose autônomo, só com `image:` e sem `build:`.** É a saída óbvia e foi descartada:
ela duplica os blocos `environment:` dos quatro serviços. Duplicata envelhece em silêncio — no dia
em que uma variável entra num arquivo e não no outro, o gate continua verde e a produção sobe sem
ela. O overlay carrega só o que o gate **não** deve ter.

**Labels do Traefik direto no `docker-compose.yml`.** Descartado por motivo mecânico, não de gosto:
rede externa **não é condicional** em compose. O arquivo que o gate roda passaria a exigir um
Traefik na máquina de quem prova, e o gate falharia em toda máquina que não fosse aquele servidor.

**Mesma origem, com a API atrás de `/api`.** Resolve o cookie tão bem quanto. Descartado porque
acrescenta uma regra de reescrita de path no proxy — mais uma peça entre o navegador e a API, que
falha em silêncio e cujo sintoma (404 numa rota que existe) não aponta para ela.

**Front e API em domínios registráveis diferentes** — o arranjo de hospedagens separadas. Descartado
**por medição**, não por gosto: o cookie não viaja (ver Contexto). Salvá-lo exigiria
`SameSite=None` + `Secure`, que é afrouxar uma defesa contra CSRF por conveniência de hospedagem.
Decisão de segurança não se toma como efeito colateral de escolha de fornecedor.

**Deixar o `SENTRY_RELEASE` ser digitado no env do stack.** Descartado: o release é o SHA e muda a
cada deploy; digitado à mão ele congela no primeiro valor e passa a mentir. **Release errado é pior
que release vazio** — agrupa erro novo dentro de versão velha e faz a tela de regressão apontar para
o lugar errado.

**Não subir source map do front.** Era o default e foi considerado: mantém zero segredo de build no
GitHub e o `@sentry/cli` fora do `pnpm install`. Descartado por decisão do humano em 2026-09-01 —
stack trace minificado é diagnóstico pela metade, e a #114 existiu justamente para não ter
diagnóstico pela metade. O custo está registrado abaixo.

## Consequências

- **O que o gate prova e o que roda em produção são a mesma imagem.** É a propriedade que a D-02
  defende, agora estendida até o ar.
- **Rollback é trocar uma variável** — a tag da imagem para o `sha-` anterior — e redeployar. Não é
  `git revert`, não é rebuild, e não depende de o CI estar de pé.
- **Segredo de produção passa a viver em dois lugares, divididos por tempo e não por importância:**
  os de **build** (Sentry — auth token, URL da instância, projeto) nos secrets do GitHub Actions; os
  de **runtime** (banco, sessão, Google, DSNs) apenas no env do stack, no servidor. Isto **corrige**
  o que se supôs antes de escrever esta decisão: não é verdade que o GitHub fique sem nenhum segredo
  de produção.
- **A URL do webhook é credencial.** Quem a tem redeploya o stack. Ela é secret do Actions como
  qualquer outro.
- **Todo `pnpm install` deste monorepo passa a baixar o `@sentry/cli`** (~20 MB), inclusive em cada
  worktree que o condutor abre. Era exatamente o custo que o comentário do `pnpm-workspace.yaml`
  evitava; agora é pago de propósito, em troca de stack trace legível do front. O comentário de lá é
  reescrito junto.
- **Os `.map` não podem entrar na imagem.** `sourcemap: 'hidden'` gera os arquivos e o
  `web/Dockerfile` copia o `.output` inteiro — sem `filesToDeleteAfterUpload`, ligar o upload
  publica o código-fonte do front para quem adivinhar a URL. O risco está descrito em
  `web/nuxt.config.ts:117`; ligar o upload sem fechá-lo o concretiza.
- **O compose deixa de ter defaults inocentes.** `SEMEAR` e `SESSAO_SEGREDO` passam a **derrubar** o
  processo sob `NODE_ENV=production`. O preço é que uma stack de produção mal configurada não sobe —
  e é precisamente o que se quer: subir errado em silêncio é o modo de falha caro.
- **O Traefik e a instância do Sentry não são provados por gate nenhum daqui.** Mesmo contrato que a
  D-08 assinou: o gate prova que o produto funciona **sem** eles; operá-los é assunto de playbook.
- **Nada nesta decisão cobre perda de dado.** Backup e restore são a história #117, e a dependência
  é dura: enquanto ela estiver aberta, `app.cesarvieira.dev` é ambiente de verificação, não de uso.
