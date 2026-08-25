# Playbook — gerar o `GOOGLE_CLIENT_ID`

> Como obter a credencial que liga o **"Entrar com Google"** (EF-01) e onde colocá-la.
> A decisão de que configuração vem do ambiente, nunca de arquivo versionado, é de
> [D-07](../../docs/decisoes/D-07-ambiente-e-segredos.md).

**Tempo:** ~10 minutos. **Precisa de:** uma conta Google e permissão para criar projeto no
Google Cloud Console.

---

## O que estamos gerando, e por que só isso

O produto usa o **Google Identity Services (GIS)**: o navegador abre a tela do Google, recebe um
**ID token** e manda esse token para a nossa API, que o verifica com o Google
(`api/src/modulos/familia/google.ts`).

Disso decorrem duas coisas que economizam confusão no console:

|                                           |                                                                                                                             |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Um client id só**, usado nos dois lados | O front assina o pedido com ele; a API o usa como **audiência** na verificação. Se fossem dois, todo token seria recusado   |
| **Não precisamos do _client secret_**     | Ele existe no fluxo de _authorization code_, que não é o nosso. Se o console te mostrar um, **não** copie para lugar nenhum |

> ⚠️ O **client id não é segredo** — ele viaja no HTML para o navegador, por construção. O que
> nunca pode ser commitado é o _client secret_ (que aqui nem é usado) e qualquer outra credencial.
> O scanner do pre-commit bloqueia; ainda assim, `.env` é ignorado pelo Git e é onde o valor mora.

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

No `.env` da raiz (ignorado pelo Git — veja `.env.example` para o nome da chave):

```bash
GOOGLE_CLIENT_ID=000000000000-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
```

Uma variável só alimenta os dois lados:

| Quem  | Como lê                                                                                                  |
| ----- | -------------------------------------------------------------------------------------------------------- |
| API   | `ambiente.GOOGLE_CLIENT_ID` (`api/src/config/ambiente.ts`) — audiência da verificação                    |
| Front | `runtimeConfig.public.googleClientId` (`web/nuxt.config.ts`), a partir de `process.env.GOOGLE_CLIENT_ID` |

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

Depois: abra `http://localhost:3001/entrar` e clique em **Google**. Com o login concluído, o log
mostra a requisição e quem entrou:

```
[http] POST  /sessoes/google 201 · 180.3ms · anônimo
```

---

## ⚠️ Ainda falta fiação para a stack de prova e produção

Hoje `GOOGLE_CLIENT_ID` **não é repassado** para nenhum serviço do `docker-compose.yml`. Ou seja:
o passo acima faz o Google funcionar em **dev**, mas na stack que o gate prova (e num deploy real)
o botão continua inerte, porque nem a API nem o front recebem a variável.

Para fechar isso, `docker-compose.yml` precisa de duas linhas — no serviço `api`:

```yaml
GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}
```

e no serviço `web` (o Nuxt aceita sobrescrever `runtimeConfig.public` em tempo de execução pelo
prefixo `NUXT_PUBLIC_`, então **não** é preciso reconstruir a imagem):

```yaml
NUXT_PUBLIC_GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}
```

Está registrado como lacuna `EF01-MC-002` em
[MC-01](../../docs/especificacoes/MC-01-familia-e-acesso.md), junto do fato de que o caminho feliz
do Google **nunca roda no gate** — sem credencial no ambiente de prova, só o caminho "vazio" é
exercitado automaticamente.

---

## Quando não funcionar

| Sintoma                                                      | Causa quase sempre                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Error 400: origin_mismatch`                                 | A origem do navegador não está em **Origens JavaScript autorizadas**. Compare esquema/host/porta caractere a caractere                                                                                                                                                         |
| Nada acontece; no console do navegador, erro do `gsi/client` | Client id vazio ou errado — confira o banner (`google ligado`) e o valor no `.env`                                                                                                                                                                                             |
| "O Google não mostrou a tela de entrada. Tente de novo."     | Mensagem **nossa** (`useGoogle.ts`), disparada quando o GIS suprime o _One Tap_: cookies de terceiros bloqueados, modo anônimo, ou dispensas seguidas colocaram o prompt em espera. Teste noutro perfil do navegador ou libere cookies de terceiros para `accounts.google.com` |
| Login do Google conclui, mas a API responde 401              | Audiência divergente: o client id do front não é o mesmo que a API está usando. É uma variável só — reinicie os dois depois de mudá-la                                                                                                                                         |
| `access_blocked` / "app não verificado"                      | O app está em `Testing` e o email não está em **Usuários de teste**                                                                                                                                                                                                            |
| Entrou com Google e caiu numa conta diferente da de senha    | Não é bug: pelo RN-04 (EF-01), **mesmo email** resolve para o mesmo `Membro`. Emails diferentes são pessoas diferentes, por definição                                                                                                                                          |

---

## Revogar / trocar

Console → **Credenciais** → o client id → **Excluir**, ou gere outro e troque o valor no `.env`.
Como o client id é público e sem segredo associado neste fluxo, o estrago de um vazamento é
limitado: sem uma origem autorizada, ele não autentica ninguém. Ainda assim, restrinja as origens
ao mínimo — é a única coisa que o protege.
