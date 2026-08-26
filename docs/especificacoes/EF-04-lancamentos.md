# EF-04 — Lançamentos

## §0 — Escopo & fronteira

**Pasta:** `api/src/modulos/lancamentos` · `web/app/pages/index` (visão do mês) e `/extrato`.

**É deste módulo:** registrar, listar, detalhar e excluir lançamento. **Não é:** a fatura
([EF-05](EF-05-faturas.md)) nem o lastro ([EF-06](EF-06-lastro.md)).

---

## §1 — Dados

| Entidade        | Papel                         | Decisão                                         |
| --------------- | ----------------------------- | ----------------------------------------------- |
| `Lancamento`    | um movimento                  | `tipo`: `RECEITA` · `DESPESA` · `TRANSFERENCIA` |
| `SerieParcelas` | agrupa parcelas de uma compra | total, quantidade; as parcelas apontam para cá  |

| Campo                        | Nota                                                          |
| ---------------------------- | ------------------------------------------------------------- |
| `valorCentavos`              | inteiro; ver [D-06](../decisoes/D-06-dinheiro-em-centavos.md) |
| `data` · `competencia`       | **colunas distintas**; competência calculada na escrita       |
| `categoriaId`                | obrigatório em `DESPESA`; nulo em `RECEITA` e `TRANSFERENCIA` |
| `contaId` · `contaDestinoId` | destino só em `TRANSFERENCIA`                                 |
| `criadoPorMembroId`          | **imutável**                                                  |

**Tipo explícito, não sinal.** O protótipo representa receita como valor negativo com categoria
nula. Funciona para somar e falha para relatar, filtrar e validar — e torna `TRANSFERENCIA`
inexprimível.

---

## §2 — Regras

| #     | Regra                                                                                     | Onde é imposta                    | Fonte                                            |
| ----- | ----------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------ |
| RN-15 | Lançamento com data em mês anterior **não consome o teto do mês corrente**                | cálculo da competência na escrita | mockup                                           |
| RN-16 | Todo lançamento registra o autor, de forma **imutável**                                   | handler                           | mockup                                           |
| RN-17 | **Transferência não é despesa** e não consome teto de categoria                           | validação + leitura               | [D-06](../decisoes/D-06-dinheiro-em-centavos.md) |
| RN-18 | Compra no crédito consome a categoria **na data da compra** e não altera o saldo da conta | leitura de saldo                  | mockup                                           |
| RN-19 | O saldo da conta só se move quando a fatura é paga                                        | [EF-05](EF-05-faturas.md)         | mockup                                           |
| RN-20 | Parcelamento até 48×: gera **N lançamentos**, um por competência                          | serviço                           | `financeiro/credito`                             |
| RN-21 | O resíduo do parcelamento vai para a **última** parcela; a soma é exatamente o total      | serviço                           | D-06                                             |
| RN-22 | Competência **selada** não aceita novo lançamento                                         | validação                         | [EF-08](EF-08-fechamento.md)                     |

**RN-18 e RN-19 juntas são competência × caixa** — a fonte de confusão mais comum em app de
finanças, e a que o mockup acerta.

---

## §3 — Telas

**Referência de tela:** folha de novo lançamento (`sheetLanc`) · tela `home` (Visão do mês) ·
tela `extrato` · modal de detalhe.

| Recurso         | Rota               | Fluxo                                                                                   |
| --------------- | ------------------ | --------------------------------------------------------------------------------------- |
| Novo lançamento | folha, FAB central | teclado de valor · categoria · conta · data · parcelas · atalhos                        |
| Visão do mês    | `/`                | recebido · previsto · planejado · não alocado · categorias                              |
| Extrato         | `/extrato`         | agrupado por dia · filtro por conta · estado vazio é tela de verdade                    |
| Detalhe         | modal              | descrição · valor · categoria · conta · data · **quem lançou** · parcelamento · excluir |

---

## §4 — O que não se copia do protótipo

- **Receita como valor negativo** — ver §1.
- **Transferência não existe** no protótipo, mas _pagar fatura_ e _guardar em meta_ são
  transferências. Sem o tipo, viram despesa e corrompem teto, gasto e lastro de uma vez.
- **Parcelamento gera um lançamento só** no mockup. Aqui gera N.

---

## §5 — Definition of Done

- [ ] Um teste de integração por RN acima
- [ ] **Parcela final:** soma das parcelas == total, com valor quebrado (ex.: 100,00 em 3×)
- [ ] Compra no crédito não altera o saldo da conta
- [ ] Retroativo não consome o teto do mês corrente
- [ ] Transferência não aparece como gasto de categoria nenhuma
- [ ] Extrato abre no artefato de deploy, **incluindo o estado vazio**
- [ ] Isolamento entre famílias · dois clientes veem a mudança sem refresh
- [ ] `PROVA_DE_COMPORTAMENTO=PASS`

## §6 — Forks abertos

**Excluir uma parcela apaga a série inteira ou só aquela parcela?** Não está decidido. Escalar ao
humano antes de implementar — não inventar.
