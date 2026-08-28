# EF-05 — Faturas

> **A EF de maior risco técnico do produto.** É onde o app bate — ou não bate — com o extrato do
> banco.

## §0 — Escopo & fronteira

**Pasta:** `api/src/modulos/faturas` · `web/app/pages/faturas`.

**É deste módulo:** o ciclo do cartão, os itens da fatura e o pagamento. **Não é:** o lançamento
em si ([EF-04](EF-04-lancamentos.md)) nem o cadastro do cartão ([EF-02](EF-02-contas.md)).

---

## §1 — Dados

| Entidade | Papel          | Decisão                                                              |
| -------- | -------------- | -------------------------------------------------------------------- |
| `Fatura` | cartão × ciclo | `abreEm`, `fechaEm`, `venceEm`, `status`, `pagaEm`, `pagaComContaId` |

`Fatura` é **entidade**, não soma calculada na hora. Sem ela não há onde registrar _quando_ foi
paga nem _por qual conta_ — e sem isso o histórico é irrecuperável.

**O lançamento não muda de conta ao pagar.** O pagamento é um `TRANSFERENCIA` próprio, entre a
conta pagadora e o cartão.

---

## §2 — Regras

| #     | Regra                                                                                           | Onde é imposta            | Fonte                    |
| ----- | ----------------------------------------------------------------------------------------------- | ------------------------- | ------------------------ |
| RN-23 | A compra entra na fatura cujo **ciclo de fechamento** contém a data — não o mês civil           | serviço de fatura         | [EF-02](EF-02-contas.md) |
| RN-24 | Pagar é **transferência**; os lançamentos originais **mantêm** sua conta de origem              | `POST /faturas/:id/pagar` | esta EF                  |
| RN-25 | O saldo exibido do cartão é a **fatura em aberto** — **D1**: toda fatura não paga (a fechada aguardando pagamento **mais** a do ciclo corrente) | leitura                   | mockup + decisão humana (D1, 2026-08-28) |
| RN-26 | O `limite livre` do cartão é `limite − fatura em aberto` (mesma definição de D1, ver EF-06 §2)   | leitura                   | [EF-06](EF-06-lastro.md) + decisão humana (D1) |

**RN-26 é a ponte para o lastro.** O limite livre alimenta o cálculo do produto — então **errar o
ciclo erra o lastro**. É por isso que esta EF vem antes da EF-06.

### D1 · "fatura em aberto" — decisão humana (2026-08-28)

> **"Fatura em aberto" = TODA fatura não paga** — a fechada aguardando pagamento **mais** a do
> ciclo corrente. O limite livre só se recompõe **no pagamento** (RN-24), nunca no fechamento.

Esta RN-25 dizia originalmente *"a fatura em aberto do **ciclo corrente**"* — leitura estreita, só
o que está acumulando agora. A [EF-06 §2](EF-06-lastro.md), na fórmula `limiteLivre = Σ (limite −
fatura em aberto)`, usa a mesma expressão sem qualificar "do ciclo corrente". Duas fontes, mesma
expressão, dois escopos possíveis — e a EF-06 seria construída contra a leitura errada enquanto o
texto ficasse assim.

**D1 resolve a favor do escopo amplo.** Consequência: o **saldo exibido do cartão** (esta RN-25)
passa a ser *tudo que não foi pago* — a fatura fechada aguardando pagamento **mais** o total
acumulado até agora no ciclo corrente —, não apenas o ciclo corrente isolado. Uma fatura `FECHADA`
(aguardando pagamento) ainda consome limite do cartão até ser quitada; contá-la só enquanto durava
o ciclo corrente devolveria limite prematuramente no **fechamento**, em vez de no **pagamento**
(RN-24) — que é exatamente o "errar o ciclo erra o lastro" que esta EF anuncia na abertura.

Decisão registrada por completo — com o cenário numérico e o cuidado de nomenclatura (o enum
`status = ABERTA` não é sinônimo do termo de negócio "fatura em aberto"; uma fatura `FECHADA`
também está "em aberto" no sentido de D1) — em
`.preator/skills/negocio/faturas-e-ciclo-do-cartao/SKILL.md`, seção "D1 · 'fatura em aberto' —
decisão humana (2026-08-28)". Implementado em `api/src/modulos/faturas/servico.ts` (a query usa
`ne(status, 'PAGA')`, nunca `eq(status, 'ABERTA')`) e em
`api/src/modulos/contas/servico.ts#expressaoSaldoDerivado` (o `saldoCentavos` de uma conta
`CREDITO` é `−Σ(fatura em aberto, D1)`).

---

## §3 — Telas

**Referência de tela:** tela `fatura` do mockup.

| Recurso | Rota       | Fluxo                                                          |
| ------- | ---------- | -------------------------------------------------------------- |
| Fatura  | `/faturas` | total · datas do ciclo · limite livre · itens · botão de pagar |

O aviso do mockup está correto e deve permanecer: _"Cada compra no crédito já saiu da categoria.
O saldo da conta só muda quando a fatura é paga."_

---

## §4 — O que não se copia do protótipo

**As duas piores armadilhas do desenho estão aqui.**

1. **Pagar a fatura reatribui os lançamentos** do cartão para a conta corrente. Depois disso
   ninguém sabe que a compra foi no cartão — o extrato filtrado por cartão passa a mentir.
2. **O ciclo é ignorado.** O protótipo soma os lançamentos do mês civil, desprezando os campos de
   fechamento e vencimento que ele mesmo captura.

---

## §5 — Definition of Done

Casos de teste **obrigatórios** — é aqui que o ciclo quebra. Marcado contra o teste que prova cada
item (`api/testes/faturas-ciclo.teste.ts`, tarefa #72) — não contra o relato de ninguém:

- [x] Compra **no dia** do fechamento — `faturas-ciclo.teste.ts:267-306` (Caso 1/2)
- [x] Compra **no dia seguinte** ao fechamento → cai na fatura seguinte — `faturas-ciclo.teste.ts:308-313`
- [x] Parcela que **atravessa** ciclos — `faturas-ciclo.teste.ts:333-377` (Caso 3, inclusive virada de ano)
- [x] Após o pagamento, o extrato filtrado por cartão continua correto — `faturas-ciclo.teste.ts:387-463` (Caso 4)
- [x] O `limite livre` reflete a fatura em aberto — **D1**: toda fatura não paga (a fechada
      aguardando pagamento **mais** o ciclo corrente), não só o ciclo corrente isolado (ver D1 em
      §2) — `faturas-ciclo.teste.ts:473-537` (Caso 5, prova as duas somadas e a recomposição só no
      pagamento)
- [x] Isolamento entre famílias · dois clientes veem o pagamento sem refresh — `faturas-ciclo.teste.ts:546-651` (Caso 6)
- [x] `PROVA_DE_COMPORTAMENTO=PASS` — carimbado pelo condutor em cada merge desta história:
      `cf2268f` (#69), `1a102bf` (#70), `24be46e` (#71), `fa741e2` (#72) — ver MANUAL-05 "Prova
      rodada" para o detalhe por tarefa
