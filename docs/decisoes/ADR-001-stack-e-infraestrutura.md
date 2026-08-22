# ADR-001 — Stack e infraestrutura

- **Status:** aceita
- **Data:** 2026-08-22
- **Decisor:** Cesar Vieira

## Contexto

O projeto nasce de um mockup em HTML e precisa de uma stack que atenda a três exigências
simultâneas: um único desenvolvedor humano operando uma fábrica de agentes, os gates de
comportamento da fábrica, e um app mobile-first com desktop responsivo.

Os gates impõem restrições concretas: precisam de um comando de build, de testes de integração
contáveis, de um OpenAPI para o gate de contrato, e de um artefato de deploy que suba de verdade.

## Decisão

**TypeScript full-stack.**

| Camada | Escolha |
|---|---|
| Backend | TypeScript · API REST · Prisma · PostgreSQL · porta `3000` |
| Frontend | TypeScript · **Nuxt** (SSR) sobre Vite · porta `3001` |
| Contrato | OpenAPI gerado do back; tipos gerados em `packages/contrato` |
| Infra | Docker Compose |

**Dois composes:** `docker-compose.dev.yml` sobe só o Postgres para o loop de desenvolvimento;
`docker-compose.yml` sobe a stack completa nas imagens de produção e é o alvo dos gates.

**Dinheiro em centavos inteiros** em toda a pilha. Onde houver divisão, o resíduo tem destino
explícito — na última parcela, no caso de parcelamento (RN-PAR-002).

## Alternativas consideradas

**Next.js full-stack.** Descartado: o gate `contrato` espera um `OPENAPI_URL` e um tipo gerado
que o front importa. Com Server Actions o contrato deixa de ser um artefato observável, o gate
vira SKIP bloqueante e o veredito nunca chega a `PASS` sem adaptação.

**.NET 8 + React.** Viável e com skill povoada na fábrica, mas exige dois conjuntos de skills
para os workers. Com um humano só operando o fan-out, a linguagem única vale mais que a
familiaridade com o ecossistema.

**Compose só com Postgres, também para os gates.** Descartado por conflito direto com a doutrina:
a tela precisa abrir *no artefato de deploy, não no dev-build*. Os dois composes resolvem sem
custo para o desenvolvimento diário.

## Consequências

**Boas.** Uma linguagem, uma skill, todos os workers. OpenAPI e tipos gerados nativamente.
Migrations geradas do `schema.prisma`. Um front responsivo em vez de dois produtos.

**Custos e cuidados.**

- Nuxt é **SSR por padrão**: o artefato do front é um servidor Node (`.output/server/index.mjs`),
  não HTML estático. Encaixa no compose completo, mas muda o Dockerfile do `web`.
- A sessão **tem** que viver em cookie `httpOnly`: o render de servidor não enxerga
  `localStorage`. É mais seguro de qualquer forma.
- Nuxt oferece `server/` para rotas próprias. **Não usar.** Criaria um segundo backend ao lado
  do `api/` — o "caminho paralelo" que a doutrina proíbe.
- O `preator-perfil.sh` só pode ser preenchido quando `api/` e `web/` existirem (F0). Antes disso,
  o SKIP honesto é preferível a um gate que falha apontando para diretório inexistente.
