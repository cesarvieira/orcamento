# EF-08 — Fechamento do mês

## §0 — Escopo & fronteira

**Pasta:** `api/src/modulos/fechamento` · `web/app/pages/fechamento`.

**É deste módulo:** o resumo da competência e o ato de selá-la. **Não é:** mover dinheiro.

---

## §1 — Dados

| Entidade        | Papel              | Decisão                                                    |
| --------------- | ------------------ | ---------------------------------------------------------- |
| `FechamentoMes` | competência selada | `competencia`, `sobraCentavos` apurada, `fechadoEm`, autor |

**Fechar não gera lançamento.** É registro contábil da competência, não movimento de caixa.

---

## §2 — Regras

| #     | Regra                                                                        | Onde é imposta                             | Fonte                 |
| ----- | ---------------------------------------------------------------------------- | ------------------------------------------ | --------------------- |
| RN-36 | Fechar o mês **sela a competência**. A sobra **permanece na conta corrente** | `POST /competencias/:c/fechar`             | decisão humana        |
| RN-37 | Competência selada **não aceita novo lançamento**                            | validação em [EF-04](EF-04-lancamentos.md) | esta EF               |
| RN-38 | A sobra, por ficar em caixa, entra no **lastro do mês seguinte**             | [EF-06](EF-06-lastro.md)                   | consequência de RN-36 |

**Por que a sobra não vai para a reserva.** Fechar o mês é operação de **contabilidade**; guardar
é operação de **caixa**. Juntar as duas num botão faz o app mover dinheiro sem que a família tenha
pedido.

E há um efeito colateral elegante: como a sobra fica em caixa, ela **aumenta o lastro do mês
seguinte** — um mês contido amplia o teto liberado do próximo, sozinho, pelo mesmo mecanismo de
desbloqueio da [EF-06](EF-06-lastro.md). Se a sobra fosse para a reserva, ela sairia do lastro
(RN-27) e o efeito seria o oposto: **economizar apertaria o mês seguinte**. Contraintuitivo e
desmotivador.

RN-37 dá ao retroativo ([RN-15](EF-04-lancamentos.md)) um limite claro: pode-se lançar em mês
anterior **aberto**, nunca em mês fechado.

---

## §3 — Telas

**Referência de tela:** tela `fechamento` do mockup.

| Recurso    | Rota          | Fluxo                                                                         |
| ---------- | ------------- | ----------------------------------------------------------------------------- |
| Fechamento | `/fechamento` | recebido · planejado · gasto · sobra projetada · onde passou do teto · fechar |

---

## §4 — O que não se copia do protótipo

**Duas frases do mockup ficaram incorretas** com RN-36 e mudam junto com esta EF:

| No mockup                              | Deve ser             |
| -------------------------------------- | -------------------- |
| botão _"Fechar mês e guardar a sobra"_ | _"Fechar mês"_       |
| aviso _"movidos para a Reserva"_       | sem menção à reserva |

---

## §5 — Definition of Done

- [ ] Um teste por RN acima
- [ ] **Fechar não cria lançamento nem altera saldo de conta nenhuma**
- [ ] Competência selada recusa novo lançamento, inclusive retroativo
- [ ] A sobra aparece no **lastro da competência seguinte**
- [ ] A tela abre no artefato de deploy, incluindo o estado _"nenhuma categoria passou do teto"_
- [ ] Isolamento entre famílias · dois clientes veem o fechamento sem refresh
- [ ] `PROVA_DE_COMPORTAMENTO=PASS`
