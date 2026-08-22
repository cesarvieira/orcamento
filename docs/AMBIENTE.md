# Ambiente, execução e gates

> Como subir, como configurar e como provar. Convenções de código em [PADROES.md](PADROES.md).

---

## Portas

| Serviço | Porta | Base |
|---|---|---|
| API | `3000` | `http://localhost:3000` |
| WebSocket | `3000` | `ws://localhost:3000/realtime` |
| Front (Nuxt) | `3001` | `http://localhost:3001` |
| PostgreSQL | `5432` | |

O WebSocket compartilha a porta da API de propósito ([ADR-007](decisoes/ADR-007-tempo-real-por-websocket.md)):
`API_BASE` já descreve o endpoint, não há variável de ambiente nova, e o proxy é um só. A sessão
em cookie `httpOnly` viaja no handshake do upgrade — a autenticação do socket é a mesma da REST.

---

## Os dois composes

Não é redundância — os dois existem por motivos diferentes, e o segundo é o que faz o Portão B
valer alguma coisa.

| Arquivo | Sobe | Para quê |
|---|---|---|
| `docker-compose.dev.yml` | só PostgreSQL | Seu loop de desenvolvimento. `api` e `web` rodam em `npm run dev` por cima. |
| `docker-compose.yml` | PostgreSQL + `api` + `web` | **O artefato de deploy.** Imagens de produção. É o que os gates usam e o que roda em produção. |

```bash
# desenvolver
docker compose -f docker-compose.dev.yml up -d

# provar (o que o gate faz)
docker compose up -d --build
```

A doutrina exige que a tela abra *no artefato de deploy, não no dev-build*. Se os gates rodassem
contra `npm run dev`, eles provariam um artefato que ninguém publica — o selo pareceria verde e
não significaria nada. Ver [ADR-001](decisoes/ADR-001-stack-e-infraestrutura.md).

---

## Variáveis de ambiente

`.env` e `.env.*` são ignorados pelo Git; `.env.example` é versionado. **O exemplo carrega os
nomes das chaves, nunca os valores.**

```bash
# banco
DATABASE_URL=postgresql://...

# auth
AUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# email — o provedor é escolha de ambiente, não de código
MAIL_DRIVER=log              # log | smtp | resend | ses
MAIL_FROM=
MAIL_API_KEY=
SMTP_HOST=  SMTP_PORT=  SMTP_USER=  SMTP_PASS=

# parâmetros de negócio
CONVITE_TTL_HORAS=72         # RN-CVT-002 — parâmetro, não regra
```

### Por que `MAIL_DRIVER=log` importa

Sem ele, todo teste de integração de convite mandaria email de verdade. Com ele o teste roda
offline. Vale a distinção: **fingir o envio é legítimo, fingir o convite não é.** O teste tem
que provar que o convite foi persistido, que o token valida, que expira e que RN-CVT-001 recusa
email divergente. O que se dispensa é só o SMTP.

Ver [ADR-005](decisoes/ADR-005-acesso-familiar-e-convite.md) para o raciocínio completo.

### Credenciais nunca entram no `preator-perfil.sh`

O perfil é o contrato com a fábrica: comandos, caminhos e portas. Credencial, token e string de
conexão vivem no ambiente. O hook `.githooks/pre-commit` roda o scanner de segredos da fábrica
e bloqueia o commit se algo escapar.

---

## Os gates

Build verde não fecha nada. O que fecha é o carimbo:

```bash
bash preator/esteira/gates/prova-comportamento.sh .
```

| Gate | Prova | Bloqueante | Lê do perfil |
|---|---|---|---|
| `build` | compila | sim | `BUILD_CMD` |
| `test` | **N > 0** testes de integração executados | sim | `TEST_CMD` |
| `front` | o front constrói | sim | `FRONT_DIR`, `FRONT_BUILD` |
| `typecheck` | tipos batem | não | `TYPECHECK_CMD` |
| `contrato` | o front usa o tipo gerado do OpenAPI | sim | `OPENAPI_URL`, `API_BASE` |
| `navegacao` | as telas **abrem** no browser headless | sim | `CRAWL_CMD`, `FRONT_BASE` |
| `deploy-fresh` | migrations aplicam do zero, o sistema sobe | — | `COMPOSE` |

Veredito em `.prova-comportamento.json`. Só `PASS` fecha. **SKIP de gate bloqueante vira
`PARCIAL`** — nunca PASS silencioso.

### A prova de tempo real

**Nenhum gate da fábrica cobre o WebSocket.** `navegacao` prova que a tela abre; um socket que
falha em reconectar deixa a página perfeita, o console limpo e o número velho. É o "verde que não
é verde" na forma mais pura — e a doutrina manda transformar defeito que escapa em portão.

A prova roda **dentro do `TEST_CMD`**, contra o artefato de deploy, e por isso é contada pelo gate
de testes:

1. Dois clientes autenticados na **mesma** família, ambos na competência corrente.
2. O cliente A grava. O cliente B vê o novo valor **sem refresh**.
3. Um terceiro cliente, de **outra** família, **não** recebe o evento (RN-RT-001).
4. Derruba o socket de B, grava em A, reconecta B → B ressincroniza e mostra o valor correto
   (RN-RT-003).

O passo 4 é o que pega o bug real: sem ressincronização na reconexão, tudo passa nos três
primeiros e a tela mente na primeira oscilação de rede.

### Usuário de teste

Este produto é 100% área logada. O gate de navegação lê as credenciais de teste **do ambiente**:

```bash
export PREATOR_TEST_USER=...
export PREATOR_TEST_PASS=...
```

Sem isso, o gate declara no veredito que não cobriu a área logada — e cobriria só a tela de
login. O seed cria a família de teste com um membro já convidado e aceito, além de 1–3 registros
por módulo (a doutrina chama isso de defesa contra a classe de falha **D**, seed vazio).

### As 4 classes de falha que o verde não pega

| | Falha | Como pega aqui |
|---|---|---|
| **A** | Drift de schema — entidade existe, tabela não | `deploy-fresh` do zero + probe em todo GET-list |
| **B** | Contrato front↔back divergente | gate `contrato` + abrir os formulários rodando |
| **C** | Rota inexistente, permissão indevida | front-paths × back-routes + `navegacao` |
| **D** | Seed vazio — tela de detalhe não testável | seed mínimo por módulo |

---

## Estado atual do perfil

`preator-perfil.sh` ainda está **todo comentado** — por isso o veredito é `PARCIAL` com 5 SKIPs
bloqueantes. Ele será preenchido junto com a **F0**, quando `api/` e `web/` existirem: preenchê-lo
antes faria os gates falharem apontando para comandos e diretórios inexistentes, o que é pior que
o SKIP honesto.

Valores decididos, prontos para uso:

```bash
OVERLAY=".preator"
BUILD_CMD="npm run build -ws --if-present"
TEST_CMD="npm run test:integracao -w api"
FRONT_DIR="web"
FRONT_BUILD="npm run build"
TYPECHECK_CMD="npm run typecheck"
COMPOSE="docker-compose.yml"
API_PORT=3000
FRONT_PORT=3001
OPENAPI_URL="$API_BASE/openapi.json"
CRAWL_CMD="node scripts/crawl-gate.mjs"
MAX_QUEBRADAS=0
ESPEC_DIR=".preator/especificacoes"
```
