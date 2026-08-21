---
name: negocio-<dominio>
tipo: negocio                    # tipo 3 — conhecimento de NEGÓCIO/domínio
projeto: <nome-do-projeto>
dominio: <ex: licitações públicas / e-commerce / saúde>
aplica-se-a: [<nome-do-projeto>]
status: ativa
revisao: por-mudanca-de-regra
---

# Negócio — <domínio>

> **Skill de Negócio (tipo 3).** O conhecimento do NEGÓCIO que suporta a **especificação**. É o
> que faz o agente de Requirements/PO escrever specs corretas e o Dev não violar regra de domínio.
> Não é sobre código — é sobre *o que o cliente faz e as regras que o regem*.

## O que é o negócio (em 3 linhas)

<O que o cliente/órgão faz, para quem, e qual o valor.>

## Atores / personas

| Ator | Quem é | O que faz no sistema | Restrições |
|---|---|---|---|
| | | | |

## Glossário do domínio (a linguagem ubíqua)

> Todo nome de código, tela e evento deve usar estes termos — não sinônimos técnicos.

| Termo | Definição precisa |
|---|---|
| | |

## Regras de negócio (as invioláveis)

> Numeradas para rastrear na spec e no teste. Cada regra vira critério de aceite e edge case.

| # | Regra | Origem (lei/norma/decisão) |
|---|---|---|
| RN-001 | | |

## Regulação / compliance (o que a lei/norma exige)

<Ex.: LGPD, acessibilidade obrigatória (eMAG/WCAG), transparência, retenção de dados,
normas do órgão, prazos legais. Cada exigência com o impacto no sistema.>

## Processos / fluxos principais

<Os fluxos de negócio de ponta a ponta — em passos ou diagrama. Ex.: abertura de processo,
tramitação, publicação. É daqui que saem os casos de uso.>

## Casos de uso principais

| UC | Ator | Objetivo | Regras envolvidas |
|---|---|---|---|
| UC-01 | | | RN-... |

## Edge cases e exceções do domínio

<Os casos que quebram: o que acontece quando falta um dado obrigatório, quando um prazo estoura,
quando um ator não tem permissão. Alimentam o catálogo de testes.>

## Fontes do conhecimento

<Editais, leis, entrevistas com o cliente, documentos do órgão — de onde veio cada regra.>
