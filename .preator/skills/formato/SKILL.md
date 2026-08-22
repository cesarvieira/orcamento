---
name: formato-orcamento
tipo: formato-projeto
projeto: orcamento
aplica-se-a: [orcamento]
referencia-skills:
  - linguagens/javascript-typescript
  - arquitetura/clean-architecture
  - backend-web/apis-rest
  - frontend/frameworks-js
  - qualidade/codigo-limpo
  - qualidade/tdd
  - seguranca/autenticacao-oauth
status: ativa
revisao: por-mudanca-de-decisao
---

# Formato do Projeto — orcamento

> **Skill de Formato (tipo 2).** O manual que TODO agente segue neste projeto. O conhecimento
> universal vem das skills referenciadas; aqui ficam as **decisões deste projeto** e os
> *overrides*.
>
> As convenções detalhadas vivem em [`docs/PADROES.md`](../../../docs/PADROES.md). Esta skill
> aponta e destaca o que mais causa retrabalho.

## Stack fechada (não trocar sem ADR)

| Camada | Tecnologia | Porta |
|---|---|---|
| Linguagem | TypeScript | — |
| Backend | API REST + Prisma | `3000` |
| Banco | PostgreSQL | `5432` |
| Frontend | Nuxt (SSR) sobre Vite | `3001` |
| Tempo real | WebSocket · Socket.IO · path `/realtime` | `3000` |
| Auth | Google OAuth + email/senha, cookie `httpOnly` | — |
| Infra | Docker Compose (dois arquivos) | — |

Fechada por [ADR-001](../../../docs/decisoes/ADR-001-stack-e-infraestrutura.md) e
[ADR-007](../../../docs/decisoes/ADR-007-tempo-real-por-websocket.md).

## Layout

```
api/src/modulos/<modulo>/     rotas · servico · repositorio · schema · spec
api/prisma/schema.prisma      migrations geradas daqui, nunca à mão
web/                          Nuxt — pages, components, composables, middleware
packages/contrato/            OpenAPI gerado. SAÍDA, não fonte.
scripts/                      crawl-gate.mjs, seed.ts
docker-compose.yml            stack completa — alvo dos gates
docker-compose.dev.yml        só Postgres — loop de desenvolvimento
```

**Um módulo = uma pasta = um dono.** No fan-out, um worker por módulo. Módulo não importa de
módulo irmão: a costura é explícita e tem dono.

## O que o agente aplica sem perguntar

- **Dinheiro em centavos inteiros.** Nunca float. Divisão sempre com destino explícito do resíduo.
- **Português no domínio.** `LancamentoServico`, `teto_centavos`, `valor_centavos`. Nunca
  `TransactionService` ou `budget_limit`.
- **`familiaId` do token.** Nunca de rota, query ou corpo.
- **`data` e `competencia` são campos distintos.** Competência calculada na escrita e persistida.
- **O front importa o tipo gerado** de `packages/contrato`. Não redeclara modelo.
- **Nada em `web/server/`.** A API é o `api/`.
- **Toda escrita emite invalidação** no socket. O cliente que recebe refaz a leitura — nunca
  patcheia estado nem recalcula regra.
- Tabela plural snake_case · arquivo kebab-case · componente Vue PascalCase · branch
  `fatia/<n>-<slug>`.

## DoR — pronto para começar

- [ ] A issue da fatia existe, com label `fatia`, e cita as RN envolvidas
- [ ] As RN citadas existem em `docs/REGRAS-DE-NEGOCIO.md` — se falta regra, **para e escala**
- [ ] Nenhuma regra financeira nova sem skill que a cubra

## DoD — pronto para liberar

- [ ] A regra está **aplicada** no handler, não só a entidade existindo — cace o motor órfão
- [ ] Teste de **integração** real: HTTP → serviço → Postgres de verdade
- [ ] Um teste por RN que a fatia toca, mais o isolamento entre famílias
- [ ] **Dois clientes:** a mudança feita num aparece no outro sem refresh; outra família não recebe
- [ ] A tela **abre** no artefato de deploy, com dado, zero erro de console e de rede
- [ ] Migrations aplicam do zero em banco limpo
- [ ] `PROVA_DE_COMPORTAMENTO=PASS` — o carimbo, não o auto-relato
- [ ] Documentação as-built: o que foi construído, não o que a spec previa

## Fluxo

- **Branch por fatia**, PR para `main`. Commit referencia a issue.
- **Push por checkpoint.** Trabalho que só existe local ainda não existe.
- Fatias no **GitHub Issues** ([ADR-006](../../../docs/decisoes/ADR-006-fatias-no-github-issues.md)),
  não em `.sdd/backlog/open/`.
- Esteira conforme `preator/doutrina/02-PROCESSO.md`, com gate humano em cada portão.

## Antes de codar

Leia [`docs/APRENDIZADOS.md`](../../../docs/APRENDIZADOS.md). São seis armadilhas do protótipo
que voltam a morder em quem "segue o mockup" sem saber o que já foi corrigido.
