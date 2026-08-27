# EF-02 — Contas

## §0 — Escopo & fronteira

**Pasta:** `api/src/modulos/contas` · `web/app/pages/contas`.

**É deste módulo:** cadastro e saldo das contas. **Não é:** a fatura do cartão (que é da
[EF-05](EF-05-faturas.md)) nem o lastro (da [EF-06](EF-06-lastro.md)) — este módulo entrega os
dados que os dois consomem.

---

## §1 — Dados

| Entidade | Papel                | Decisão                                  |
| -------- | -------------------- | ---------------------------------------- |
| `Conta`  | onde o dinheiro está | `tipo`: `DEBITO` · `CREDITO` · `RESERVA` |

| Campo                            | Tipo    | Só para             |
| -------------------------------- | ------- | ------------------- |
| `nome`, `icone`, `cor`           | texto   | todas               |
| `saldoInicialCentavos`           | inteiro | `DEBITO`, `RESERVA` |
| `limiteCentavos`                 | inteiro | `CREDITO`           |
| `diaFechamento`, `diaVencimento` | 1–28    | `CREDITO`           |

**Por que 1–28:** dia 29–31 não existe em todo mês, e o ciclo de fatura precisa de uma data que
sempre exista. Aceitar 31 obrigaria a uma regra de "último dia do mês" que ninguém pediu. O
mockup já limita a 28 — aqui isso vira restrição, não acaso.

**O saldo é derivado**, não coluna: `saldoInicial` mais os lançamentos da conta. Guardar saldo
materializado criaria uma segunda verdade que diverge no primeiro lançamento retroativo.

---

## §2 — Regras

| #     | Regra                                                                   | Onde é imposta           | Fonte                    |
| ----- | ----------------------------------------------------------------------- | ------------------------ | ------------------------ |
| RN-06 | Conta com lançamentos **não pode ser excluída**                         | `DELETE /contas/:id`     | mockup                   |
| RN-07 | Conta `RESERVA` fica **fora do orçamento e fora do lastro**             | leitura de saldo e EF-06 | [EF-06](EF-06-lastro.md) |
| RN-08 | `diaFechamento` e `diaVencimento` só existem em `CREDITO`, e valem 1–28 | schema + validação       | esta EF                  |

---

## §3 — Telas

**Referência de tela:** tela `contas` do mockup + a folha de cadastro/edição (`sheetConta`).

| Recurso          | Rota      | Fluxo                                                           |
| ---------------- | --------- | --------------------------------------------------------------- |
| Lista            | `/contas` | saldo real por conta · "em conta hoje" no topo                  |
| Cadastrar/editar | folha     | nome → tipo → valor → (cartão: fechamento e vencimento) → ícone |

O rótulo do campo de valor muda com o tipo: _Saldo atual_ para débito e reserva, _Limite do
cartão_ para crédito.

---

## §4 — O que não se copia do protótipo

O mockup **captura** `fechamento` e `vencimento` e **não usa nenhum dos dois** — a fatura dele
soma o mês civil. Aqui os dois campos existem para serem usados pela [EF-05](EF-05-faturas.md).
Capturar dado que ninguém lê é como não ter o campo.

---

## §5 — Definition of Done

- [ ] Um teste de integração por RN acima
- [ ] Excluir conta com lançamento é recusado com mensagem clara
- [ ] Isolamento entre famílias
- [ ] Dois clientes: a conta criada num aparece no outro sem refresh
- [ ] A tela abre no artefato de deploy, com dado do seed
- [ ] `PROVA_DE_COMPORTAMENTO=PASS`
