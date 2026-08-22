# Decisões de arquitetura (ADR)

Registro do **porquê**. Cada arquivo captura uma decisão, as alternativas descartadas e as
consequências que ela impôs.

> A alternativa descartada **com o motivo** vale tanto quanto a escolhida — é o que impede a
> discussão de voltar em seis meses. Um ADR sem a seção de alternativas é um comunicado, não um
> registro de decisão.

---

## Índice

| ADR | Assunto | Status | Data | Regras que ancora |
|---|---|---|---|---|
| [001](ADR-001-stack-e-infraestrutura.md) | Stack TypeScript, Nuxt, dois composes, dinheiro em centavos | aceita | 2026-08-22 | `RN-PAR-002` |
| [002](ADR-002-orcamento-por-envelope-com-lastro.md) | **Orçamento por envelope com lastro** | aceita | 2026-08-22 | `RN-ORC-*` · `RN-LAS-*` · `RN-LAN-003` · `RN-MET-002` |
| [003](ADR-003-ciclo-real-de-fatura.md) | Ciclo real de fatura no MVP | aceita | 2026-08-22 | `RN-CAR-*` |
| [004](ADR-004-fechamento-mantem-a-sobra.md) | Fechar o mês mantém a sobra em conta | aceita | 2026-08-22 | `RN-FEC-*` |
| [005](ADR-005-acesso-familiar-e-convite.md) | Acesso familiar, convite e provedor de email | aceita | 2026-08-22 | `RN-FAM-001` · `RN-CVT-*` |
| [006](ADR-006-fatias-no-github-issues.md) | Fatias no GitHub Issues | aceita | 2026-08-22 | — (processo) |
| [007](ADR-007-tempo-real-por-websocket.md) | Tempo real por WebSocket; invalidação, não estado | aceita | 2026-08-22 | `RN-RT-*` |

Nem toda regra vem de um ADR: `RN-CON-001` e boa parte de `RN-LAN-*` nascem direto do mockup e
estão documentadas em [../REGRAS-DE-NEGOCIO.md](../REGRAS-DE-NEGOCIO.md), sem decisão associada
porque não houve alternativa a descartar.

---

## Onde o 002 se encaixa

O **ADR-002 é a espinha**. Ele define o produto, e três dos outros existem porque ele existe:

```
ADR-002  orçamento por envelope com lastro
   │
   ├── ADR-003  o lastro usa "limite livre do cartão"
   │            → limite livre depende da fatura em aberto
   │            → fatura em aberto depende do ciclo  ⟹  ciclo tem que ser real
   │
   ├── ADR-004  a sobra fica em conta
   │            → se fosse para a reserva, sairia do lastro (RN-LAS-001)
   │            → economizar apertaria o mês seguinte. Contraintuitivo.
   │
   ├── ADR-007  o servidor empurra invalidação, não estado
   │            → um lançamento muda o disponível de TODAS as categorias, por rateio
   │            → aplicar diff exigiria recalcular o lastro no front
   │            ⟹ duas fontes da verdade para a regra central. Descartado.
   │
   └── RN-LAN-003  transferência não é despesa
                → senão pagar fatura e guardar em meta corrompem gasto, teto e lastro

ADR-001  independente — stack e infra
ADR-005  independente — identidade e acesso  ← ADR-007 herda dele a auth do socket
ADR-006  independente — processo de trabalho
```

**Mexer no ADR-002 obriga a revisitar 003, 004 e 007.** Os outros três são ortogonais.

---

## Qual ADR responde a quê

| A pergunta | Vá para |
|---|---|
| Por que Nuxt e não Next? Por que dois composes? | [001](ADR-001-stack-e-infraestrutura.md) |
| Por que a poupança não conta como dinheiro disponível? | [002](ADR-002-orcamento-por-envelope-com-lastro.md) |
| Por que o rateio é proporcional e não por prioridade? | [002](ADR-002-orcamento-por-envelope-com-lastro.md) |
| Por que receber mais não aumenta meu teto? | [002](ADR-002-orcamento-por-envelope-com-lastro.md) |
| Por que não simplificar a fatura para mês civil? | [003](ADR-003-ciclo-real-de-fatura.md) |
| Por que fechar o mês não guarda a sobra? | [004](ADR-004-fechamento-mantem-a-sobra.md) |
| Por que o convite exige o mesmo email? | [005](ADR-005-acesso-familiar-e-convite.md) |
| Por que o backlog em disco está vazio? | [006](ADR-006-fatias-no-github-issues.md) |
| Por que o socket manda "mudou" em vez do valor novo? | [007](ADR-007-tempo-real-por-websocket.md) |
| Por que não usamos SSE, que seria mais simples? | [007](ADR-007-tempo-real-por-websocket.md) |

---

## O ADR-002 tem um valor extra

Ele não registra só uma escolha de produto — registra **uma escalada de Regra #0**.

O conceito de lastro não existe em nenhuma skill da fábrica: não é conhecimento de domínio, é
regra criada no mockup. A doutrina manda parar e escalar em vez de inferir, e foi o que se fez.
O ADR guarda o rastro dessa decisão.

**Se aparecer outra regra financeira sem skill que a cubra, o caminho é o mesmo:** pare, escale,
e registre aqui.

---

## Escrevendo um ADR novo

Arquivo: `ADR-NNN-titulo-em-kebab-case.md`. Numeração sequencial, nunca reaproveitada — ADR
substituído continua no diretório com status atualizado, porque o histórico é o produto.

```markdown
# ADR-NNN — Título

- **Status:** proposta | aceita | substituída por ADR-XXX | descartada
- **Data:** AAAA-MM-DD
- **Decisor:** quem decidiu
- **Regras que gera:** RN-XXX-NNN (se houver)

## Contexto
O que forçou a decisão. Restrições reais, não justificativa retroativa.

## Decisão
O que foi decidido, no presente do indicativo.

## Alternativas consideradas
Cada uma com **o motivo do descarte**. Esta seção é obrigatória.

## Consequências
O que passa a ser verdade — inclusive o que ficou pior ou mais caro.
```

Ao aceitar um ADR, atualize também: o índice acima, a tabela de decisões em
[`.preator/CONTEXT.md`](../../.preator/CONTEXT.md) e, se ele gerar regra,
[../REGRAS-DE-NEGOCIO.md](../REGRAS-DE-NEGOCIO.md).
