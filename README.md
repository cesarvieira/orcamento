# Orçamento Familiar

Orçamento familiar **por envelope com lastro** — a família planeja o mês em
categorias com teto, e o app se recusa a liberar plano que não tem dinheiro por
trás.

> A pergunta que o produto responde não é *"quanto gastei?"*, é
> **"quanto posso gastar de verdade?"**.

- **O que é verdade deste produto:** [`.preator/CONTEXT.md`](.preator/CONTEXT.md)
- **As decisões:** [`docs/decisoes/`](docs/decisoes/)
- **As especificações:** [`docs/especificacoes/`](docs/especificacoes/)
- **Como a IA trabalha aqui:** [`AGENTS.md`](AGENTS.md)

---

## O monorepo

| Pasta | O que é |
|---|---|
| `api/` | API REST + Socket.IO · TypeScript · Drizzle · porta **3000** |
| `web/` | Front Nuxt em **SSR** sobre Vite · porta **3001** |
| `packages/contrato/` | tipos **gerados** do OpenAPI — saída, não fonte |
| `scripts/` | seed e o crawler do gate de navegação |

A fábrica que constrói isto vive em `preator/` (subrepo, **lida, nunca
escrita**), e o contrato entre projeto e fábrica é o
[`preator-perfil.sh`](preator-perfil.sh).

---

## Rodar

```bash
cp .env.example .env          # e preencha
npm install

docker compose -f docker-compose.dev.yml up -d   # só o Postgres
npm run migrar
npm run semear                                    # exige PREATOR_TEST_USER/PASS

npm run dev:api               # :3000  (realtime no mesmo processo, /realtime)
npm run dev:web               # :3001
```

## Provar

O artefato de deploy é o `docker-compose.yml` — **é ele que os gates provam**,
nunca o dev-build ([D-02](docs/decisoes/D-02-dois-composes.md)).

```bash
docker compose up -d --build
npm run crawl:preparar                              # uma vez: baixa o Chromium
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
