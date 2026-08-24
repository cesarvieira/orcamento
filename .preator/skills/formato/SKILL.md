---
name: formato-<nome-do-projeto>
tipo: formato-projeto            # tipo 2 — convenções DESTE projeto
projeto: <nome-do-projeto>
aplica-se-a: [<nome-do-projeto>]
referencia-skills:               # skills de conhecimento (tipo 1) que este projeto adota
  - linguagens/<stack>
  - arquitetura/<estilo>
  - qualidade/codigo-limpo
  - qualidade/tdd
status: ativa
revisao: por-mudanca-de-decisao
---

# Formato do Projeto — <nome-do-projeto>

> **Skill de Formato (tipo 2).** O manual que TODO agente segue neste projeto. Diz *como se
> constrói aqui*: a stack, o layout, as convenções, o gate. O conhecimento universal vem das
> skills referenciadas; aqui ficam só as **decisões deste projeto** e os *overrides*.

## Stack fechada (não trocar sem ADR)

| Camada | Tecnologia | Versão |
|---|---|---|
| Linguagem/runtime | <ex: PHP 8.3 / .NET 8 / Java 21> | |
| Framework | <ex: Laravel 11 / ASP.NET / Spring> | |
| Banco | <ex: PostgreSQL 16> | |
| Frontend | <ex: gov.br DS + Vue> | |
| Auth | <ex: Keycloak / gov.br login> | |
| Infra/deploy | <ex: Docker + pipeline X> | |

## Layout de pastas

```
<árvore de diretórios canônica do projeto — onde vai cada coisa>
```

## Convenções (o que o agente aplica sem perguntar)

- **Nomenclatura:** <arquivos, classes, tabelas, endpoints, branches>
- **Padrão de código:** herda `linguagens/<stack>` + `qualidade/codigo-limpo`; *overrides* deste projeto: <lista>
- **Arquitetura:** herda `arquitetura/<estilo>`; fronteiras/camadas deste projeto: <descrição>
- **API:** herda `backend-web/apis-rest`; versionamento/formato de erro deste projeto: <descrição>
- **Testes:** herda `qualidade/tdd`; cobertura mínima e o que é obrigatório testar: <descrição>
- **Frontend/UI:** design system e regras de acessibilidade: <ex: gov.br DS + eMAG/WCAG AA>
- **Segurança:** herda `seguranca/autenticacao-oauth`; exigências deste projeto: <ex: LGPD, norma do órgão>

## DoR — pronto para começar
- <critérios de "requisito pronto" deste projeto>

## DoD — pronto para liberar (o gate do diretor)
- [ ] Código no formato acima + checklist da skill da linguagem passando
- [ ] Testes exigidos verdes; cobertura ≥ <X>%
- [ ] Code Review Agent sem bloqueante
- [ ] Acessibilidade/segurança do projeto verificadas
- [ ] <demais critérios do projeto>

## Fluxo de trabalho
- **Branch/PR:** <estratégia — ex: trunk-based / feature branch + PR>
- **Ambientes:** <dev / homolog / prod e como sobe>
- **Esteira:** segue `preator/doutrina/02-PROCESSO.md` com o gate humano em cada portão.

## Decisões do projeto (mini-ADRs)
| # | Decisão | Motivo | Data |
|---|---|---|---|
| 001 | | | |
