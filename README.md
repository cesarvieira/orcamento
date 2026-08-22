# orcamento

Aplicativo de **orçamento familiar por envelope com lastro**. Uma família planeja o mês em
categorias com teto, lança o que gasta, e o app se recusa a liberar plano que não tem dinheiro
por trás.

> **Estado:** em construção. O produto ainda não tem código — o que existe é a especificação,
> as decisões e a esteira. Ver [docs/](docs/).

---

## O que ele faz de diferente

A maioria dos apps de finanças pessoais responde *"quanto eu gastei?"*. Este responde
**"quanto eu posso gastar de verdade?"** — que é uma pergunta mais difícil, porque exige
confrontar o plano com o dinheiro que existe.

O app calcula o **lastro** do mês (caixa das contas de débito + limite livre dos cartões,
sem a reserva) e, quando o plano promete mais do que o lastro cobre, bloqueia a diferença
rateada proporcionalmente entre as categorias. O número em destaque nunca é o plano cheio.

O mecanismo completo está em [docs/DOMINIO.md](docs/DOMINIO.md#o-lastro).

---

## Onde está cada coisa

| Quero… | Vá para |
|---|---|
| Entender o domínio e a linguagem ubíqua | [docs/DOMINIO.md](docs/DOMINIO.md) |
| Ver as regras de negócio numeradas | [docs/REGRAS-DE-NEGOCIO.md](docs/REGRAS-DE-NEGOCIO.md) |
| Saber como se escreve código aqui | [docs/PADROES.md](docs/PADROES.md) |
| Subir o projeto / entender o `.env` | [docs/AMBIENTE.md](docs/AMBIENTE.md) |
| Saber por que algo foi decidido assim | [docs/decisoes/](docs/decisoes/README.md) |
| Não repetir erro já cometido | [docs/APRENDIZADOS.md](docs/APRENDIZADOS.md) |
| **Trabalhar nisto sendo uma IA** | [CLAUDE.md](CLAUDE.md), depois [docs/APRENDIZADOS.md](docs/APRENDIZADOS.md) |

---

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | TypeScript · API REST · Drizzle ORM · porta `3000` |
| Frontend | TypeScript · Nuxt (SSR) sobre Vite · porta `3001` |
| Banco | PostgreSQL |
| Tempo real | WebSocket (Socket.IO) · mesma porta da API, path `/realtime` |
| Auth | Google OAuth + email/senha, sessão em cookie `httpOnly` |
| Infra | Docker Compose |

Fechada por [ADR-001](docs/decisoes/ADR-001-stack-e-infraestrutura.md) e
[ADR-007](docs/decisoes/ADR-007-tempo-real-por-websocket.md). Trocar exige novo ADR.

O app é usado por várias pessoas da mesma família ao mesmo tempo, e quase tudo na tela é estado
derivado — um lançamento muda o disponível de **todas** as categorias, por rateio do lastro.
Por isso o servidor empurra **invalidação, não estado**: quem recebe refaz a leitura pela API e
nunca recalcula a regra no front.

---

## O trabalho: onde vivem as fatias

A unidade de trabalho é a **fatia vertical** — *"o usuário faz X na tela Y"*, com tela e backend
juntos. As fatias deste projeto vivem no **GitHub Issues**, não em `.sdd/backlog/open/`
([ADR-006](docs/decisoes/ADR-006-fatias-no-github-issues.md)).

```bash
gh issue list --label fatia
```

---

## Como se prova que está pronto

Build verde não fecha nada. O que fecha é o carimbo da máquina:

```bash
bash preator/esteira/gates/prova-comportamento.sh .
```

Só `PROVA_DE_COMPORTAMENTO=PASS` fecha uma fatia. `PARCIAL` e `FAIL` não fecham, e SKIP de gate
bloqueante rebaixa para `PARCIAL` — nunca vira PASS silencioso.

O veredito fica em `.prova-comportamento.json`. Detalhes de cada selo em
[docs/AMBIENTE.md](docs/AMBIENTE.md#os-gates).

---

## A fábrica

Este projeto consome a fábrica [preator](https://github.com/cesarvieira/preator) como submódulo
em `preator/`. Ela é **lida, nunca escrita**. O contrato entre os dois lados é o
`preator-perfil.sh` na raiz.

```bash
git submodule update --init --recursive
```

O overlay deste projeto — contexto e skills que só valem aqui — vive em `.preator/`.
