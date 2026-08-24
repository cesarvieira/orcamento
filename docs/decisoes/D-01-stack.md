# D-01 — Stack TypeScript full-stack

- **Status:** aceita
- **Data:** 2026-08-22

## Contexto

O produto nasce de um mockup funcional e será construído por uma fábrica de agentes operada por
um humano. Os gates de comportamento impõem restrições concretas: precisa haver um comando de
build, testes de integração contáveis, um OpenAPI para o gate de contrato, e um artefato de
deploy que suba de verdade.

## Decisão

| Camada | Escolha |
|---|---|
| Backend | TypeScript · API REST · **Drizzle ORM** · PostgreSQL · porta `3000` |
| Frontend | TypeScript · **Nuxt** (SSR) sobre Vite · porta `3001` |
| Contrato | OpenAPI gerado do back; tipos em `packages/contrato` |

**Uma linguagem só.** Back e front em TypeScript significam um conjunto de skills para todos os
workers do fan-out, e o mesmo idioma no modelo, no contrato e na tela.

**Drizzle, não Prisma.** O schema é TypeScript (`api/src/db/schema.ts`), não uma DSL própria —
some o quarto idioma do projeto e os tipos das entidades saem do próprio schema. Não há binário
de engine nativo para casar com a plataforma da imagem, o que tira uma fonte clássica de
"funciona local, quebra no container". E a migration é SQL legível e versionado em `api/drizzle/`,
gerado por `drizzle-kit` — nunca escrito à mão.

## Alternativas consideradas

**Prisma.** Mais maduro em detecção de drift, e traz o Studio. Descartado pelos três pontos acima.
O peso do argumento "maduro" cai quando não existe uma linha de código para migrar.

**Next.js full-stack.** Descartado: o gate de contrato espera um `OPENAPI_URL` e um tipo gerado
que o front importa. Com Server Actions o contrato deixa de ser artefato observável, o gate vira
SKIP bloqueante e o veredito nunca chega a `PASS`.

**.NET + React.** Viável, mas exige dois conjuntos de skills para os workers. Com um humano
operando o fan-out, a linguagem única vale mais que a familiaridade.

**Kysely ou SQL puro.** Descartados: não trazem migrations, e teríamos de montar à mão exatamente
o que a doutrina manda gerar do modelo.

## Consequências

**Nuxt é SSR por padrão.** O artefato do front é um servidor Node (`.output/server/index.mjs`),
não HTML estático — o que encaixa no compose de produção, mas muda o Dockerfile.

**A sessão tem de viver em cookie `httpOnly`.** O render de servidor não enxerga `localStorage`.
É mais seguro de qualquer forma, e vira exigência em [D-05](D-05-acesso-familiar.md).

**Não usar `web/server/`.** Nuxt oferece rotas de servidor próprias; usá-las cria um segundo
backend ao lado do `api/`.

**Perdemos a detecção de drift de um migrate maduro.** Aceitável porque o gate exige migration
aplicando **do zero em banco limpo** — o drift é pego lá, que é onde a doutrina manda pegá-lo.

**`integer` no Postgres é de 32 bits** — teto de ~R$ 21 milhões em centavos. Suficiente aqui, mas
a escolha entre `integer` e `bigint` passa a ser explícita no schema. Ver
[D-06](D-06-dinheiro-em-centavos.md).
