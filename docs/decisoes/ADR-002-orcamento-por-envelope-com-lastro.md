# ADR-002 — Orçamento por envelope com lastro

- **Status:** aceita
- **Data:** 2026-08-22
- **Decisor:** Cesar Vieira
- **Regras que gera:** RN-ORC-001..004, RN-LAS-001..003, RN-LAN-003, RN-MET-002

## Contexto

Esta é a decisão que define o produto, e ela tem uma particularidade de processo que precisa
ficar registrada.

A **Regra #0** da fábrica exige que regra financeira venha de
`preator/conhecimento/negocio/<domínio>`, carregada e citada — nunca de memória. Ao verificar o
domínio `financeiro`, a cobertura é esta:

| Skill | Cobre | Serve? |
|---|---|---|
| `financeiro/controladoria-orcamento` | ciclo orçado × realizado, análise de variação | **sim** — é o motor de teto × gasto |
| `financeiro/credito` | Price/SAC, CET, IOF | **sim** — parcelamento |
| `financeiro` (raiz) | conciliação de gateway, MDR, comissão | não |
| `financeiro/tesouraria` | caixa corporativo, câmbio | não |
| `financeiro/cobranca` | aging, PDD, régua de cobrança | não |

Ou seja: o **mecanismo universal** de orçado × realizado existe e se aproveita. Mas o recorte
de finanças **pessoais** não existe em skill nenhuma, e o conceito de **lastro** não existe em
lugar nenhum — não é conhecimento de domínio, é regra de produto criada no mockup.

Pela doutrina, isso não podia ser inferido por agente. Foi escalado ao humano e decidido
explicitamente. É o que este ADR registra.

## Decisão

**O app é orçamento por envelope**: categorias com teto por competência, e cada gasto consome o
teto da sua categoria.

**Sobre isso opera o lastro:** o app calcula quanto do plano tem respaldo real em dinheiro e
bloqueia o resto, rateado proporcionalmente.

```
caixaReal      = Σ max(0, saldo) das contas de DÉBITO
limiteLivre    = Σ (limite − fatura em aberto) dos CARTÕES
lastro         = caixaReal + limiteLivre

restanteTotal  = Σ max(0, teto − gasto) das categorias
déficit        = max(0, restanteTotal − lastro)

por categoria:
  bloqueado    = disponível × déficit / restanteTotal
  liberado     = disponível − bloqueado
```

Três sub-decisões, cada uma deliberada:

1. **A reserva fica de fora do lastro.** O dinheiro da poupança está comprometido com as metas.
   Contá-lo deixaria a família consumir a reserva de emergência sem perceber.
2. **O limite do cartão entra.** É dinheiro gastável neste mês, mesmo que a conta chegue depois.
   Ignorá-lo tornaria o bloqueio pessimista demais para ser útil.
3. **O rateio é pró-rata, não por prioridade.** Todas as categorias perdem a mesma fração.
   Quem quiser priorizar **remaneja** — que é um ato consciente e auditável.

**Corolário — o ajuste automático é desbloqueio, não aumento.** Quando entra dinheiro, o lastro
sobe, o déficit cai e o bloqueado encolhe. Nenhum teto muda de valor. Renda acima da prevista
**não** aumenta teto de categoria nenhuma (RN-ORC-004).

## Consequências

- O cálculo do lastro é **transversal**: depende de contas, cartões, faturas e orçamento ao mesmo
  tempo. É a costura entre módulos, e por isso é uma fatia própria com dono explícito, não um
  detalhe distribuído por vários módulos.
- O rateio divide um valor entre N categorias. Com dinheiro em centavos inteiros, o resíduo tem
  que ter destino — senão a soma dos bloqueados não fecha com o déficit.
- **Transferência não pode ser despesa** (RN-LAN-003), senão pagar fatura e guardar em meta
  corromperiam o gasto da categoria e, por consequência, o lastro.
- A frase do mockup *"os tetos se ajustam sozinhos ao que entrou"* está tecnicamente correta mas
  é ambígua. Trocar por *"os tetos se desbloqueiam conforme o dinheiro entra"*.
- Esta regra sobe para `.preator/skills/negocio/SKILL.md`, que **referencia** as skills da fábrica
  em vez de duplicá-las.
