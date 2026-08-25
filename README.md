# Orçamento Familiar

Orçamento familiar **por envelope com lastro** — a família planeja o mês em
categorias com teto, e o app se recusa a liberar plano que não tem dinheiro por
trás.

> A pergunta que o produto responde não é _"quanto gastei?"_, é
> **"quanto posso gastar de verdade?"**.

- **O que é verdade deste produto:** [`.preator/CONTEXT.md`](.preator/CONTEXT.md)
- **As decisões:** [`docs/decisoes/`](docs/decisoes/)
- **As especificações:** [`docs/especificacoes/`](docs/especificacoes/)
- **Como a IA trabalha aqui:** [`AGENTS.md`](AGENTS.md)

---

## O monorepo

| Pasta                | O que é                                                      |
| -------------------- | ------------------------------------------------------------ |
| `api/`               | API REST + Socket.IO · TypeScript · Drizzle · porta **3000** |
| `web/`               | Front Nuxt em **SSR** sobre Vite · porta **3001**            |
| `packages/contrato/` | tipos **gerados** do OpenAPI — saída, não fonte              |
| `scripts/`           | seed e o crawler do gate de navegação                        |

A fábrica que constrói isto vive em `preator/` (subrepo, **lida, nunca
escrita**), e o contrato entre projeto e fábrica é o
[`preator-perfil.sh`](preator-perfil.sh).

---

## Rodar

```bash
cp .env.example .env                              # e preencha
cp .env.dev.example .env.dev                      # e preencha
pnpm install

pnpm run dev:banco             # só o Postgres, porta separada da stack de prova (D-02)
pnpm run migrar
pnpm run semear                                   # exige PREATOR_TEST_USER/PASS

pnpm dev                       # sobe o banco + api (:3000) e web (:3001) juntos
```

`pnpm dev` é um comando só: garante o Postgres de pé (`dev:banco`, idempotente)
e então roda os dois servidores em paralelo via Turborepo, com a saída de cada
um rotulada. `dev:api` e `dev:web` continuam existindo para rodar um lado
isolado. A API imprime, ao subir, a configuração que resolveu — portas, banco
(sem a senha), CORS, driver de email e se o Google está ligado.

> As portas de **dev** são 3000/3001; as da **stack de prova** são 3010/3011
> (`preator-perfil.sh`), de propósito: o gate sobe e derruba a stack dele sem
> nunca colidir com o ambiente de desenvolvimento que fica no ar.

O login por Google é opcional: sem `GOOGLE_CLIENT_ID` no ambiente, o botão fica
inerte e o resto do app funciona igual. Para ligá-lo, siga
[`.preator/playbooks/google-client-id.md`](.preator/playbooks/google-client-id.md).

Para rodar a suíte de integração (`pnpm run teste`), copie também
`cp .env.test.example .env.test` — mesma instância do Postgres de dev, banco
separado (`orcamento_teste`).

## Provar

O artefato de deploy é o `docker-compose.yml` — **é ele que os gates provam**,
nunca o dev-build ([D-02](docs/decisoes/D-02-dois-composes.md)).

```bash
docker compose up -d --build
pnpm run crawl:preparar                             # uma vez: baixa o Chromium
bash preator/esteira/gates/prova-comportamento.sh .
```

Só `PROVA_DE_COMPORTAMENTO=PASS` fecha uma história. Verde de build não fecha
nada.

Para provar do zero — banco limpo, migrate, seed, API e front de pé:

```bash
CONFIRMAR=sim bash preator/esteira/gates/deploy-fresh.sh .
```

---

## As regras que não se negociam

1. **O `familiaId` vem do token, nunca do request** — e isso vale também no
   WebSocket: a room é resolvida no handshake.
2. **Dinheiro é inteiro em centavos, em toda a pilha.**
3. **Transferência não é despesa.**
4. **O front importa o contrato gerado; não redeclara o modelo do back.**
5. **Não existe `web/server/`** — a API é o `api/`.

O porquê de cada uma está em [`.preator/CONTEXT.md`](.preator/CONTEXT.md) e nas
decisões.
