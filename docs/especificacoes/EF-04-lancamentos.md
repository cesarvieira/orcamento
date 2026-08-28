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
| RN-39 | `recebido` da competência = **soma dos lançamentos `RECEITA`** daquela competência        | leitura da competência            | decisão do humano, 2026-08-27                    |

**RN-18 e RN-19 juntas são competência × caixa** — a fonte de confusão mais comum em app de
finanças, e a que o mockup acerta.

**RN-39 nasceu fora desta EF, e isso está dito de propósito.** Ela foi decidida durante a
[EF-03](EF-03-orcamento.md): RN-11 define `não alocado = recebido − planejado`, e nenhuma EF
dizia como `recebido` era apurado — `recebido` aparecia como **nome de campo de tela** aqui
no §3 e em [EF-08](EF-08-fechamento.md) §3, sem definição de cálculo. Uma revisão de diff
barrou a skill de orçamento que tentou preencher a lacuna por conta própria, porque a regra
não é dela: `Lancamento` é deste módulo, logo a agregação é daqui.

**O que RN-39 NÃO decide:** se `recebido` conta a competência do lançamento (RN-15) ou a data
de caixa. Ela diz **competência**, coerente com RN-15 e com o fato de `não alocado` ser leitura
de uma competência — mas o par competência × caixa de RN-18/RN-19 merece um olhar quando esta
EF for construída de verdade.

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

> Marcado com o que a história **provou de fato** — medido, não declarado. Detalhe RN a RN,
> `arquivo:linha`, em [MC-04](MC-04-lancamentos.md).

- [x] Um teste de integração por RN acima — **exceto RN-22**, cujo guarda está testado mas cujo
      caso positivo depende de `fechamentos_mes` ([EF-08](EF-08-fechamento.md), #22, não
      construída); marcar RN-22 como coberta seria mentira auditável. Ver `MC-04`, `EF04-MC-001`
- [x] **Parcela final:** soma das parcelas == total, com valor quebrado (100,00 em 3× → 33,33 ·
      33,33 · 33,34) — `api/testes/lancamentos.teste.ts:356-374`
- [x] Compra no crédito não altera o saldo da conta — `lancamentos.teste.ts:213-236`. **RN-19
      só está coberta na metade negativa**: o saldo se mover quando a fatura é paga é da
      [EF-05](EF-05-faturas.md), #19, não construída. Ver `MC-04`, `EF04-MC-002`
- [x] Retroativo não consome o teto do mês corrente — `lancamentos.teste.ts:301-352`
- [x] Transferência não aparece como gasto de categoria nenhuma — `lancamentos.teste.ts:170-195`
- [x] Extrato abre no artefato de deploy, **incluindo o estado vazio** — provado que abre e mostra
      vazio (gate de navegação), mas o seed não tem lançamento nenhum
      (`api/src/db/semear.ts:60`), então o vazio exercitado é o 🟨 "família sem histórico", nunca
      o 🟦 "por filtro/mês" do mockup. Ver `MC-04`, `EF04-MC-003`
- [x] Isolamento entre famílias — 4 testes, `lancamentos.teste.ts:836-895`. **Dois clientes veem a
      mudança sem refresh:** provado — mecanismo genérico e o caso específico de dois sockets da
      MESMA família contra `lancamentos` (`api/testes/realtime.teste.ts:111-149`). A lacuna existiu
      (só havia prova de isolamento entre famílias) e foi fechada pela tarefa #64. Ver `MC-04`,
      `EF04-MC-005`
- [x] `PROVA_DE_COMPORTAMENTO=PASS` — nas seis tarefas mescladas (`708b068`, `c771b1b`, `fb1c131`,
      `675bfe5`, `fdb9f6f`, `e647bfa`), última rodada com 180 testes

## §6 — Forks

Os dois forks abertos por esta EF foram **fechados pelo humano em 2026-08-27**, no aval que
decompôs a história #18 (comentário da issue #18). Registrados aqui como decisão, não como
pergunta em aberto:

1. **Excluir uma parcela apaga a série inteira ou só aquela parcela?** — **Decidido: o detalhe
   pergunta o alcance.** `DELETE /lancamentos/{id}?modo=esta|todas|a-partir-desta` — `esta` remove
   só a linha, `todas` remove a série inteira, `a-partir-desta` remove esta e as de competência
   posterior. Esta caixa de diálogo **não tem fonte no desenho** (no mockup, compra parcelada
   gerava um lançamento só — §4 desta EF); construída no vocabulário visual das outras folhas do
   app. Para um lançamento avulso (sem série), "Excluir" continua batendo com o desenho: apaga
   direto, sem perguntar. Implementado e testado em `api/testes/lancamentos.teste.ts:543-702`;
   registrado como decisão do humano em `web/app/components/ModalDetalheLancamento.vue:12-34`.
2. **RN-22 (competência selada)** — **Decidido: o guarda fica como selo `@fundacao` apontando a
   EF-08.** `competenciaEstaSelada` (`api/src/modulos/lancamentos/servico.ts:109-129`) é o ponto de
   checagem nomeado, chamado nos dois lugares de escrita, e hoje sempre libera — a query exata que
   substitui o `return false` está comentada no código, para a EF-08 (#22) trocar sem tocar em
   mais nada. O caso positivo (lançamento de fato recusado por selagem) fica **pendente da EF-08**,
   registrado em `MC-04` (`EF04-MC-001`), não escondido.

**Suposição declarada pelo condutor (2026-08-27), consumida e provada:** `series_parcelas.total`
(`totalCentavos`) e `quantidade` guardam a **compra original** e não são reescritos por exclusão de
parcelas — mesmo motivo de `criadoPorMembroId` ser imutável (RN-16). RN-21 vale **na geração**, que
é onde esta EF a especifica no §2. Provado direto no banco em
`api/testes/lancamentos.teste.ts:671-681`. Foi esta suposição que gerou o defeito medido e corrigido
pela tarefa #62 (`Lancamento` não expunha o total da série — ver `MANUAL-04`).
