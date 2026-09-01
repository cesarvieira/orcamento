# Playbook — Sentry self-hosted

> Como ligar a observabilidade deste produto e, principalmente, **como provar a qualquer momento
> que ela está viva**. A decisão de que é self-hosted, dirigido por DSN e inerte por padrão é de
> [D-08](../../docs/decisoes/D-08-observabilidade.md); a de que credencial vive no ambiente é de
> [D-07](../../docs/decisoes/D-07-ambiente-e-segredos.md).

**Precisa de:** uma instância do Sentry de pé (ver abaixo) e permissão para criar projeto nela.
**Tempo:** ~10 minutos para ligar, se a instância já existe.

---

## O que este repositório NÃO faz

**Ele não sobe o Sentry.** O `docker-compose.yml` daqui é o artefato de deploy que o gate
`deploy-fresh` prova do zero; o `getsentry/self-hosted` são ~20 contêineres (Kafka, ClickHouse,
Snuba, Relay, Redis) e pede na faixa de 4 vCPU / 16 GB. Enfiá-lo ali destruiria justamente a
propriedade que dá valor ao gate.

**Este repositório consome um DSN.** A instância é infraestrutura sua, com ciclo de vida próprio:

```bash
git clone https://github.com/getsentry/self-hosted
cd self-hosted && ./install.sh && docker compose up -d
```

> Se manter isso de pé se mostrar caro demais, o **GlitchTip** fala o mesmo protocolo dos SDKs e
> roda com Django + Postgres + Redis. Trocar é mudar o DSN — nenhuma linha de código daqui muda.
> A alternativa está registrada na D-08 com o motivo.

---

## Ligar

Na instância, crie **dois projetos** — um Node (a API) e um Vue/Nuxt (o front). Dois, e não um, de
propósito: erro de front e erro de back se investigam, se atribuem e se silenciam de formas
diferentes. Copie o DSN de cada um.

No `.env` (que é gitignored — nenhum destes valores entra em arquivo versionado):

```bash
SENTRY_DSN=https://<chave>@sentry.exemplo.com.br/2
NUXT_PUBLIC_SENTRY_DSN=https://<chave>@sentry.exemplo.com.br/3
SENTRY_ORG=<slug-da-org>
```

O primeiro é o projeto da API; o segundo, o do front; o terceiro serve só para o `sentry:teste`
montar o link direto do evento.

Suba de novo. A API imprime no banner de dev o que resolveu:

```
sentry        ligado · ambiente=development · teste=desligado
```

Se disser `desligado (SENTRY_DSN vazio — nada sai desta máquina)`, a variável não chegou ao
processo. É o erro mais comum, e o banner existe para você descobri-lo em dois segundos.

---

## Como testar, a qualquer momento

São **três portas**, e elas provam coisas diferentes. Nenhuma depende de haver incidente.

### Porta 1 · CLI — a que funciona sempre

Não precisa de stack no ar, não precisa de chave ligada, não precisa de navegador.

```bash
pnpm --filter @orcamento/api run sentry:teste
```

Saída esperada:

```
[sentry-teste] dsn      https://***@sentry.exemplo.com.br/2
[sentry-teste] ambiente development
[sentry-teste] release  <vazio>
[sentry-teste] enviado  mensagem event_id=9f2c1b7e4a3d4c9f8b1a6e0d5c4b3a29
[sentry-teste] enviado  exceção  event_id=1a7d3f90c2b84e15a6d0e9f4b3c2a180
[sentry-teste] veja     https://sentry.exemplo.com.br/organizations/<org>/issues/?query=1a7d...
```

**O código de saída é o veredito**: `0` só quando o `flush` confirmou a entrega; `1` com o DSN
vazio, e `1` quando a instância não respondeu em 5 segundos. É o que torna esta porta usável em
script e em CI.

Dentro do contêiner, contra a stack de prova ou a de produção:

```bash
docker compose exec api node dist/scripts/sentry-teste.js
```

### Porta 2 · Endpoint — prova a fiação do erro não tratado

Ligue a chave (`SENTRY_TESTE_HABILITADO=true` para a API; no compose, `up -d` de novo):

```bash
curl -s http://localhost:3000/diagnostico/sentry
```

```json
{ "ligado": true, "ambiente": "development", "eventId": "9f2c1b7e4a3d4c9f8b1a6e0d5c4b3a29" }
```

E o caso que de fato importa — um erro que ninguém tratou, percorrendo o mesmo caminho que um bug
percorreria:

```bash
curl -i "http://localhost:3000/diagnostico/sentry?modo=erro"
```

```
HTTP/1.1 500 Internal Server Error
{"erro":"erro_interno","mensagem":"Algo quebrou aqui dentro. Tente de novo."}
```

**As duas coisas ao mesmo tempo são o teste:** a resposta chega na forma `Erro` do contrato, sem
uma palavra do erro interno, **e** o evento com o stack completo aparece na instância, agrupado
como `ErroDeTesteDoSentry`.

Com a chave desligada — o default, inclusive em produção — os dois devolvem `404 nao_encontrado`,
o mesmo de qualquer caminho inexistente. **Desligue depois de diagnosticar.**

### Porta 3 · Tela — prova o navegador e o SSR

Ligue `NUXT_PUBLIC_SENTRY_TESTE_HABILITADO=true` e abra, já logado:

```
http://localhost:3001/mais/diagnostico
```

A tela não está na tab bar nem na sidebar de propósito — não é tela de produto. Ela tem quatro
botões, e cada um prova um caminho diferente:

| Botão                    | O que prova                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| **Mandar um evento**     | o SDK do navegador alcança a instância — mostra o `event_id` na própria tela                               |
| **Quebrar no navegador** | a captura AUTOMÁTICA: um erro que ninguém tratou, pelo tratador do Vue                                     |
| **Quebrar no SSR**       | o SDK do servidor — é um link de verdade, porque só um carregamento completo passa pelo render do servidor |
| **Quebrar na API**       | o trajeto inteiro: front → API → instância                                                                 |

Desligada, a rota devolve 404 como qualquer outra que não existe.

---

## Quando não chega evento

| Sintoma                                   | Causa provável                                                                                    | O que fazer                                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Banner diz `desligado (SENTRY_DSN vazio)` | a variável não chegou ao processo                                                                 | no compose, confira o repasse no serviço; fora dele, confira qual `.env` o `NODE_ENV` está carregando |
| `sentry:teste` sai `1` no flush           | instância inalcançável, ou TLS recusado                                                           | `curl -v https://sentry.exemplo.com.br/_health/` de dentro do MESMO contêiner                         |
| `unable to verify the first certificate`  | certificado próprio na instância                                                                  | `NODE_EXTRA_CA_CERTS=/caminho/da/ca.pem` no ambiente do processo                                      |
| A API manda, o navegador não              | bloqueador de anúncio, ou DSN público apontando para host que só existe dentro da rede do compose | o `NUXT_PUBLIC_SENTRY_DSN` precisa de um host que o NAVEGADOR alcance                                 |
| O endpoint devolve 404 com a chave ligada | `SENTRY_TESTE_HABILITADO` foi posto como `1` ou `yes`                                             | o valor é `true` ou `false`, literalmente — qualquer outro derruba a API com erro claro já na subida  |
| Evento chega sem linha de código          | source map não subiu                                                                              | ver a seção abaixo                                                                                    |

---

## Source map do front — opt-in DUPLO

Sem source map, o stack trace do navegador chega minificado. Ligar são **duas** coisas, e uma sem
a outra não funciona:

1. `'@sentry/cli': true` no `pnpm-workspace.yaml`, e `pnpm install` de novo — o binário que sobe o
   mapa não é instalado por padrão (todo worktree novo pagaria o download por nada).
2. No ambiente do **build**:

```bash
SENTRY_URL=https://sentry.exemplo.com.br
SENTRY_ORG=<slug-da-org>
SENTRY_PROJETO=<slug-do-projeto-do-front>
SENTRY_AUTH_TOKEN=<token com escopo project:releases>
SENTRY_RELEASE=<o SHA do commit>
```

O `SENTRY_AUTH_TOKEN` é o único valor deste playbook que é **segredo de verdade**: ele escreve na
sua instância. Sem ele o build passa normalmente, sem mapa e sem upload — de propósito, para que a
ausência do Sentry nunca quebre um build.

---

## O que NUNCA sai daqui

`sendDefaultPii: false` e uma limpeza que apaga o valor de todo campo cujo nome case com
`senha · password · secret · segredo · token · authorization · cookie · api-key`, em qualquer
profundidade, em cabeçalho, corpo, query string e migalha de navegação.

Isso não é polimento: sem ela, o primeiro 500 numa rota de login manda a senha de alguém, e o
primeiro 500 em rota autenticada manda o cookie de sessão — que é a sessão inteira.

São **duas** implementações irmãs, porque são dois processos com SDKs diferentes, e elas precisam
mover-se juntas:

- `api/src/instrumentacao.ts` — provada em `api/testes/sentry.teste.ts`
- `web/app/utils/limpeza-de-evento.ts` — provada em `web/app/utils/limpeza-de-evento.teste.ts`

O stack trace **não** é limpo, de propósito: é lá que mora o valor do evento.
