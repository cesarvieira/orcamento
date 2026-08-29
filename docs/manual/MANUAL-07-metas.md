# MANUAL as-built — EF-07 Metas

> O que foi **construído**, não o que a EF previu. Nasce na implantação; é a base para entender o
> módulo sem ler o código. Ver [EF-07](../especificacoes/EF-07-metas.md) (o contrato) e
> [MC-07](../especificacoes/MC-07-metas.md) (o que falta).

- **Identificação:** Metas · EF-07 · história [#21](https://github.com/cesarvieira/orcamento/issues/21)
  · tarefas: [#85](https://github.com/cesarvieira/orcamento/issues/85) (skill de negócio
  `metas-e-reservas`), [#86](https://github.com/cesarvieira/orcamento/issues/86) (módulo: cofrinho,
  CRUD, guardar com teto), [#87](https://github.com/cesarvieira/orcamento/issues/87) (tela `/metas`),
  [#88](https://github.com/cesarvieira/orcamento/issues/88) (os casos do DoD, 13 testes em largura),
  [#89](https://github.com/cesarvieira/orcamento/issues/89) (documentação, esta tarefa). **Nenhuma
  tarefa nasceu fora do DAG avalizado pelo humano na abertura da #21** — a #85 teve retrabalho
  **dentro do próprio ciclo dela** (reprovada na revisão, corrigida, aprovada) e a #88 teve
  retrabalho de lint (`ce0b318`) — as duas são o Portão B funcionando, não tarefa extra.
  **Lista viva de toda tarefa mesclada, na ordem real:** `git log --oneline 79269b6^..e75c26d`
- **Construído por:** agente `docs` (#85, skill); agente `backend` (#86); agente `frontend` (#87);
  agente `qa` (#88); agente `docs` (#89, esta tarefa) — todos `claude-sonnet-5`
- **Data:** 2026-08-29 (todas as tarefas)
- **Commits e merges (na ordem do DAG real):**
  - #85 — `701c3bb` (cria a skill) **reprovado na revisão de diff** + `79621a0` (retrabalho: corrige
    dois ponteiros de fonte quebrados — D3/D2 não mora na EF-05, e a citação literal de D4 estava
    atribuída ao fork errado) mesclados em `79269b6`
  - #86 — `b291ea4` (módulo: entidade `Meta`, CRUD, guardar com teto RN-34/D1, migration, contrato
    regenerado, 27 testes) mesclado em `de255fa`
  - #87 — `857c3d0` (tela: lista, guardar, criar cofrinho) mesclado em `fe13fe2`
  - #88 — `96f5a40` (checkpoint) + `ce0b318` (retrabalho: remove binding sem uso que reprovava lint,
    corrige cabeçalho que afirmava mais do que entregava) mesclados em `e75c26d`
  - #89 — esta tarefa (docs — MC-07/MANUAL-07, as-built de EF-07 §5): commit ainda sem hash no
    momento em que este texto foi escrito — confira com `git log --oneline e75c26d^..HEAD`
- **Confiança:** Média-alta, com uma ressalva declarada — ver a seção "Confiança" de
  [MC-07](../especificacoes/MC-07-metas.md). Resumo: todo código citado abaixo foi lido linha a
  linha por este agente `docs`; o carimbo `PASS`/`APROVADA` de cada tarefa, ao contrário do padrão
  que EF-06/#79 registrou, **não está** no corpo dos commits de merge desta história (os quatro
  merges — `79269b6`, `de255fa`, `fe13fe2`, `e75c26d` — têm corpo vazio, conferido com
  `git show -s --format=%B`). A única fonte do veredito por tarefa é a tabela de linhagem que o
  condutor escreveu na issue #89:

| tarefa | papel | commit | mesclada em | veredito (fonte: issue #89) |
| --- | --- | --- | --- | --- |
| #85 skill `metas-e-reservas` | `docs` | `79621a0` | `79269b6` | gate PASS · revisão REPROVADA em `701c3bb`, aprovada após retrabalho |
| #86 módulo `metas` | `backend` | `b291ea4` | `de255fa` | gate PASS (251 testes) · revisão APROVADA |
| #87 tela `/metas` | `frontend` | `857c3d0` | `fe13fe2` | gate PASS (10 rotas, 0 quebradas) · revisão APROVADA |
| #88 casos do DoD | `qa` | `ce0b318` | `e75c26d` | gate PASS (264 testes) · revisão APROVADA, republicada após retrabalho de lint |

---

## O que o módulo faz, para quem usa

A família cria **cofrinhos** (o termo do produto para `Meta`) — um nome e um alvo em reais — e
guarda dinheiro neles ao longo do mês, sempre escolhendo de qual conta corrente o dinheiro sai.
Cada cofrinho tem sua própria "poupança" por baixo dos panos (a conta `RESERVA`), e o valor que a
família vê acumulado nunca é um número guardado à parte — é sempre recalculado, na hora da leitura,
como a soma de tudo que já foi transferido para aquela conta. Guardar nunca pode passar do que
sobrou "livre" no orçamento do mês (o não alocado): se a família já planejou tudo que recebeu, o
sistema recusa guardar, mesmo um centavo.

A família vê isto na tela **Metas** (`/metas`): o subtítulo enuncia a regra ("Guardar sai do não
alocado do mês"), cada cofrinho aparece como um cartão com o alvo, o acumulado e uma barra de
progresso, e dois botões — "Guardar 100" e "Guardar 500" — fazem o ato de guardar num clique, da
conta corrente escolhida no seletor acima da lista. Um botão "Criar cofrinho" abre uma folha para
nome e alvo novos.

**A consequência que parece bug e não é:** guardar reduz o **lastro** da família — o dinheiro de
verdade disponível para gastar no mês — porque a conta de origem perde caixa e a conta `RESERVA` de
destino nunca conta para o lastro. Isso é intencional: o dinheiro guardado passou a estar
comprometido com a meta, não sumiu. Ver "A previsão de MC-06 se cumpriu" abaixo para a prova de que
este efeito já existia antes de `Meta` nascer como entidade.

## Backend — `api/src/modulos/metas/` (#86)

### A entidade `Meta` — `api/src/db/schema.ts:674-701`

`id`, `familiaId`, `nome`, `alvoCentavos` (`check` `metas_alvo_positivo` > 0, `:699`),
`contaReservaId` (FK para `contas`, `ON DELETE cascade`, `:689-691`). O vínculo 1:1 com a conta
`RESERVA` é imposto por `uniqueIndex('metas_conta_reserva_unica')` (`:698`) — **no banco**, não só
na aplicação: a migration (`api/drizzle/0008_wet_millenium_guard.sql:15`) cria o índice único, então
uma segunda `Meta` apontando para a mesma `contaReservaId` falharia na constraint, não só na lógica
de `criarMeta`.

### O acumulado derivado — `servico.ts:49-79`

`expressaoAcumuladoDerivado()` é uma subquery correlacionada: soma `lancamentos.valorCentavos` onde
`contaDestinoId = metas.contaReservaId` e `tipo = 'TRANSFERENCIA'`, com `coalesce(..., 0)::integer`
no fim — o cast é deliberado (`:60-62`): `sum(integer)` no Postgres devolve `bigint`, e o driver
`pg` serializa `bigint` como string; sem o cast, `acumuladoCentavos` chegaria como `"31240"` em vez
de `31240`, o mesmo motivo do cast em `contas/servico.ts#expressaoSaldoDerivado`. Nenhuma coluna
`atual`/`acumulado` existe na tabela — `colunasDeLeitura` (`:73-79`) injeta a expressão em toda
leitura (`listarMetas`, `buscarMetaDaFamilia`).

### `criarMeta` — D3, a conta RESERVA nasce junto (`servico.ts:103-141`)

Chama `criarConta` (precedente reaproveitado de `modulos/contas/servico.ts`, nunca reescrito) com
`tipo: 'RESERVA'`, `saldoInicialCentavos: 0`, e só então insere a `Meta` com o `contaReservaId` que
voltou. **Sem `db.transaction()`** cobrindo os dois `INSERT`s — comentado no próprio código
(`:111-118`): `criarConta` é tipado para `Db`, nunca para o `tx` de uma transação, e ampliar isso
exigiria editar `modulos/contas/`, fora da costura desta tarefa (que só autoriza importar de lá).
O pior caso é uma conta `RESERVA` órfã se a segunda escrita falhar — nunca dado financeiro
inconsistente, porque os dois lugares que poderiam contar uma conta órfã em algo financeiro
(`totalEmContaHojeCentavos`, o lastro) já filtram `tipo === 'DEBITO'`, que uma `RESERVA` nunca é.

### `guardar` — RN-33/RN-34-D1/D2/D5 (`servico.ts:211-265`)

Em ordem: busca a meta na família (404 se não achar), busca a conta de origem **do corpo** (D2 —
404 se não achar), confere que ela é `DEBITO` (400 se não for — esta checagem também descarta por
construção o edge case "origem igual ao destino", já que a `RESERVA` de qualquer meta nunca é
`DEBITO`), calcula o não alocado da competência **atual** via `lerCompetencia` (reaproveitado de
`modulos/orcamento/servico.ts`, nunca reescrito), recusa se `naoAlocado ≤ 0` ou se o valor excede
(RN-34/D1 — 409), e só então insere a `TRANSFERENCIA` real (`:246-259`) de `contaOrigemId` para
`meta.contaReservaId`, com `categoriaId: null` (RN-33 — nunca despesa). Um único `INSERT`: não há
segundo passo que precise de transação explícita.

### CRUD — `atualizarMeta`/`excluirMeta` (`servico.ts:143-190`)

`atualizarMeta` edita `nome`/`alvoCentavos`; `contaReservaId` nunca aparece no corpo de edição
(imutável, D3). `excluirMeta` apaga a **conta**, não a meta diretamente — o `ON DELETE cascade` de
`metas.contaReservaId` arrasta a linha de `metas` junto, então não há um segundo `DELETE`. A
armadilha: um cofrinho que já guardou ≥ 1 vez tem uma conta `RESERVA` com lançamento, e
`excluirConta` (também reaproveitado) já impõe RN-06 e devolve `'tem_lancamentos'` — a rota
(`rotas.ts:191-197`) transforma isso em 409 de domínio, nunca uma exceção não tratada.

## Rotas — `api/src/modulos/metas/rotas.ts`

`GET /metas` (`:66-74`), `POST /metas` (`:94-111`, cria e já invalida `metas`+`contas`),
`PATCH /metas/:id` (`:132-156`), `DELETE /metas/:id` (`:181-205`), `POST /metas/:id/guardar`
(`:234-285`). `invalidarMetas` (`:43-46`) é chamada em toda mutação e sempre invalida **dois**
recursos — `metas` (o cofrinho) e `contas` (guardar move dinheiro de verdade; criar/excluir
cria/apaga a conta `RESERVA` vinculada) — nunca só um. `familiaId` vem sempre de
`familiaDaRequisicao(req)` (do token de sessão), nunca do corpo — testado explicitamente com um
`familiaId` forjado (ver "Testes" abaixo).

## Contrato — `api/src/modulos/metas/esquemas.ts`

`EsquemaNovaMeta`/`EsquemaAtualizarMeta` (`:20-28`) compartilham `nome`/`alvoCentavos`;
`contaReservaId` **não** aparece em nenhum dos dois — é sempre gerada pelo servidor. `EsquemaMeta`
(`:34-46`) é o que o front recebe, com `acumuladoCentavos` marcado `.nonnegative()` e a descrição
explícita "derivado... nunca materializado". `EsquemaGuardar` (`:55-63`) exige `contaOrigemId` e
`valorCentavos` — os dois campos que D2/D5 dizem que nunca são inferidos.

## Frontend — `web/app/pages/metas.vue` (#87)

Uma única tela responsiva (coluna única no mobile, grade de 3 no desktop, mesmo padrão do resto do
app). Três blocos:

- **A lista** (`:340-375`): o cartão do cofrinho — nome, percentual, acumulado em destaque, "de
  {alvo}", barra de progresso e os dois botões. `pct()`/`pctStr()`/`pctLabel()` (`:86-94`) são a
  ÚNICA derivação no cliente — largura/rótulo da barra a partir de `acumuladoCentavos`/`alvoCentavos`
  que a API já devolveu prontos; não é o mesmo tipo de recálculo que a regra inviolável nº 4 proíbe
  (não alocado, lastro, acumulado em si nunca são recalculados aqui).
- **O seletor de conta de origem** (`:305-338`, D2/D5): dropdown entre as contas `DEBITO` da
  família, default na primeira mas sempre trocável — precedente de layout e comportamento de
  `pages/faturas.vue:291-352` (o seletor de conta pagadora de D3/EF-05).
- **A folha de criar cofrinho** (`:384-418`, D4): nome + stepper de alvo, superfície nova
  autorizada pelo humano, reaproveitando o vocabulário visual de `sheetConta` de `contas.vue`.

O toast de aviso (`:161-182`) é construído nesta tela — não existe componente de toast global no
projeto ainda — reaproveitando o texto e o tempo literais do desenho (2600 ms). `guardarValor`
(`:188-213`) nunca soma o valor guardado ao estado local: chama `POST /metas/:id/guardar` e relê a
lista inteira depois (`carregarMetas()`), a mesma disciplina que `salvarCofrinho` (`:265-293`) segue
para criar.

### Tempo real — `useMetas.ts` + `metas.vue:143-159`

`useRealtime({ recursos: ['metas', 'contas'] })` — toda mutação de meta invalida os dois recursos no
backend (ver `rotas.ts#invalidarMetas` acima), e a tela relê os dois quando o evento chega. Nada do
evento vira estado direto (R3) — só dispara releitura.

## O que não se copia do protótipo (EF-07 §4)

Os botões do mockup incrementam `atual` **no estado**, sem mover dinheiro (recorte-desenho-21.md
§4, o trecho `guardar100: () => this.setState(...)`). No produto, `guardarValor` sempre chama
`POST /metas/:id/guardar` (a `TRANSFERENCIA` real de RN-33) e relê — a tela nunca soma nada
localmente.

## Testes

Dois arquivos, **deliberadamente disjuntos** (`metas-dod.teste.ts:20-38` é explícito sobre qual
ângulo é novo e qual reroda cenário com valores quebrados):

### `api/testes/metas.teste.ts` (#86, 10 `describe`, 27 `it`) — prova a fiação, valores redondos

D3 (`:154`), RN-33 (`:178`), RN-34/D1 (`:250`), RN-35 (`:308`), D2/D5 (`:333`), acumulado derivado
(`:382`), CRUD (`:408`), validações (`:483`), isolamento entre famílias (`:523`), tempo real
(`:564`).

### `api/testes/metas-dod.teste.ts` (#88, 10 `describe`, 13 `it`) — prova a regra em largura, valores quebrados

Um `describe` por item do DoD §5, nomeado literalmente com o item e a RN: RN-33 (`:204`), RN-34/D1
em três bordas — acima, exato, e **zero exato** (distinto de negativo, borda que `metas.teste.ts`
não cobre) (`:240`), RN-35 dinâmico — crédito direto na `RESERVA` bypassando `guardar` (`:300`),
"guardar não consome teto" (`:334`), "guardar reduz o lastro" (`:368`), D2 com família de uma única
conta DEBITO (`:393`), D3 com acumulados intercalados (`:416`), exclusão com transferência — 409 sem
`stack` (`:451`), isolamento — `familiaId` forjado e conta de origem de outra família (`:486`),
tempo real da mutação de criar (`:536`). Dos 13 casos, 9 são ângulo genuinamente novo sobre
`metas.teste.ts`; os outros 4 reexercitam estruturalmente um cenário já coberto, mas com valores
quebrados e (em alguns) asserções a mais — `metas-dod.teste.ts:20-38` declara isso por inteiro, sem
fingir cobertura nova onde não há.

## "A previsão de MC-06 se cumpriu" — guardar em meta não exigiu recálculo no lastro

`MC-06-lastro.md:119` e `MANUAL-06-lastro.md:202` previram que, quando a EF-07 nascesse, ela
herdaria o efeito no lastro já pronto (RN-27/RN-35 sendo a mesma regra por dois nomes) e não
precisaria recalcular nada. Conferido por esta tarefa:

```
git log --oneline -- api/src/modulos/lastro/servico.ts
```

lista só três commits, todos anteriores a esta história (`eb815ef`, `3aa59b1`, `1b81f1f` — os três
de #76/EF-06). E:

```
git diff 79269b6^..e75c26d -- api/src/modulos/lastro/servico.ts
```

(o intervalo inteiro da história #21) devolve **vazio**. `caixaRealCentavos`
(`lastro/servico.ts:50-54`) já filtrava `tipo === 'DEBITO'` antes de `Meta` existir como entidade —
a exclusão da `RESERVA` do lastro é propriedade da CONTA, não algo que precisasse saber o que é um
cofrinho. RN-35 é RN-27 citada com vocabulário novo por cima, exatamente como as duas fontes
previram — a previsão se cumpriu.

## Costura reportada, não implementada nesta história (fora de escopo de pasta)

- **`EF07-MC-001`** (MC-07) — sem `db.transaction()` em `criarMeta`, porque `criarConta` é tipado
  para `Db`, não para `tx`; ampliar isso é mudança em `modulos/contas/`, de outra EF.
- **`EF07-MC-002`** (MC-07) — o badge da sidebar do desktop (`s.metas.length` no mockup) não tem
  campo correspondente em `web/app/config/navegacao.ts`; corrigir isso é mudança de costura de
  navegação, de outra pasta.
- **Editar/excluir cofrinho na tela** — decisão de escopo da história, não esquecimento: o contrato
  tem CRUD completo e testado; a tela só expõe lista, guardar e criar.

## Prova rodada (evidência)

Citada pela tabela de linhagem que o condutor registrou na issue #89 (ver "Confiança" acima) — este
agente `docs` **não** reconferiu o carimbo no corpo dos commits de merge, porque os quatro merges
desta história têm corpo vazio (diferente do padrão de EF-06/#79):

1. **#85** (skill, com retrabalho interno): merge `79269b6`. Gate PASS · revisão REPROVADA em
   `701c3bb`, aprovada após retrabalho em `79621a0`.
2. **#86** (backend, módulo): merge `de255fa`. Gate PASS (251 testes) · revisão APROVADA.
3. **#87** (frontend, tela): merge `fe13fe2`. Gate PASS (10 rotas, 0 quebradas) · revisão APROVADA.
4. **#88** (qa, os casos do DoD, com retrabalho de lint): merge `e75c26d`. Gate PASS (264 testes) ·
   revisão APROVADA, republicada após o retrabalho de lint em `ce0b318`.
5. **#89** (docs, esta tarefa): commit ainda sem hash no momento em que este texto foi escrito —
   confira com `git log --oneline e75c26d^..HEAD`.

Esta tarefa (#89), de documentação, não toca `api/`/`web/`/`.preator/skills/` e portanto não altera
nem recarimba nenhum dos números acima — são evidência herdada, citada por tarefa. Por não tocar
código, e seguindo o mesmo precedente que #79 (EF-06) registrou, esta tarefa **não reexecutou** o
gate mestre (`preator/esteira/motor/gates/gate-motor.sh`), que sobe um Postgres de verdade e roda a
suíte inteira — reexecutá-lo não produziria sinal novo para um diff que é só três arquivos de
`docs/`.

**O que o `PASS` de #87 NÃO cobriu, medido — não afirmado:** o gate de navegação abre a rota
`/metas` (renderiza a lista com os 2 cofrinhos semeados por `api/src/modulos/metas/semear.ts`), mas
nenhum crawler clica em "Guardar 100"/"Guardar 500", abre a folha de criação, nem provoca o 409 de
RN-34/D1 na interface — só o comportamento por trás (a API) está provado por máquina; o clique em si
foi lido no código. Mesma classe de limitação já registrada em MC-04, MC-05 e MC-06.

## O que ainda não é desta EF

**Uma trava de `DESPESA` além do `limiteCentavos` do cartão** segue sem existir em nenhum módulo —
lacuna de EF-06, não desta história, e não afetada por `metas`. **A transação em `criarMeta`**
(`EF07-MC-001`) e **o badge da sidebar** (`EF07-MC-002`) são de outra pasta — ver "Costura
reportada" acima. **A exclusão de cofrinho com acumulado > 0** tem comportamento definido pelo
código (`excluirConta` recusa via RN-06) mas nenhuma fonte de negócio decidiu se deveria ser
permitida de outra forma (por exemplo, zerando o saldo antes) — a `SKILL.md` já registra isso como
"não inventado aqui" no seu próprio edge case.
