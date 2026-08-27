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
| RN-25 | O saldo exibido do cartão é a **fatura em aberto do ciclo corrente**, não tudo que já se gastou | leitura                   | mockup                   |
| RN-26 | O `limite livre` do cartão é `limite − fatura em aberto`                                        | leitura                   | [EF-06](EF-06-lastro.md) |

**RN-26 é a ponte para o lastro.** O limite livre alimenta o cálculo do produto — então **errar o
ciclo erra o lastro**. É por isso que esta EF vem antes da EF-06.

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

Casos de teste **obrigatórios** — é aqui que o ciclo quebra:

- [ ] Compra **no dia** do fechamento
- [ ] Compra **no dia seguinte** ao fechamento → cai na fatura seguinte
- [ ] Parcela que **atravessa** ciclos
- [ ] Após o pagamento, o extrato filtrado por cartão continua correto
- [ ] O `limite livre` reflete a fatura em aberto do ciclo corrente
- [ ] Isolamento entre famílias · dois clientes veem o pagamento sem refresh
- [ ] `PROVA_DE_COMPORTAMENTO=PASS`
