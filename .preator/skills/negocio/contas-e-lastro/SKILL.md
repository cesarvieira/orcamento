---
name: negocio-contas-e-lastro
tipo: negocio # tipo 3 — conhecimento de NEGÓCIO/domínio
projeto: orcamento
dominio: contas e lastro — onde o dinheiro está e quanto dá para gastar de verdade
aplica-se-a: [orcamento]
status: ativa
revisao: por-mudanca-de-regra
---

# Negócio — contas e lastro

> **Skill de Negócio (tipo 3).** O conhecimento do NEGÓCIO que suporta a **especificação**. É o
> que faz o agente de Requirements/PO escrever specs corretas e o Dev não violar regra de domínio.
> Não é sobre código — é sobre _o que o cliente faz e as regras que o regem_.

## O que é o negócio (em 3 linhas)

O Orçamento Familiar rastreia o dinheiro da família em contas (débito, crédito e reserva) e
calcula quanto realmente pode gastar — o **lastro**, que é caixa real mais limite livre
do cartão. Quando o orçamento por categoria ultrapassa o lastro, o app recusa plano e bloqueia
proporcionalmente — é o mecanismo que torna o app confiável: ele nunca promete mais do que existe.

## Atores / personas

| Ator      | Quem é                                                | O que faz no sistema                          | Restrições                                      |
| --------- | ----------------------------------------------------- | --------------------------------------------- | ----------------------------------------------- |
| Membro    | pessoa com login numa família                         | registra contas, vê saldo de cada uma, vê lastro | só enxerga dado da própria família — REST e socket |
| App       | o orquestrador de bloqueio                            | calcula lastro, bloqueia gasto quando necessário | derivação só em leitura, sem materialização     |

## Glossário do domínio (a linguagem ubíqua)

> Todo nome de código, tela e evento deve usar estes termos — não sinônimos técnicos.

| Termo                      | Definição precisa                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Conta                      | lugar onde dinheiro fica; só existem três tipos: débito (corrente), crédito (cartão) e reserva (poupança ou "meu fundo de emergência") |
| Débito (`DEBITO`)          | conta de saldo positivo, como uma corrente. O saldo é inicializado e depois derivado de lançamentos.                                   |
| Crédito (`CREDITO`)        | cartão com limite (`limiteCentavos`); `diaFechamento` e `diaVencimento` (1–28) só existem neste tipo.                                  |
| Reserva (`RESERVA`)        | poupança ou fundo de emergência; inicializado, depois derivado. **Fica fora do lastro** — o dinheiro está comprometido com as metas.  |
| Saldo inicial              | valor em centavos que a conta começa com (débito e reserva só); é a base sobre a qual o saldo derivado soma os lançamentos.            |
| Limite                     | teto de gasto em centavos (`limiteCentavos`); só existe em `CREDITO`.                                                                  |
| Dia de fechamento          | dia do mês (1–28) em que o período do cartão fecha (`CREDITO` só); a faixa 1–28 existe porque nem todo mês tem dia 29–31.             |
| Dia de vencimento          | dia do mês (1–28) em que a fatura vence (crédito só); quando o pagamento é esperado.                                                 |
| Saldo derivado             | saldo de verdade da conta = saldo inicial + Σ lançamentos da conta. Nunca materializado em coluna: é calculado na leitura.            |
| Caixa real                 | soma dos saldos positivos das contas de débito. `max(0, saldoDebito1) + max(0, saldoDebito2) + ...`; reserva **não entra**.             |
| Limite livre do cartão     | quanto do limite ainda não foi gasto. `limiteCartao − faturaEmAberto`.                                                                 |
| Lastro                     | dinheiro gastável de verdade: `caixaReal + Σ limiteLivre de todos os cartões`. É a base de cálculo do bloqueio.                       |
| Deficit de lastro          | quanto o orçamento das categorias ultrapassa o lastro. `max(0, restanteTotal − lastro)`.                                              |
| Gasto bloqueado (categoria)| quanto da categoria foi "congelado" quando há déficit. Distribuído pró-rata pelo disponível.                                           |

## Regras de negócio (as invioláveis)

> Numeradas para rastrear na spec e no teste. Cada regra vira critério de aceite e edge case.

| #      | Regra                                                                                                                      | Onde é imposta           | Origem (lei/norma/decisão)                                     |
| ------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------- |
| RN-06  | Conta com lançamentos **não pode ser excluída**                                                                           | `DELETE /contas/:id`     | [EF-02](../../../docs/especificacoes/EF-02-contas.md) §2 mockup |
| RN-07  | Conta `RESERVA` fica **fora do orçamento e fora do lastro**                                                               | leitura de saldo e EF-06 | [EF-06](../../../docs/especificacoes/EF-06-lastro.md) §2 RN-27  |
| RN-08  | `diaFechamento` e `diaVencimento` só existem em `CREDITO`, e valem 1–28                                                   | schema + validação       | [EF-02](../../../docs/especificacoes/EF-02-contas.md) §2        |
| RN-27  | A conta `RESERVA` **não entra** no lastro — o dinheiro está comprometido com as metas                                     | derivação do lastro      | [EF-06](../../../docs/especificacoes/EF-06-lastro.md) §2 RN-27  |
| RN-28  | O **limite livre do cartão entra** no lastro — é dinheiro gastável neste mês                                              | derivação do lastro      | [EF-06](../../../docs/especificacoes/EF-06-lastro.md) §2 RN-28  |
| RN-29  | O déficit é rateado **pró-rata**; não há categoria privilegiada — todas perdem a mesma fração                             | bloqueio de categoria    | [EF-06](../../../docs/especificacoes/EF-06-lastro.md) §2 RN-29  |
| RN-30  | O número em destaque é `restante − déficit`. O app **nunca** mostra o plano cheio como gastável quando há déficit          | tela home                | [EF-06](../../../docs/especificacoes/EF-06-lastro.md) §2 RN-30  |
| RN-31  | Entrada de dinheiro **desbloqueia**; não aumenta teto nenhum — o bloqueio é efeito da falta de lastro, não da capacidade | orçamento + lastro       | [EF-06](../../../docs/especificacoes/EF-06-lastro.md) §2 RN-31  |
| RN-32  | O resíduo do rateio vai para a categoria de maior saldo; a **soma dos bloqueados é exatamente o déficit**                 | cálculo de bloqueio      | [EF-06](../../../docs/especificacoes/EF-06-lastro.md) §2 RN-32  |

## Regulação / compliance (o que a lei/norma exige)

- **Dinheiro em centavos** — inteiro na pilha toda (banco, API, contrato, front). Ver
  [D-06](../../../docs/decisoes/D-06-dinheiro-em-centavos.md). Regra: onde houver divisão
  (rateio do lastro ou parcelamento), o resíduo tem destino explícito (categoria de maior saldo
  para lastro, última parcela para parcelamento). A soma dos bloqueados é **sempre exatamente**
  o déficit, sem quebra.
- **Isolamento entre famílias** — nenhuma conta ou cálculo de lastro expõe dado de uma família a
  outra.

## Processos / fluxos principais

1. **Registrar conta** — membro entra em "Contas", clica em +, escolhe tipo (débito/crédito/reserva),
   preenche nome, saldo inicial ou limite, (se cartão: fechamento e vencimento) → persiste.
2. **Editar conta** — membro abre a conta e passa pelo mesmo fluxo do cadastro (nome → tipo →
   valor → datas, se cartão) para atualizar os dados.
3. **Deletar conta** — membro clica × na conta. Sistema valida: se tem lançamento, recusa com mensagem
   clara; se não tem, deleta.
4. **Ver saldo** — o app mostra saldo em tempo real de cada conta (derivado de saldo inicial +
   lançamentos), e no topo da home mostra o **lastro** — a soma de caixa real + limite livre.

## Casos de uso principais

| UC    | Ator   | Objetivo                                                  | Regras envolvidas        |
| ----- | ------ | --------------------------------------------------------- | ------------------------ |
| UC-01 | Membro | Registrar suas contas e saldos iniciais                  | RN-08                    |
| UC-02 | Membro | Editar datas e limite de um cartão                       | RN-08                    |
| UC-03 | Membro | Deletar uma conta sem lançamentos                        | RN-06                    |
| UC-04 | Membro | Ver o saldo de cada conta em tempo real                  | saldo derivado           |
| UC-05 | Membro | Ver quanto pode gastar de verdade (lastro) — a base      | RN-27, RN-28, RN-29, RN-30 |
| UC-06 | App    | Bloquear proporcionalmente quando lastro < restante      | RN-29, RN-32             |
| UC-07 | Membro | Ver bloqueio desaparecer quando entra dinheiro           | RN-31                    |

## Edge cases e exceções do domínio

- **Conta de débito com saldo negativo:** o cálculo de caixa real usa `max(0, saldo)` — débito
  negativo **não conta** como caixa (nem entra negativo no total).
- **Exclusão de conta com lançamento:** RN-06 recusa a exclusão; a fonte exige apenas que a
  recusa venha com "mensagem clara" — o texto exato da mensagem não é desta fonte.
- **Rateio do lastro com uma categoria:** com uma única categoria, `disponível == restanteTotal`,
  logo pela fórmula `bloqueado = disponível × déficit / restanteTotal` tem-se
  `bloqueado == déficit` exatamente — que só se iguala a 100% da disponível no caso extremo em
  que o lastro é zero.
- **Rateio com quebra:** exemplo: restante = R$ 100, déficit = R$ 30, categoria com saldo R$ 50
  (1/2 do total de disponível). Bloqueado = R$ 50 × 30/100 = R$ 15 exatamente. Se houver
  quebra em centavos, o resíduo vai para a de maior saldo, e a soma fecha em R$ 30.

## Fontes do conhecimento

- [docs/especificacoes/EF-02-contas.md](../../../docs/especificacoes/EF-02-contas.md) — EF
  aceita (Portão A) que define Conta, seus campos, e as regras RN-06, RN-07, RN-08. Fonte
  primária de estrutura de dados e validação.
- [docs/especificacoes/EF-06-lastro.md](../../../docs/especificacoes/EF-06-lastro.md) — EF
  aceita que define o conceito de **lastro** e as regras RN-27 a RN-32. Marcada como "Escalada de
  Regra #0": o lastro **não é conhecimento de domínio financeiro**, é **regra de produto**,
  nascida no protótipo e decidida com o humano. Não há outra fonte de mercado.
- [docs/decisoes/D-06-dinheiro-em-centavos.md](../../../docs/decisoes/D-06-dinheiro-em-centavos.md)
  — ADR aceita que decide que dinheiro é inteiro em centavos na pilha toda, e como lidar com
  resíduos de divisão. Obrigatória para toda implementação de lastro e parcelamento.
- Protótipo funcional no Claude Design: `Orcamento Familiar.dc.html` e Desktop — a lógica visual
  e os casos de uso são derivados dali (ver restrições em EF-02 §4 sobre o que não se copia).
