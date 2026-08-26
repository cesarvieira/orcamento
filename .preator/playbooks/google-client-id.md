# Playbook — gerar o `GOOGLE_CLIENT_ID`

> Como obter a credencial que liga o **"Entrar com Google"** (EF-01) e onde colocá-la.
> A decisão de que configuração vem do ambiente, nunca de arquivo versionado, é de
> [D-07](../../docs/decisoes/D-07-ambiente-e-segredos.md).

**Tempo:** ~10 minutos. **Precisa de:** uma conta Google e permissão para criar projeto no
Google Cloud Console.

---

## O que estamos gerando, e por que só isso

O produto usa o **Google Identity Services (GIS)** no fluxo de **código de autorização**: o
navegador abre o popup do Google, recebe um **código de uso único** e o manda para a nossa API,
que o troca por um ID token junto ao Google e verifica esse token
(`api/src/modulos/familia/google.ts`).

> **Mudou em 2026-08-26.** Antes era _One Tap_ (`google.accounts.id.prompt`), que devolvia o ID
> token direto ao navegador e **dispensava o client secret**. One Tap só aparece para quem já tem
> sessão Google aberta — quem não tem recebia _"not signed in with the identity provider"_ e ficava
> sem caminho para entrar. Se você leu este playbook antes desta data, a diferença que importa é:
> **agora o client secret é necessário.**

Disso decorrem duas coisas que economizam confusão no console:

|                                           |                                                                                                                             |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Um client id só**, usado nos dois lados | O front assina o pedido com ele; a API o usa como **audiência** na verificação. Se fossem dois, todo token seria recusado   |
| **O _client secret_ é necessário**        | É com ele que a API troca o código por um ID token. Copie do console para `GOOGLE_CLIENT_SECRET`, **só** no ambiente da API |

> ⚠️ Os dois valores têm naturezas opostas. O **client id não é segredo** — viaja no HTML para o
> navegador, por construção. O **client secret é**, e nunca pode sair do lado servidor: nada de
> `NUXT_PUBLIC_*`, nada de commit. O scanner do pre-commit bloqueia; ainda assim, `.env` é ignorado
> pelo Git e é onde os valores moram. Suspeitou de exposição? Rotacionar no console é barato e
> imediato.

---

## Passo a passo no Google Cloud Console

> A interface do console muda de nome e de lugar com frequência. Os **nomes dos campos** abaixo
> são o que importa; se o menu mudou, procure pelo campo, não pelo caminho.

### 1 · Projeto

<https://console.cloud.google.com/> → seletor de projeto no topo → **Novo projeto**.
Nome livre (ex.: `orcamento-familiar`). Se já existe um projeto para este produto, use-o.

### 2 · Tela de consentimento (OAuth consent screen / Branding)

**APIs e serviços → Tela de permissão OAuth.**

| Campo                                       | O que pôr                                                                                                |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Tipo de usuário                             | **Externo** — a família não está num Google Workspace nosso                                              |
| Nome do app                                 | `Orçamento Familiar` — é o que aparece na tela do Google                                                 |
| Email de suporte / contato do desenvolvedor | o seu                                                                                                    |
| Escopos                                     | **nenhum a mais.** Precisamos só de identidade (`openid`, `email`, `profile`), que o GIS já pede sozinho |

**Enquanto o app estiver em `Testing`**, só entram os emails cadastrados em **Usuários de teste** —
inclusive o seu. Adicione ali cada pessoa que for testar, ou o login falha sem explicação óbvia.
Publicar (`In production`) só é necessário para abrir a terceiros; para uso da própria família,
`Testing` basta.

### 3 · Credencial

**APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth.**

- **Tipo de aplicativo:** `Aplicativo da Web`
- **Origens JavaScript autorizadas** — é **este** o campo que importa:

  | Ambiente              | Origem                                                        |
  | --------------------- | ------------------------------------------------------------- |
  | dev (`pnpm dev`)      | `http://localhost:3001`                                       |
  | stack de prova (gate) | `http://localhost:3011`                                       |
  | produção              | a origem real do front (ex.: `https://orcamento.exemplo.com`) |

- **URIs de redirecionamento autorizados:** deixe **vazio**. Nosso fluxo não redireciona — o token
  chega por callback JavaScript. Preencher aqui não quebra nada, só não serve para nada.

Salve e copie o **ID do cliente**. Ele termina em `.apps.googleusercontent.com`.

> A origem tem de bater **exata**: esquema, host e porta. `http://localhost:3001` e
> `http://127.0.0.1:3001` são origens **diferentes** para o Google, e `https` não vale por `http`.

---

## Onde colocar o valor

Em **desenvolvimento**, as duas linhas vão no `.env.dev` da raiz (ignorado pelo Git — veja
`.env.example` para os nomes das chaves):

```bash
GOOGLE_CLIENT_ID=000000000000-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx
```

| Quem  | Como lê                                                      | O que recebe       |
| ----- | ------------------------------------------------------------ | ------------------ |
| API   | `ambiente.GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`         | os **dois**        |
| Front | `runtimeConfig.public.googleClientId` (`web/nuxt.config.ts`) | **só o client id** |

> ⚠️ **O Nuxt não lê o `.env` da raiz.** Ele carrega o do `rootDir` dele, que neste monorepo é
> `web/` — medido: uma variável posta só na raiz **não** chegava ao front. Por isso o script de dev
> é `nuxt dev --port 3001 --dotenv ../.env.dev`, apontando explicitamente para o arquivo da raiz.
> Assim o valor mora num lugar só. Na stack do compose isso não se aplica: lá cada serviço recebe
> o que precisa pelo `docker-compose.yml`.

> 🔒 **O secret nunca vai para o front.** No compose ele é entregue só ao serviço `api`. Se algum
> dia aparecer um `NUXT_PUBLIC_GOOGLE_CLIENT_SECRET`, é bug de segurança, não conveniência.

---

## Conferir que pegou

```bash
pnpm dev
```

No banner da API, a última linha deve virar:

```
google        ligado
```

Se ainda disser `desligado (GOOGLE_CLIENT_ID vazio — o botão fica inerte no front)`, o `.env` não
foi lido: confira que o arquivo é o da **raiz** do monorepo e que você reiniciou o `pnpm dev`
(a variável é lida na subida, não a cada requisição).

> O banner prova só o lado da **API**. Se ele disser `ligado` e mesmo assim o botão continuar
> inerte, o front subiu sem a flag `--dotenv ../.env.dev` — confira o script `dev` de
> `web/package.json` e reinicie.

Depois: abra `http://localhost:3001/entrar` e clique em **Google**. Com o login concluído, o log
mostra a requisição e quem entrou:

```
[http] POST  /sessoes/google 201 · 180.3ms · anônimo
```

---

## Na stack de prova e em produção

O `docker-compose.yml` repassa a mesma variável para os dois serviços — uma só no seu ambiente,
dois destinos:

| Serviço | Variável no container          | Vem de                  |
| ------- | ------------------------------ | ----------------------- |
| `api`   | `GOOGLE_CLIENT_ID`             | `${GOOGLE_CLIENT_ID:-}` |
| `web`   | `NUXT_PUBLIC_GOOGLE_CLIENT_ID` | `${GOOGLE_CLIENT_ID:-}` |

Basta ter `GOOGLE_CLIENT_ID` no ambiente (ou no `.env`, que o compose lê) na hora do
`docker compose up`. **Trocar a credencial não pede rebuild da imagem:** `NUXT_PUBLIC_*`
sobrescreve `runtimeConfig.public` em tempo de execução — medido, servindo o `/entrar` do
container e conferindo o valor no HTML.

> Se as duas divergirem, **todo login por Google falha com 401**: o front assina com um client id
> e a API espera outro como audiência. Por isso as duas saem da mesma variável.

**O padrão continua sendo desligado.** Sem `GOOGLE_CLIENT_ID` no ambiente, as duas chegam vazias,
o botão fica inerte e o resto do app funciona igual — é assim que o gate roda. O que **não** é
coberto por gate é o caminho feliz do Google (exige credencial real e interação com o Google):
lacuna `EF01-MC-002` em [MC-01](../../docs/especificacoes/MC-01-familia-e-acesso.md).

---

## Quando não funcionar

| Sintoma                                                      | Causa quase sempre                                                                                                                     |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `Error 400: origin_mismatch`                                 | A origem do navegador não está em **Origens JavaScript autorizadas**. Compare esquema/host/porta caractere a caractere                 |
| Nada acontece; no console do navegador, erro do `gsi/client` | Client id vazio ou errado — confira o banner (`google ligado`) e o valor no `.env`                                                     |
| "Entrada com Google cancelada."                              | Mensagem **nossa** (`useGoogle.ts`): o popup foi fechado ou o consentimento recusado. Não é defeito                                    |
| "Não consegui abrir a entrada com Google. Tente de novo."    | Mensagem **nossa**: o GIS não conseguiu abrir o popup — bloqueador de pop-ups é a causa mais comum                                     |
| `Not signed in with the identity provider`                   | Sintoma do fluxo ANTIGO (One Tap), removido em 2026-08-26. Se aparecer, o front está desatualizado                                     |
| API responde `codigo_google_invalido`                        | A troca do código falhou na API: `GOOGLE_CLIENT_SECRET` ausente ou errado, ou o código já foi usado (é de uso único)                   |
| Login do Google conclui, mas a API responde 401              | Audiência divergente: o client id do front não é o mesmo que a API está usando. É uma variável só — reinicie os dois depois de mudá-la |
| `access_blocked` / "app não verificado"                      | O app está em `Testing` e o email não está em **Usuários de teste**                                                                    |
| Entrou com Google e caiu numa conta diferente da de senha    | Não é bug: pelo RN-04 (EF-01), **mesmo email** resolve para o mesmo `Membro`. Emails diferentes são pessoas diferentes, por definição  |

---

## Revogar / trocar

Console → **Credenciais** → o client id → **Excluir**, ou gere outro e troque o valor no `.env`.
Como o client id é público e sem segredo associado neste fluxo, o estrago de um vazamento é
limitado: sem uma origem autorizada, ele não autentica ninguém. Ainda assim, restrinja as origens
ao mínimo — é a única coisa que o protege.
