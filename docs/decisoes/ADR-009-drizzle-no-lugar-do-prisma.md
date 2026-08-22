# ADR-009 — Drizzle no lugar do Prisma

- **Status:** aceita
- **Data:** 2026-08-22
- **Decisor:** Cesar Vieira
- **Substitui:** a escolha de ORM do [ADR-001](ADR-001-stack-e-infraestrutura.md); o resto dele continua valendo

## Contexto

O ADR-001 fechou a stack com Prisma. Nada foi construído ainda — a única fatia que chegou a rodar
foi descartada —, então a troca sai antes de existir código para migrar.

A regra 6 da doutrina manda **modelar uma vez e gerar o resto**: migration é gerada do modelo,
nunca escrita à mão, e o front importa o contrato em vez de redeclará-lo. Qualquer ORM aqui é
avaliado por quanto ajuda ou atrapalha essa regra.

## Decisão

**Drizzle ORM + drizzle-kit**, com PostgreSQL.

| Antes | Agora |
|---|---|
| `api/prisma/schema.prisma` (DSL própria) | `api/src/db/schema.ts` (TypeScript) |
| `prisma migrate` | `drizzle-kit generate` → SQL versionado em `api/drizzle/` |
| `PrismaClient` | `drizzle(pool)` de `drizzle-orm/node-postgres` |

O schema continua sendo a **fonte única**, e a migration continua **gerada dele** — muda a
linguagem em que o modelo é escrito, não a regra.

## Por que

**O modelo passa a ser TypeScript, como o resto.** A DSL do Prisma é um quarto idioma no projeto,
ao lado de TS, SQL e YAML. Com Drizzle, o schema é código: os tipos das entidades saem do próprio
schema (`InferSelectModel`), sem passo de geração de client. A regra "modela uma vez" fica mais
literal, não menos.

**Some o binário de engine.** O Prisma carrega um query engine nativo que precisa casar com a
plataforma da imagem — a origem clássica de "funciona local, quebra no container". Como o gate
exige que a stack suba no **artefato de deploy** ([ADR-001](ADR-001-stack-e-infraestrutura.md)),
menos peça nativa no Dockerfile é menos superfície para o selo falhar por motivo alheio ao produto.

**A migration vira SQL legível e versionado.** `drizzle-kit generate` escreve o `.sql` no
repositório. Numa fatia como a do ciclo de fatura, onde o índice e a restrição importam, ler o SQL
que vai rodar vale mais do que confiar num diff opaco.

## Alternativas consideradas

**Ficar no Prisma.** É mais maduro em detecção de drift e traz o Studio. Descartado pelos três
pontos acima — e o peso do argumento "maduro" cai quando não há uma linha de código para migrar.

**Kysely.** Query builder tipado, ainda mais fino. Descartado: não traz migrations, e teríamos de
montar à mão exatamente o que a regra 6 manda gerar.

**SQL puro com `node-postgres`.** Descartado pelo mesmo motivo, com mais superfície manual.

## Consequências

**Dinheiro em centavos precisa de atenção de tipo.** `integer` no Postgres é de 32 bits — teto de
~R$ 21 milhões em centavos. Suficiente para orçamento familiar, mas a escolha entre `integer` e
`bigint` passa a ser explícita no schema, e não uma inferência do ORM. Declare e comente.

**Perdemos a detecção de drift do `prisma migrate dev`.** O `drizzle-kit` compara schema e
migrations, mas é mais novo nesse terreno. Como o gate `deploy-fresh` já exige que as migrations
apliquem **do zero em banco limpo**, o drift é pego lá — que é onde a doutrina manda pegá-lo, e
não na conveniência do ORM.

**O que muda no que já está escrito:** `docs/PADROES.md` (layout do módulo e a regra de
migration), `README.md`, `.preator/CONTEXT.md`, a skill de formato e a issue da F0. Nada de
`api/` existe para reescrever.

**O que não muda:** dinheiro em centavos inteiros, `data` e `competencia` como campos distintos,
contrato gerado do OpenAPI, um módulo por worker, e a exigência de teste de integração contra
Postgres de verdade.
