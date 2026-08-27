# EF-07 — Metas e reservas

## §0 — Escopo & fronteira

**Pasta:** `api/src/modulos/metas` · `web/app/pages/metas`.

**É deste módulo:** o objetivo de poupança e o ato de guardar. **Não é:** a conta de reserva em si
([EF-02](EF-02-contas.md)) nem o efeito no lastro ([EF-06](EF-06-lastro.md)) — este módulo produz
o movimento que os dois refletem.

---

## §1 — Dados

| Entidade | Papel                | Decisão                                         |
| -------- | -------------------- | ----------------------------------------------- |
| `Meta`   | objetivo de poupança | nome, `alvoCentavos`, conta `RESERVA` vinculada |

**O acumulado é derivado**, não coluna: é a soma das transferências para a conta de reserva
vinculada. Guardar um `atual` materializado criaria a segunda verdade de sempre.

---

## §2 — Regras

| #     | Regra                                                    | Onde é imposta           | Fonte                         |
| ----- | -------------------------------------------------------- | ------------------------ | ----------------------------- |
| RN-33 | Guardar em meta é uma **`TRANSFERENCIA`**, nunca despesa | serviço                  | [EF-04](EF-04-lancamentos.md) |
| RN-34 | Guardar sai do **não alocado** do mês                    | leitura da competência   | mockup                        |
| RN-35 | Conta `RESERVA` fica fora do orçamento e fora do lastro  | [EF-06](EF-06-lastro.md) | decisão humana                |

**Consequência que parece bug e não é:** guardar reduz o caixa de débito e, portanto, **reduz o
lastro do mês** (RN-35 mais RN-27). Está correto e é intencional — o dinheiro passou a estar
comprometido com a meta. Quem não entender isso vai "consertar" a regra.

---

## §3 — Telas

**Referência de tela:** tela `metas` do mockup.

| Recurso | Rota     | Fluxo                                                     |
| ------- | -------- | --------------------------------------------------------- |
| Metas   | `/metas` | alvo · acumulado · barra de progresso · botões de guardar |

O subtítulo do mockup enuncia a regra e deve permanecer: _"Guardar sai do não alocado do mês."_

---

## §4 — O que não se copia do protótipo

Os botões _Guardar 100_ e _Guardar 500_ incrementam o acumulado direto no estado, sem mover
dinheiro de conta nenhuma. No produto, guardar é transferência real.

---

## §5 — Definition of Done

- [ ] Um teste por RN acima
- [ ] **Guardar não consome teto de categoria nenhuma** — teste explícito
- [ ] Guardar **reduz o lastro** — teste explícito, para ninguém "corrigir" depois
- [ ] Isolamento entre famílias · dois clientes veem o valor guardado sem refresh
- [ ] `PROVA_DE_COMPORTAMENTO=PASS`
