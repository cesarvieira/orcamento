# MANUAL as-built — EF-03 Orçamento

> O que foi **construído**, não o que a EF previu. Nasce na implantação; é a base para entender o
> módulo sem ler o código. Ver [EF-03](../especificacoes/EF-03-orcamento.md) (o contrato) e
> [MC-03](../especificacoes/MC-03-orcamento.md) (o que falta).

- **Identificação:** Orçamento · EF-03 · história [#17](https://github.com/cesarvieira/orcamento/issues/17)
  · tarefas [#43](https://github.com/cesarvieira/orcamento/issues/43) (skill de negócio),
  [#44](https://github.com/cesarvieira/orcamento/issues/44) (backend),
  [#45](https://github.com/cesarvieira/orcamento/issues/45) (frontend)
- **Construído por:** agente `docs` (retrabalho de tier subido a Sonnet 5, três rodadas — #43);
  agentes `backend` e `frontend` (Sonnet 5, esforço alto — #44/#45)
- **Data:** 2026-08-27 · **Commits:** `aff4e7c`→`790f4a9`→`df868af` mesclados em `5d2a31c` (#43);
  `09043cb` mesclado em `0ddb66e` (#44); `23a3bd5`+`35ba65c` mesclados em `09e54f5` (#45)
- **Confiança:** Alta (código lido linha a linha pelo agente `docs`, mais os laudos de revisão de
  diff de cada tarefa, mais o gate re-executado pelo condutor)

---

## O que o módulo faz, para quem usa

A família define **categorias** ("envelopes") — nome, ícone e cor, sem valor nenhum atrelado à
categoria em si. Todo mês, cada categoria recebe um **teto** — quanto pode ser gasto ali _naquele
mês_. A tela `/orcamento` mostra, para o mês corrente: a renda prevista, o total planejado (soma
dos tetos), o quanto já entrou e o quanto ainda não foi alocado a nenhuma categoria — mais a lista
de categorias com teto, gasto e disponível de cada uma.

Quando uma categoria estoura o teto (disponível fica negativo), um cartão de aviso aparece na
lista com o botão **"Remanejar"**: abre uma folha para escolher de quais outras categorias tirar
o dinheiro que falta, com sugestão automática de quanto tirar de cada uma. Se nenhuma categoria
tiver sobra, a folha avisa e oferece **"Deixar negativo"** — o app não trava a família, ela decide
acertar no fechamento do mês.

Remanejar move teto **só do mês em que foi feito** — mexer em agosto nunca reescreve setembro — e
fica registrado quem fez, quando, de onde e para onde.

## Skill de negócio — `.preator/skills/negocio/orcamento-por-envelope/` (#43)

Três rodadas de revisão, as duas primeiras reprovadas pela mesma raiz — **citação cuja fonte não
sustenta a afirmação**:

1. **1ª rodada (`aff4e7c`)** — a skill escrevia `não alocado = renda prevista − planejado`,
   citando `EF-03 §2` como fonte. A fonte real diz `recebido − planejado`. Contradição direta.
2. **2ª rodada (`790f4a9`)** — corrigiu a fórmula, mas passou a afirmar `recebido = soma dos
lançamentos RECEITA` citando `EF-04 §1`, que só declarava o enum `Lancamento.tipo` — nunca a
   regra de agregação. Invenção com aparência de fonte.
3. **3ª rodada (`df868af`)** — entre a 2ª e a 3ª, o humano decidiu os dois forks que as duas
   reprovações expuseram, e as regras passaram a existir nas EFs: **RN-39** (`EF-04 §2`) define
   `recebido` como soma dos lançamentos `RECEITA` da competência; **RN-40** (`EF-03 §2`) define
   que categoria sem `OrcamentoMes` na competência lê como teto zero. A 3ª rodada citou as duas
   corretamente e foi aprovada após conferência afirmação-por-afirmação do arquivo inteiro.

**O que isso deixou para o produto:** duas regras de negócio que a EF-03 sozinha não tinha —
`RN-39` e `RN-40` — nascidas do processo de revisão, não da especificação original.

## Backend — `api/src/modulos/orcamento/` (#44)

- **Schema** (`api/src/db/schema.ts`): quatro tabelas — `categorias` (nome, ícone, cor — **sem
  coluna de teto**, RN-09), `orcamentos_mes` (categoria × competência × teto, com índice único em
  `(categoriaId, competencia)` que sustenta o upsert sem duplicar linha), `remanejamentos`
  (origem, destino, valor, competência, autor — histórico imutável, com `CHECK` de valor positivo
  e de origem≠destino), `competencias` (renda prevista por família × competência).
- **RN-09** (`categoria pertence ao par`): o teto nunca é atributo da `Categoria` — é sempre uma
  linha de `orcamentosMes`, filtrada por competência. Testado com a mesma categoria em duas
  competências (`api/testes/orcamento.teste.ts:143-168`) e com isolamento cruzado entre famílias.
- **RN-10** (`disponível = teto − gasto`): a fórmula vive em `lerCompetencia`
  (`servico.ts:303-311`) e está correta — mas `gasto` vem de `gastoCentavosAindaNaoExiste()`
  (`servico.ts:165-167`), um stub **nomeado para o que é**, que devolve `0` fixo porque a tabela
  `lancamentos` é da EF-04. O comentário acima da função cola a query exata
  (`coalesce(sum(...) where tipo='DESPESA' and competencia=...), 0)`) que a EF-04 vai colocar no
  lugar — a troca não deve mexer em mais nenhuma linha. Ver `EF03-MC-001`.
- **RN-11** (`planejado = Σ tetos`; `não alocado = recebido − planejado`): `planejado` está
  completo — soma das mesmas linhas já lidas na competência (`servico.ts:315`), testado
  (`orcamento.teste.ts:201-218`). `recebido` tem a mesma limitação de `gasto`:
  `recebidoCentavosAindaNaoExiste()` (`servico.ts:183-185`) devolve `0` fixo, com a query de
  `RN-39` documentada em comentário. **A fórmula nunca usa `renda prevista`** — só `recebido` —
  confirmado em código (`servico.ts:326`) e em teste (RN-12 asserta que `naoAlocado` fica idêntico
  antes/depois de subir a renda prevista). Ver `EF03-MC-001`.
- **RN-12** (`renda acima da prevista não altera teto`): não há código que ligue renda prevista a
  teto — a ausência é a prova. Testado por igualdade estrita: `planejado` e `naoAlocado` idênticos
  antes/depois de definir uma renda prevista bem mais alta (`orcamento.teste.ts:221-250`).
- **RN-13** (`remanejar altera só a competência corrente, registra o autor`): `criarRemanejamento`
  (`servico.ts:347-415`) roda as duas escritas de teto e o insert do histórico **na mesma
  transação** — nunca uma origem debitada sem o destino creditado. Testado com o teste que mais
  importa desta EF: define tetos diferentes em agosto e setembro, remaneja em agosto, e compara
  setembro **por igualdade profunda** (`toEqual`) antes/depois (`orcamento.teste.ts:279-306`) — um
  vazamento de mês faria esse teste falhar. O autor vem de `membroDaRequisicao(req)`
  (`rotas.ts:413`), nunca do corpo, e é asserted no teste (`:270`).
- **RN-14** (`sem sobra, oferece deixar negativo — não trava`): `upsertTeto` não impõe piso nenhum
  (`servico.ts:236-241` documenta isso explicitamente) — quem decide o piso é quem chama, e
  `criarRemanejamento` não chama com piso. Testado com remanejo maior que a origem tem: `201`, não
  `409`/`422` (`orcamento.teste.ts:309-328`), e combinado com RN-40 (`:330-345`). Definir teto
  negativo **diretamente** (fora de um remanejamento) continua recusado com `422`
  (`orcamento.teste.ts:387-391`) — só o remanejo pode deixar negativo.
- **RN-40** (`categoria sem OrcamentoMes lê como teto zero`): `lerCompetencia` faz LEFT JOIN de
  `categorias` com `orcamentosMes` e usa `coalesce(tetoCentavos, 0)` (`servico.ts:285-301`) — a
  categoria não desaparece da lista, aparece com teto zero, e `planejado` continua coerente porque
  soma as mesmas linhas. Testado isolado (`orcamento.teste.ts:348-360`) e combinado com RN-14.
- **Rotas** (`rotas.ts`): `GET/POST /categorias`, `PATCH/DELETE /categorias/:id`,
  `GET /competencias/:competencia`, `PUT .../renda-prevista`, `PUT .../categorias/:id/teto`,
  `POST .../remanejamentos` — todas atrás de `exigirSessao` + `familiaDaRequisicao(req)`, nunca
  `familiaId` do corpo/query/path. Toda leitura filtra por família; `criarRemanejamento` exige que
  **as duas** categorias (origem e destino) existam na mesma família, ou devolve
  `categoria_nao_encontrada` (`servico.ts:354-365`) — a mesma resposta para "não existe" e "é de
  outra família", para não vazar existência de id entre famílias.
- **Isolamento** testado com família B contra dados de A: GET não lista, leitura de competência
  não mostra, remanejar com categoria de A responde 404, PATCH/DELETE de categoria de A responde
  404 (`orcamento.teste.ts:394-436`).
- **Contrato:** `packages/contrato/openapi.json` tem as 6 rotas; `packages/contrato/src/index.ts`
  reexporta 11 tipos novos (`Categoria`, `CategoriaNaCompetencia`, `CategoriasListadas`,
  `CompetenciaLida`, `OrcamentoMesLido`, `Remanejamento`, `NovaCategoria`, `AtualizarCategoria`,
  `NovoRemanejamento`, `DefinirTeto`, `DefinirRendaPrevista`). Quatro tipos internos de composição
  (`OrcamentoMesLido`/`CategoriaNaCompetenciaLida`/`RemanejamentoLido`/`EntradaDeRemanejamento`
  dentro de `servico.ts`) ficaram sem `export` — sem consumidor fora do arquivo, mesmo padrão do
  módulo `contas`.
- **Tempo real (emissão):** os 6 pontos de mutação chamam `invalidarOrcamento` (`rotas.ts:62-68`),
  que emite `recurso: 'orcamento'` com a competência quando aplicável (`null` para mutação de
  `Categoria`, que não tem competência — RN-09). Nenhum motor órfão: os 6 pontos emitem. O evento
  carrega só invalidação, nunca estado calculado. **A propagação para dois clientes não tem teste
  automatizado para este recurso** — ver `EF03-MC-003`.
- **Dinheiro:** inteiro em centavos na pilha inteira — `dinheiroCentavos()` no schema, Zod `.int()`
  em toda entrada, nenhum float, nenhuma divisão. O remanejo fecha por construção: a mesma
  transação debita `tetoOrigemAtual − valorCentavos` e credita `tetoDestinoAtual + valorCentavos`
  (`servico.ts:374-385`).
- **Migration:** `api/drizzle/0005_legal_ken_ellis.sql`, gerada pelo drizzle-kit, conferida
  coluna a coluna, FK a FK, índice a índice contra `db/schema.ts`.
- **Seed** (`semear.ts`, registrado em `SEMEADORES_DE_MODULO`): duas categorias com teto na
  competência do seed — Mercado (R$ 1.500,00) e Lazer (R$ 400,00). Idempotente.
- **Testes** (`api/testes/orcamento.teste.ts`, 24 casos, somando aos 105 da base para os
  **129 testes** do gate): um bloco por RN, mais validação de corpo/competência e isolamento entre
  famílias. O cabeçalho do arquivo e cada teste de RN-10/RN-11 **declaram** a limitação da
  dependência da EF-04 em vez de fingir cobertura completa.

## Frontend — `web/app/pages/orcamento.vue` + `useOrcamento.ts` + `orcamento.scss` (#45)

- **Contrato:** `useOrcamento.ts:17-27` e `orcamento.vue:22` importam todos os tipos de
  `@orcamento/contrato` — zero `interface`/`type` redeclarando modelo do back. A única `interface`
  local (`FonteRemanejo`, `orcamento.vue:244`) é estado de UI que **envolve**
  `CategoriaNaCompetencia` com um campo local (`valorCentavos`), não duplica nada do back.
- **Cálculo não mora no front:** `teto`, `gasto`, `disponível`, `planejado`, `recebido` e
  `naoAlocado` só são lidos de `CompetenciaLida` (`orcamento.vue:67-69`), nunca recalculados. A
  mutação real vai sempre para os endpoints do composable, e a tela relê com `carregar()` depois.
- **Dinheiro:** `formatarCentavos` (`orcamento.vue:49-51`) é a única divisão por 100 do módulo —
  a borda de exibição. Nenhum `parseFloat`, nenhum arredondamento fracionário.
- **Copy de RN-12:** `orcamento.vue:435` traz a frase corrigida pela EF-03 §3 — _"Os tetos se
  desbloqueiam conforme o dinheiro entra"_ — no lugar de _"se ajustam sozinhos ao que entrou"_ (a
  frase do mockup, que a EF julgou tecnicamente correta mas indutiva ao erro).
- **A tela `config` (`/orcamento`):** cabeçalho com renda prevista (stepper `−/+`), "Recebido até
  agora" e a frase de RN-12; lista de categorias com teto, stepper de teto, botão de remover; e,
  por categoria com `disponivelCentavos < 0`, o **cartão de estouro** (ver abaixo).
- **Folha `sheetEditCat` (editar categoria):** nome, grade de 8 cores e grade de 18 ícones
  (`CORES_CATEGORIA`/`ICONES_CATEGORIA`, `useOrcamento.ts:41-80`), valores literais do mockup, na
  mesma ordem. Ícone/cor fora da lista não quebram o render — caem num valor neutro
  (`classeDoIconeCategoria`, `ICONE_PADRAO`).
- **Folha `sheetRemanejar` (remanejar):** lista as categorias com sobra (`disponivelCentavos >=
1000`, `LIMIAR_FONTE_CENTAVOS`) como fontes possíveis, com sugestão automática de quanto tirar
  de cada uma (`sugeridoDaFonte`, `orcamento.vue:304-309`, porta literal do algoritmo do mockup).
  Cada fonte tem stepper e slider. Quando **nenhuma** categoria tem sobra
  (`fontes.length === 0`), a folha mostra o aviso _"Nenhuma categoria tem sobra este mês. Dá para
  deixar negativo e ajustar no fechamento."_ (`orcamento.vue:279,579`) e o botão **"Deixar
  negativo"**, que só fecha a folha sem chamar a API (`orcamento.vue:396-398,640`) — RN-14: oferece,
  não trava.
- **O cartão de estouro — divergência de colocação, registrada em comentário:** o gatilho
  ("`<Categoria>` passou `R$ X` do teto" + "Cobrir com o saldo de outra categoria" + botão pill
  "Remanejar") é o desenho canônico do mockup, mas a colocação **canônica** dele é a tela `home`
  (`web/app/pages/index`), que é da EF-04 e não existe ainda. `/orcamento` reproduz o **mesmo**
  cartão dentro da lista de categorias (`orcamento.vue:493-501`, `orcamento.scss:194-242`) — para
  que a folha de remanejar e o estado "sem fonte" (exigidos pelo DoD) fiquem alcançáveis hoje.
  Comentário em `orcamento.vue:226-237` e `orcamento.scss:194-198` avisa quem construir a EF-04
  para **reaproveitar** este cartão, não desenhar um terceiro. Isso não foi decidido pelo agente
  sozinho: a extração inicial do mockup não trazia esse trecho, o agente abriu fork em vez de
  inventar um botão próprio, e o condutor corrigiu a premissa a meio da revisão de diff da #45. Ver
  `EF03-MC-002`.
- **Falha parcial no remanejo múltiplo:** a folha manda **uma chamada HTTP por fonte**, em
  sequência (`confirmarRemanejamento`, `orcamento.vue:329-393`) — a API só move um par
  origem→destino por chamada. Se a chamada N falhar depois de 1..N-1 já terem mutado no servidor,
  o código relê (`carregar()`), mantém a folha aberta e zera só as fontes já aplicadas — um
  reenvio não duplica o que já passou. Revisado item a item na revisão de diff da #45 (retrabalho
  `35ba65c`), sem buraco encontrado, mas **sem teste automatizado** — o projeto não tem harness de
  teste de front. Ver `EF03-MC-004`.
- **Acessibilidade:** os botões de cor e de ícone da folha `sheetEditCat` usam `aria-label` com
  nome em português (`nomeDaCor`/`nomeDoIcone`, `useOrcamento.ts:103-148`), não o hex/classe Tabler
  crus — corrigido no retrabalho da #45 (a entrega original expunha o valor cru ao leitor de
  tela). Os dois mapas são só rótulo de UI: não são lidos em regra de negócio nem no payload
  enviado à API.
- **Tempo real:** `useRealtime({ recursos: ['orcamento'], competenciaAtiva, aoInvalidar: carregar
})` (`orcamento.vue:89-95`) — ao chegar invalidação do recurso `orcamento`, ou ao reconectar,
  refaz a leitura da competência ativa. O próprio eco desta aba é descartado pelo `useRealtime`; as
  mutações que a própria aba faz se resolvem chamando `carregar()` direto após a resposta HTTP, sem
  esperar o socket.

### Escopo tocado (exato ao declarado)

`web/app/pages/orcamento.vue` · `web/app/composables/useOrcamento.ts` ·
`web/app/assets/scss/pages/orcamento.scss` — confirmado por `git diff
historia/17-ef-03-orcamento...HEAD --stat` em cada revisão. `web/app/config/navegacao.ts` e
`api/` não foram tocados por esta tarefa.

## O que a EF-00/EF-01/EF-02 já tinham deixado pronto (não foi refeito)

`emitirInvalidacao`, o middleware de tenant (`familiaDaRequisicao`, `membroDaRequisicao`),
`registrarRota`, `SEMEADORES_DE_MODULO`, `useRealtime()` no front, e o padrão de tela
(`layouts/default.vue`, `assets/scss/pages/`) que `contas.vue` já usava.

## O que não é desta EF

O **gasto** e o **recebido** de verdade (não a fórmula, o dado real) são da
[EF-04](../especificacoes/EF-04-lancamentos.md) — este módulo só entrega as duas fórmulas já
prontas para receber o dado. O **bloqueio por falta de lastro** é da
[EF-06](../especificacoes/EF-06-lastro.md): RN-12 já avisa que "o teto nunca muda sozinho — o que
se ajusta é o desbloqueio", e esse desbloqueio não é calculado aqui. A **fatura do cartão** é da
[EF-05](../especificacoes/EF-05-faturas.md), sem relação com este módulo.

## Prova rodada (evidência)

Re-executada pelo condutor, independente do relato dos agentes, por tarefa:

1. Tarefa #43 (skill de negócio): 3 rodadas — `PROVA_DE_COMPORTAMENTO=PASS` nas três (o gate
   nunca foi o problema); as duas primeiras **reprovadas na revisão de diff** por citação que a
   fonte não sustentava; a 3ª **aprovada** após conferência afirmação-por-afirmação do arquivo
   inteiro.
2. Tarefa #44 (backend): `PROVA_DE_COMPORTAMENTO=PASS`, **129 testes** (105 da base + 24 novos),
   10 rotas / 0 quebradas. Revisão de diff **aprovada**, sem achado bloqueante.
3. Tarefa #45 (frontend): 2 commits — `23a3bd5` (entrega, aprovada com 1 🟡 e 2 🔵) e `35ba65c`
   (retrabalho que fechou o 🟡 e promoveu 1 dos 🔵 a obrigatório, aprovado sem achado novo).
   `PROVA_DE_COMPORTAMENTO=PASS`, mesma contagem de testes (o front não roda na suíte do
   `TEST_CMD`), 10 rotas / 0 quebradas.

```
build        PASS  (bloqueante)
test(N>0)    PASS  (bloqueante) — 129 testes executados, 0 falhando
front        PASS  (bloqueante)
typecheck    PASS
lint         PASS
deadcode     PASS
contrato     PASS  (bloqueante)
navegacao    PASS  (bloqueante) — 10 rotas abertas, 0 quebradas
PROVA_DE_COMPORTAMENTO=PASS
```

`fails=0` · `skips_bloqueantes=0`, carimbado `2026-08-27T18:04:34` no worktree desta tarefa
(`.prova-comportamento.json`), com a árvore intocada pelo agente `docs`.

## O que não foi portado do mockup

`support.js` (runtime do dc-runtime, já registrado desde a EF-00). Os campos `diaFechamento`/
`diaVencimento` não existem neste módulo — são de `contas` (EF-02). O seletor de mês não existe —
fora do recorte de tela desta EF (a tela sempre mostra a competência corrente).

## O que ainda não é desta EF

`gasto` e `recebido` reais dependem de `lancamentos`, que é da [EF-04](../especificacoes/EF-04-lancamentos.md)
— sem essa tabela, as duas fórmulas desta EF rodam sobre conjunto vazio (ver `EF03-MC-001`). O
cartão de estouro tem colocação canônica na tela `home`, também da EF-04 (ver `EF03-MC-002`). O
desbloqueio de teto por lastro é da [EF-06](../especificacoes/EF-06-lastro.md). A fatura de cartão
é da [EF-05](../especificacoes/EF-05-faturas.md).
