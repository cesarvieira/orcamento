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

> **As-built (tarefa #89).** Cada item marcado contra a evidência que o prova — arquivo e linha,
> nunca "passou de memória". A matriz completa, por capacidade, está em
> [MC-07](MC-07-metas.md#matriz-de-completude); aqui só o veredito e as decisões que a execução
> tomou. Fato duplicado é bug — os números de teste não são repetidos aqui, só apontados.

- [x] Um teste por RN acima — RN-33 (`api/testes/metas.teste.ts:178`,
      `api/testes/metas-dod.teste.ts:204`), RN-34/D1 (`metas.teste.ts:250`,
      `metas-dod.teste.ts:240,258,269` — as três bordas: acima, exato, zero), RN-35
      (`metas.teste.ts:308`, `metas-dod.teste.ts:300,368` — os dois ângulos: a conta em si e o
      efeito de guardar) — ver MC-07 para a tabela completa de `describe`
- [x] **Guardar não consome teto de categoria nenhuma** — teste explícito —
      `api/testes/metas.teste.ts:217-243` e `api/testes/metas-dod.teste.ts:334-357` (valores
      quebrados, teto/gasto/disponível bit-a-bit idênticos antes e depois)
- [x] Guardar **reduz o lastro** — teste explícito —
      `api/testes/metas.teste.ts:308-326` e `api/testes/metas-dod.teste.ts:368-384` (queda exata do
      valor guardado, valor quebrado) — ver "a previsão de MC-06/119 conferida" abaixo
- [x] Isolamento entre famílias — `api/testes/metas.teste.ts:523-558` e
      `api/testes/metas-dod.teste.ts:486-525` (inclusive `familiaId` forjado no corpo e conta de
      origem de outra família); dois clientes veem o valor guardado sem refresh —
      `api/testes/metas.teste.ts:564-652` e `api/testes/metas-dod.teste.ts:536-575`
- [x] `PROVA_DE_COMPORTAMENTO=PASS` — carimbado em cada merge desta história (#85 a #88). ⚠️
      **Diferente do padrão da EF-06/#79**: os commits de merge desta história (`79269b6`,
      `de255fa`, `fe13fe2`, `e75c26d`) têm corpo **vazio** — conferido com
      `git show -s --format=%B <hash>` nos quatro —, então o carimbo e o número de testes por
      tarefa **não estão** no histórico de git. A única fonte é a tabela de linhagem que o condutor
      registrou na issue #89 (reproduzida em MANUAL-07 e MC-07), a mesma classe de fato que
      "morre se não for escrito". O número TOTAL de testes do módulo, esse sim conferido por esta
      tarefa nos arquivos: `api/testes/metas.teste.ts` (10 `describe`, 27 `it`) +
      `api/testes/metas-dod.teste.ts` (10 `describe`, 13 `it`) = 40 casos de teste próprios de
      `metas`, batendo com "13 testes" que o próprio cabeçalho de `metas-dod.teste.ts:21` cita.

### As decisões e derivações que a execução tomou

**D1 · RN-34 é um TETO, não um rótulo de tela** — decisão humana, 2026-08-29. A API recusa guardar
acima do não alocado da competência; com `naoAlocado ≤ 0`, recusa qualquer valor. Antes desta
decisão a frase existia só como subtítulo de tela no mockup, sem imposição — ver
`.preator/skills/negocio/metas-e-reservas/SKILL.md` D1 para o registro completo (inclusive por que
"consertar" isto depois seria regressão, não limpeza). Imposto em
`api/src/modulos/metas/servico.ts:233-240`; testado nas três bordas (acima, exato, zero) em
`api/testes/metas-dod.teste.ts:240-288`.

**D2 · A conta de origem vem do corpo, nunca inferida** — decisão humana, 2026-08-29, repetição
literal do precedente D3 · Seletor de conta pagadora (`docs/manual/MANUAL-05-faturas.md:267`,
`docs/especificacoes/MC-05-faturas.md:34,39` — **não** na EF-05, que não cita D3; esse ponteiro
específico foi o que derrubou a revisão da tarefa #85, ver MC-07). Imposto em
`api/src/modulos/metas/esquemas.ts:55-63` (schema exige `contaOrigemId` no corpo) e
`api/src/modulos/metas/servico.ts:219` (busca a conta do corpo, nunca deduz).

**D3 · A meta É um cofrinho, com a PRÓPRIA conta `RESERVA`** — decisão humana, 2026-08-29. Criada
junto (saldo inicial 0), vínculo 1:1 único imposto por `uniqueIndex('metas_conta_reserva_unica')`
(`api/src/db/schema.ts:698`, migration `api/drizzle/0008_wet_millenium_guard.sql:15`). ⚠️ **O
mockup mostra o contrário** — uma "Poupança" com três metas — rejeitado porque, com conta
compartilhada, as três exibiriam o mesmo acumulado (a fórmula de §1 deriva o acumulado da conta
vinculada). Testado: `api/testes/metas.teste.ts:154-172` (duas metas, contas distintas) e
`api/testes/metas-dod.teste.ts:416-441` (três guardares intercalados em dois cofrinhos, acumulados
nunca se misturam).

**D4 · Criar cofrinho é superfície NOVA na tela** — decisão humana, 2026-08-29, autorizada porque o
desenho só tem a lista. Construída em `web/app/pages/metas.vue:384-418` (a folha), reaproveitando o
vocabulário visual de `sheetConta` (`contas.vue`) — mesmo padrão já usado pela caixa de exclusão de
parcela ([EF-04 §6](EF-04-lancamentos.md), fork 1).

**D5 · Guardar escolhe as duas pontas** — conta de origem e cofrinho de destino, nenhuma inferida.
Imposto pelo tipo de `DadosDeGuardar` (`api/src/modulos/metas/servico.ts:203-209`) e pela tela
(`web/app/pages/metas.vue:96-125`, o seletor de conta débito, default na primeira mas sempre
trocável).

**A previsão de MC-06:119/MANUAL-06:202 se cumpriu.** As duas fontes previram que, quando a EF-07
nascesse, ela herdaria o efeito no lastro já pronto (RN-27/RN-35 sendo a mesma regra por dois
nomes) e não precisaria recalcular nada. Conferido nesta tarefa:
`git log --oneline -- api/src/modulos/lastro/servico.ts` lista só três commits, todos anteriores a
esta história (`eb815ef`, `3aa59b1`, `1b81f1f` — os três de #76/EF-06); e
`git diff 79269b6^..e75c26d -- api/src/modulos/lastro/servico.ts` (o intervalo inteiro da história
#21) devolve **vazio**. Nenhuma linha de `lastro/servico.ts` mudou para a EF-07 existir — a exclusão
da conta `RESERVA` do lastro já era propriedade da CONTA (filtro `tipo === 'DEBITO'` em
`lastro/servico.ts:50-54`), não algo que precisasse saber o que é uma `Meta`. RN-35 é RN-27 citada
com vocabulário novo por cima, exatamente como as duas fontes previram.

**O que a execução encontrou que as fontes não previam, registrado como fork (não corrigido nesta
tarefa — fora da pasta `docs/`):**

- **Sem `db.transaction()` em `criarMeta`** (`api/src/modulos/metas/servico.ts:103-141`): criar a
  conta `RESERVA` e a `Meta` são dois `INSERT`s sem transação cobrindo os dois — comentado no
  próprio código (`:111-118`). Causa: `criarConta` (`modulos/contas/servico.ts`) é tipado para
  `Db`, não para o `tx` de uma `db.transaction()`; ampliar o tipo exigiria editar `modulos/contas/`,
  pasta de outra EF, fora da costura declarada (que só autoriza IMPORTAR de lá). Pior caso: uma
  conta `RESERVA` órfã (sem `Meta` apontando para ela) se a segunda escrita falhar — nunca dado
  financeiro inconsistente, porque nenhuma transferência acontece nesta função; e os dois lugares
  onde uma conta órfã poderia contaminar número financeiro (`totalEmContaHojeCentavos` e o lastro)
  já filtram por `tipo === 'DEBITO'`, então uma `RESERVA` órfã não entra em nenhum dos dois.
- **O badge da sidebar do desktop** (`badge:String(s.metas.length)`, recorte §5) não tem campo
  correspondente em `web/app/config/navegacao.ts` (conferido: a entrada `id: 'metas'`, linhas
  109-117, não tem `badge`) — nenhuma outra entrada do arquivo usa esse campo. Não inventado.
- **A tela não tem editar/excluir cofrinho** — o contrato tem CRUD completo
  (`PATCH`/`DELETE /metas/:id` em `api/src/modulos/metas/rotas.ts:113-205`, testado em
  `api/testes/metas.teste.ts:408-463`), mas `web/app/pages/metas.vue` só expõe lista, guardar e
  criar. Decisão de escopo da história (`useMetas.ts:18-21` documenta a lacuna), não esquecimento.
