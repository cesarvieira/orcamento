# EF-03 — Orçamento

## §0 — Escopo & fronteira

**Pasta:** `api/src/modulos/orcamento` · `web/pages/orcamento`.

**É deste módulo:** categorias, o teto de cada uma por competência, e o remanejo entre elas.
**Não é:** o gasto (que vem dos lançamentos, [EF-04](EF-04-lancamentos.md)) nem o bloqueio por
falta de lastro ([EF-06](EF-06-lastro.md)).

---

## §1 — Dados

| Entidade | Papel | Decisão |
|---|---|---|
| `Categoria` | envelope de gasto | nome, ícone, cor — **sem valor** |
| `OrcamentoMes` | categoria × competência × teto | a tabela que torna o remanejo mensal possível |
| `Remanejamento` | histórico de quem moveu teto | origem, destino, valor, competência, autor |

**Por que o teto não fica na `Categoria`:** remanejar altera o teto **só do mês corrente**. Se o
teto fosse atributo da categoria, remanejar em agosto mudaria setembro também — e o histórico de
agosto seria reescrito toda vez que alguém ajustasse o mês seguinte.

`RendaPrevista` é atributo da competência, não da categoria: é referência de planejamento.

---

## §2 — Regras

| # | Regra | Onde é imposta | Fonte |
|---|---|---|---|
| RN-09 | O teto pertence ao par **categoria × competência**, nunca à categoria | schema + handlers | mockup |
| RN-10 | `disponível = teto − gasto do mês`. Negativo significa **estourou** | leitura da competência | mockup |
| RN-11 | `planejado = Σ tetos`; `não alocado = recebido − planejado` | leitura da competência | mockup |
| RN-12 | Renda acima da prevista **não altera teto nenhum** | — | [EF-06](EF-06-lastro.md) |
| RN-13 | Remanejar altera **só a competência corrente**, e registra quem fez | `POST /competencias/:c/remanejamentos` | mockup |
| RN-14 | Sem categoria com sobra, o app oferece **deixar negativo** — não trava | tela | mockup |

**RN-12 merece cuidado.** O mockup escreve *"os tetos se ajustam sozinhos ao que entrou"*, o que
sugere teto subindo. Não é isso: o valor do teto **nunca** muda sozinho. O que se ajusta é o
*desbloqueio* — mais dinheiro aumenta o lastro, o déficit cai e o teto que já existia fica
liberado. Ver [EF-06](EF-06-lastro.md).

---

## §3 — Telas

**Referência de tela:** tela `config` do mockup ("Orçamento do mês") + folha de editar categoria
(`sheetEditCat`) + folha de remanejar (`sheetRemanejar`).

| Recurso | Rota | Fluxo |
|---|---|---|
| Orçamento do mês | `/orcamento` | renda prevista · lista de categorias com teto · criar · apagar |
| Editar categoria | folha | nome · cor · ícone |
| Remanejar | folha | escolher de onde tirar, com sugestão por fonte · ou deixar negativo |

**Copy a corrigir:** trocar *"os tetos se ajustam sozinhos ao que entrou"* por *"os tetos se
desbloqueiam conforme o dinheiro entra"*. A frase original está tecnicamente correta e induz ao
erro.

---

## §4 — O que não se copia do protótipo

O mockup guarda `teto` dentro da categoria. É o atalho que a §1 corrige — e o único ponto do
desenho que, copiado, quebraria o histórico mensal.

---

## §5 — Definition of Done

- [ ] Um teste de integração por RN acima
- [ ] **Remanejar em agosto não altera setembro** — teste explícito
- [ ] O histórico registra quem remanejou
- [ ] Estado sem fonte disponível abre e oferece deixar negativo
- [ ] Isolamento entre famílias · dois clientes veem a mudança sem refresh
- [ ] `PROVA_DE_COMPORTAMENTO=PASS`
