# MC-07 — Matriz de Completude · Metas

> O que **falta** decidir/construir/validar para EF-07 alcançar padrão implantável. Não repete o
> que a EF já resolveu. Ver [EF-07](EF-07-metas.md) (o contrato) e
> [MANUAL-07](../manual/MANUAL-07-metas.md) (o que foi construído).

- **Conteúdo base:** Com conteúdo — toda tarefa mesclada nesta história fechou `PASS`, na leitura
  da tabela de linhagem que o condutor registrou na issue #89 (não reproduzida por inteiro aqui —
  fato duplicado é bug; ver MANUAL-07). Lista viva, na ordem real:
  `git log --oneline --first-parent main..historia/21-ef-07-metas`, ou
  `git log --oneline 79269b6^..e75c26d`. O DAG avalizado pelo humano listava #85 (skill), #86
  (backend), #87 (tela), #88 (os casos do DoD) e #89 (documentação, esta tarefa) — nenhuma tarefa
  nasceu fora da decomposição original. A #85 teve retrabalho **dentro** do próprio ciclo dela
  (reprovada em `701c3bb`, corrigida em `79621a0`) e a #88 teve retrabalho de lint (`ce0b318`) — as
  duas são o Portão B fazendo o trabalho dele, não tarefa extra do DAG.
- **Confiança:** Média-alta, com uma ressalva declarada. Todo código citado abaixo (`servico.ts`,
  `rotas.ts`, `esquemas.ts`, `schema.ts`, a migration, `metas.vue`, `useMetas.ts`) foi lido linha a
  linha por este agente `docs`, cada citação aberta na linha exata. **A ressalva:** os commits de
  merge desta história (`79269b6` #85, `de255fa` #86, `fe13fe2` #87, `e75c26d` #88) têm corpo
  **vazio** — conferido com `git show -s --format=%B <hash>` nos quatro — ao contrário do padrão da
  EF-06 (onde o carimbo `PASS` e o número de testes iam no corpo do commit de merge). O veredito
  `PASS`/`APROVADA` de cada tarefa, citado nesta matriz e em MANUAL-07, vem **só** da tabela de
  linhagem que o condutor escreveu na issue #89 — não há como este agente reconferir o carimbo no
  histórico de git desta história. O número **total de testes do módulo**, esse sim, foi contado
  por esta tarefa diretamente nos arquivos (ver linha "DoD §5.1" abaixo).
- **Critério de completude:** igual ao de [MC-00](MC-00-plataforma.md) a [MC-06](MC-06-lastro.md)
  — `Concluído` quando o gate prova de forma reproduzível; `Parcial` quando o código existe mas não
  há prova automatizada, ou a prova não alcança o caso; `Pendente` quando nem o código existe.

## Como ler a coluna de evidência

Dois arquivos de teste, **deliberadamente disjuntos** (cada cabeçalho declara isso, e
`metas-dod.teste.ts:20-38` é explícito sobre qual dos 13 casos é ângulo novo e qual reroda cenário
já coberto com valores quebrados): `metas.teste.ts` (tarefa #86 — prova a fiação com valores
redondos, 10 `describe`/27 `it`) e `metas-dod.teste.ts` (tarefa #88 — prova a regra em largura com
valores quebrados, um `describe` por item do DoD §5, 10 `describe`/13 `it`). A numeração abaixo é
desta matriz, na ordem em que cada `describe` aparece no respectivo arquivo.

| Arquivo               | #   | `describe` (linha) | O que prova |
| ---------------------- | --- | --- | --- |
| `metas.teste.ts`       | 1 | `:154` D3 — cofrinho cria conta RESERVA própria | conta 1:1, saldo 0, nunca compartilhada |
| `metas.teste.ts`       | 2 | `:178` RN-33 — TRANSFERENCIA real | lançamento, saldo da origem cai, categoriaId nulo, teto intocado |
| `metas.teste.ts`       | 3 | `:250` RN-34/D1 — teto do não alocado | acima recusa, exato aceita, ≤0 recusa qualquer valor |
| `metas.teste.ts`       | 4 | `:308` RN-35 — guardar reduz o lastro | `lastroCentavos` cai exatamente o guardado |
| `metas.teste.ts`       | 5 | `:333` D2/D5 — as duas pontas do corpo | conta não-DEBITO 400, conta/meta inexistente 404 |
| `metas.teste.ts`       | 6 | `:382` EF-07 §1 — acumulado derivado | dois guardares no mesmo cofrinho somam |
| `metas.teste.ts`       | 7 | `:408` CRUD | PATCH, DELETE sem/com lançamento (409), GET |
| `metas.teste.ts`       | 8 | `:483` validações | corpo inválido (422), sem sessão (401) |
| `metas.teste.ts`       | 9 | `:523` isolamento entre famílias | listar, guardar, editar/apagar cofrinho de outra família |
| `metas.teste.ts`       | 10 | `:564` tempo real | invalidação chega só à família dona; guardar invalida metas+contas |
| `metas-dod.teste.ts`   | 1 | `:204` DoD RN-33 | valor quebrado, nenhuma DESPESA criada por baixo dos panos |
| `metas-dod.teste.ts`   | 2 | `:240` DoD RN-34/D1, três bordas | 1 centavo acima, exato, e não-alocado ZERO exato (distinto de negativo) |
| `metas-dod.teste.ts`   | 3 | `:300` DoD RN-35 dinâmico | RECEITA direta na RESERVA (bypassando guardar) não move o lastro |
| `metas-dod.teste.ts`   | 4 | `:334` DoD "guardar não consome teto" | teto/gasto/disponível bit-a-bit idênticos, valor quebrado |
| `metas-dod.teste.ts`   | 5 | `:368` DoD "guardar reduz o lastro" | valor quebrado, os dois lados da mesma moeda do #3 |
| `metas-dod.teste.ts`   | 6 | `:393` DoD D2 | família com UMA conta DEBITO: omitir `contaOrigemId` ainda dá 422 |
| `metas-dod.teste.ts`   | 7 | `:416` DoD D3 | três guardares intercalados em dois cofrinhos, acumulados independentes |
| `metas-dod.teste.ts`   | 8 | `:451` DoD exclusão com transferência | 409 de domínio, nunca 500, sem `stack` no corpo |
| `metas-dod.teste.ts`   | 9 | `:486` DoD isolamento | `familiaId` forjado no corpo é ignorado; conta de origem de outra família 404 |
| `metas-dod.teste.ts`   | 10 | `:536` DoD tempo real — criar | `POST /metas` invalida `metas` E `contas` no segundo cliente |

## Matriz de completude

| Área | Capacidade esperada | Status | O que falta / evidência |
| --- | --- | --- | --- |
| Dados — `Meta` | Nova entidade: nome, `alvoCentavos`, conta `RESERVA` 1:1 | Concluído | `api/src/db/schema.ts:674-701` (tabela, `check` de alvo positivo `:699`); migration `api/drizzle/0008_wet_millenium_guard.sql` (FK cascade, `uniqueIndex` em `conta_reserva_id`) |
| Dados — acumulado derivado | Nunca coluna: soma das `TRANSFERENCIA` para a conta vinculada | Concluído | `api/src/modulos/metas/servico.ts:64-79` (`expressaoAcumuladoDerivado`, subquery correlacionada); nenhuma coluna `atual`/`acumulado` em `schema.ts`. Testado: `metas.teste.ts:382-402` (soma de dois guardares), `metas-dod.teste.ts:416-441` (D3, dois cofrinhos não se contaminam) |
| RN-33 · guardar é TRANSFERENCIA, nunca despesa | `categoriaId` nulo, sem consumir teto de categoria | Concluído | Imposto por vocabulário fixo em `servico.ts:246-259` (`tipo: 'TRANSFERENCIA'`, `categoriaId: null`). Testado: `metas.teste.ts:178-215` (lançamento + saldo da origem) e `:217-243` (teto/gasto/disponível intocados); `metas-dod.teste.ts:204-231` (valor quebrado, nenhuma DESPESA no extrato) e `:334-357` (teto bit-a-bit idêntico) |
| RN-34/D1 · teto do não alocado | API recusa acima do não alocado; com não alocado ≤ 0, recusa qualquer valor | Concluído | `api/src/modulos/metas/servico.ts:230-240` (`naoAlocadoCentavos <= 0 \|\| valorCentavos > naoAlocadoCentavos`). Testado nas três bordas: acima (`metas.teste.ts:251-270`, `metas-dod.teste.ts:241-256`), exato (`metas.teste.ts:272-282`, `metas-dod.teste.ts:258-267`), e **zero exato** — distinto de negativo, só em `metas-dod.teste.ts:269-287` |
| RN-35 · RESERVA fora do orçamento e do lastro | Herdado de RN-27 (EF-06), sem recálculo nesta história | Concluído | Propriedade da CONTA, não de `Meta`: `api/src/modulos/lastro/servico.ts:50-54` (filtro `tipo === 'DEBITO'`) não mudou nesta história — `git diff 79269b6^..e75c26d -- api/src/modulos/lastro/servico.ts` vazio. Testado como efeito de guardar: `metas.teste.ts:309-326`, `metas-dod.teste.ts:369-384`; testado como propriedade dinâmica da conta (crédito direto na RESERVA, bypassando `guardar`): `metas-dod.teste.ts:301-325` — ver a previsão conferida em EF-07 §5 |
| D2 · conta de origem do corpo, nunca inferida | Schema exige `contaOrigemId`; sem ele, 422 mesmo com 1 conta candidata | Concluído | `api/src/modulos/metas/esquemas.ts:55-63` (`EsquemaGuardar`, campo obrigatório); `servico.ts:219` (busca do corpo). Testado: `metas-dod.teste.ts:394-407` (família com UMA conta DEBITO, omitir o campo ainda dá 422 — a armadilha da inferência "óbvia") |
| D3 · vínculo 1:1 cofrinho↔RESERVA | Criada junto, saldo 0, nunca compartilhada | Concluído | `schema.ts:698` (`uniqueIndex`); `servico.ts:103-141` (`criarMeta`, a conta nasce antes da meta). Testado: `metas.teste.ts:155-172` (duas metas, contas distintas) |
| D4 · criar cofrinho, superfície nova | Tela nova, fora do desenho, autorizada pelo humano | Concluído | `web/app/pages/metas.vue:384-418` (a folha `sheetAberta`) e `:253-293` (lógica de criação); `useMetas.ts:44-51` (`criarMeta`). Exercido pelo gate de navegação da rota `/metas` (crawler abre a rota — não força abrir a folha) e por `metas.teste.ts`/`metas-dod.teste.ts` via `POST /metas` (a API que a folha chama) |
| D5 · guardar escolhe as duas pontas | Conta de origem e cofrinho de destino, nenhuma padrão implícito | Concluído | `servico.ts:203-209` (`DadosDeGuardar`, dois campos obrigatórios); tela: `metas.vue:96-125` (seletor de conta, default na primeira mas sempre trocável) |
| DoD §5.1 · um teste por RN | RN-33..RN-35, cada uma com `describe` próprio, nomeado | Concluído | Ver tabela de numeração acima. Contagem própria desta tarefa: `metas.teste.ts` 10 `describe`/27 `it`, `metas-dod.teste.ts` 10 `describe`/13 `it` — total 40 casos de teste do módulo `metas` (conferido via `grep -c "^\s*it("`, não repassado de fonte alguma) |
| DoD §5.2 · guardar não consome teto de categoria | teto/gasto/disponível intocados | Concluído | `metas.teste.ts:217-243`, `metas-dod.teste.ts:334-357` (valor quebrado, bit-a-bit idêntico) |
| DoD §5.3 · guardar reduz o lastro | `lastroCentavos` cai exatamente o valor guardado | Concluído | `metas.teste.ts:308-326`, `metas-dod.teste.ts:368-384` |
| DoD §5.4 · isolamento entre famílias | Nenhum dado de uma família vaza para outra, em toda operação | Concluído | `metas.teste.ts:523-558` (ler, guardar, editar, apagar); `metas-dod.teste.ts:487-525`, com dois ângulos que `metas.teste.ts` não cobre: `familiaId` **forjado no corpo** de criação é ignorado (`:487-505`), e a conta de **origem** de outra família também é invisível a quem guarda, não só o cofrinho (`:507-525`) |
| DoD §5.5 · dois clientes sem refresh | Invalidação de `metas`/`contas` chega à sessão irmã | Concluído | `metas.teste.ts:565-652` (guardar); `metas-dod.teste.ts:537-575` — ângulo que `metas.teste.ts` não cobre: a mutação de **criar** cofrinho também invalida `contas` (D3 cria uma conta junto), não só `guardar` |
| CRUD — editar (PATCH) | Nome e alvo editáveis; `contaReservaId` imutável | Concluído | `api/src/modulos/metas/rotas.ts:117-156`; `servico.ts:148-162`. Testado: `metas.teste.ts:409-421` (edita, conta não muda) e `:423-429` (404 em cofrinho inexistente) |
| CRUD — excluir (DELETE) | Apaga meta + conta RESERVA (cascade); recusa se já guardou | Concluído | `rotas.ts:163-205`; `servico.ts:177-190` (`excluirMeta`, erro de domínio, nunca 500). Testado: `metas.teste.ts:431-442` (apaga sem lançamento), `:444-463` (409 com lançamento) e `metas-dod.teste.ts:452-474` (409 sem `stack` no corpo, nada some pela metade) |
| Tela — lista + guardar + criar | Cartão do cofrinho, botões Guardar 100/500, folha de criação | Concluído (código), **exercitado só parcialmente por máquina** | `web/app/pages/metas.vue` inteiro (425 linhas); gate de navegação abre a rota `/metas` e a semeadura (`api/src/modulos/metas/semear.ts`) garante 2 cofrinhos não-vazios para o crawler renderizar. **Não exercitado pelo crawler**: clicar em "Guardar 100"/"Guardar 500" (o POST real fica só nos testes de API), abrir a folha de criação, e o teto (D1) recusando na tela — mesma classe de limitação já registrada em MC-04/MC-05/MC-06 para telas |
| Tela — editar/excluir cofrinho | — | **Não construído** (decisão de escopo, não lacuna) | O contrato tem `PATCH`/`DELETE /metas/:id` prontos e testados (linhas acima); `web/app/pages/metas.vue` não expõe superfície nenhuma para os dois — `useMetas.ts:18-21` documenta a omissão como intencional |
| Badge da sidebar desktop (`s.metas.length`) | — | **Não construído** (fork, fora da costura desta tarefa) | `web/app/config/navegacao.ts:109-117` (entrada `id: 'metas'`) não tem campo `badge`; nenhuma outra entrada do arquivo usa esse campo. Ver Lacunas abaixo |

## Lacunas

| Código | Lacuna | Impacto | Prioridade |
| --- | --- | --- | --- |
| EF07-MC-001 | **Sem `db.transaction()` em `criarMeta`** (`api/src/modulos/metas/servico.ts:103-141`): criar a conta `RESERVA` e a `Meta` são dois `INSERT`s sem transação cobrindo os dois — comentado no próprio código (`:111-118`). Causa é de escopo: `criarConta` (`modulos/contas/servico.ts`) é tipado para `Db`, não para `tx`; ampliar isso exige editar `modulos/contas/`, pasta de outra EF. | Pior caso é uma conta `RESERVA` órfã (sem `Meta` apontando para ela) se a segunda escrita falhar entre os dois `INSERT`s. Nunca dado financeiro inconsistente — nenhuma transferência acontece nesta função, e os dois lugares que poderiam contaminar um número financeiro com essa órfã (`totalEmContaHojeCentavos` e o lastro) já filtram por `tipo === 'DEBITO'`, que uma `RESERVA` nunca é. | Baixa — ruído de UI recuperável no pior caso, aceito 🟡 pela revisão de #86 |
| EF07-MC-002 | **Badge da sidebar do desktop não portado.** O mockup mostra `badge:String(s.metas.length)` na entrada da sidebar (recorte-desenho-21.md §0); `web/app/config/navegacao.ts:109-117` não tem campo `badge`, e nenhuma outra entrada do arquivo usa esse campo. | Nenhum em runtime — é ausência de um elemento decorativo, não de dado. A costura de navegação é de outra pasta/tarefa. | Baixa — fork reportado ao humano, não invenção do campo |
| EF07-MC-003 | **Tela sem exercício por máquina do clique real** — o gate de navegação abre `/metas` (renderiza a lista, com 2 cofrinhos semeados), mas nenhum crawler clica em "Guardar 100"/"Guardar 500", abre a folha de criação, nem provoca o 409 de RN-34/D1 na UI. O comportamento por trás (a API) está provado; o clique em si só foi lido no código. Mesma classe de limitação já registrada em MC-04/MC-05/MC-06. | O comportamento correto da tela não tem confirmação visual automatizada. | Baixa — herdada do padrão já aceito nas três histórias anteriores |
| EF07-MC-004 | **A evidência de gate `PASS`/revisão `APROVADA` por tarefa desta história não está no histórico de git** — os quatro commits de merge (`79269b6`, `de255fa`, `fe13fe2`, `e75c26d`) têm corpo vazio (conferido com `git show -s --format=%B`), ao contrário do padrão que EF-06/#79 registrou (carimbo no corpo do merge). A única fonte é a tabela de linhagem que o condutor escreveu na issue #89. | Nenhum em comportamento — é lacuna de **rastreabilidade da prova**, não de prova em si; o código citado nesta matriz foi lido e conferido linha a linha independentemente do carimbo. | Baixa — mas vale registrar para a próxima história manter o padrão de citar o carimbo no corpo do merge |
| EF07-MC-005 | **Lint `FAIL` não bloqueante na primeira entrega de #88** (`fails=1`, binding `contaOrigem` sem uso em RN-35) — corrigido em `ce0b318`, o commit final da branch. Registrado porque o gate não bloqueou, mas o carimbo saiu sujo até o retrabalho. | Nenhum no estado final (a branch mesclada já está limpa) — registrado por completude, mesmo padrão de EF06-MC-005. | Baixa — cosmética, já corrigida |

## Riscos de implantação

| Risco | Severidade | Mitigação |
| --- | --- | --- |
| Uma tela futura reimplementar o acumulado no cliente em vez de ler `acumuladoCentavos` pronto do servidor, criando uma segunda fonte da regra que define o produto | Alta | Regra inviolável nº 4 do `.preator/CONTEXT.md`; comentário explícito em `web/app/pages/metas.vue:17-22` ("nunca recalcula `acumuladoCentavos`"); o contrato gerado (`@orcamento/contrato`) já expõe o campo pronto |
| A conta `RESERVA` órfã de `EF07-MC-001` (sem transação) se acumular ao longo do tempo e alguém tentar "consertar" contando-a em algum total financeiro | Baixa | Os dois pontos que poderiam contar uma conta órfã (`totalEmContaHojeCentavos`, o lastro) já filtram `tipo === 'DEBITO'` por construção — uma `RESERVA` nunca entra, órfã ou não. Documentado no próprio código (`servico.ts:111-118`) e nesta matriz |
| Um módulo futuro reintroduzir a leitura de `naoAlocadoCentavos` sem o teto de RN-34/D1, achando que a frase do mockup era só rótulo | Média | `metas-e-reservas/SKILL.md` D1 documenta explicitamente a origem da decisão e avisa contra "descobrir" que o teto não estava no desenho original; EF-07 §5 (as-built) repete o aviso |
| A ausência de editar/excluir cofrinho na tela (decisão de escopo) ser lida depois como bug, e alguém "consertar" adicionando a UI sem revisitar se o contrato ainda cobre os edge cases não decididos (alvo atingido, conta de origem == destino) | Baixa | `useMetas.ts:18-21` documenta a omissão como intencional; `SKILL.md` "Edge cases" já registra os dois edge cases como não decididos em fonte nenhuma — quem construir a UI precisa voltar à skill primeiro |

## Validações obrigatórias para implantação

| Validação (EF-07 §5) | Resultado esperado | Status |
| --- | --- | --- |
| Um teste por RN (RN-33..RN-35) | Cada RN com `describe` próprio, nomeado | Provado — ver tabela de numeração acima |
| Guardar não consome teto de categoria nenhuma | teto/gasto/disponível intactos | Provado — `metas.teste.ts:217-243`, `metas-dod.teste.ts:334-357` |
| Guardar reduz o lastro | `lastroCentavos` cai exatamente o guardado | Provado — `metas.teste.ts:308-326`, `metas-dod.teste.ts:368-384` |
| Isolamento entre famílias | Nenhum dado vaza, em toda operação | Provado — `metas.teste.ts:523-558`, `metas-dod.teste.ts:487-525` |
| Dois clientes veem o valor guardado sem refresh | Invalidação chega à sessão irmã | Provado — `metas.teste.ts:565-652`, `metas-dod.teste.ts:537-575` |
| `PROVA_DE_COMPORTAMENTO=PASS` | Gate mestre verde em cada tarefa | Citado pela tabela de linhagem da issue #89 (#85 a #88, todos `PASS`) — **não** reconferível no corpo dos commits de merge desta história (ver EF07-MC-004 e a nota de Confiança acima); esta tarefa (#89), de documentação, não toca `api/`/`web/`/`.preator/skills/` e portanto não altera nem recarimba nenhum desses números |

## Pendências de decisão

Nenhuma pendência **em aberto que bloqueie** a EF-07. Duas já foram decididas durante a execução e
estão registradas em EF-07 §5 (não repetidas aqui — fato duplicado é bug):

- **D1..D5**, tomadas antes de qualquer código (mesmo padrão que EF-06 usa para o lastro).
- **O ponteiro de fonte de D2** (D3 mora em MANUAL-05/MC-05, não na EF-05) — corrigido dentro do
  ciclo da própria tarefa #85 (`79621a0`), depois de reprovado na revisão (`701c3bb`).

Duas lacunas seguem **abertas como fork ao humano**, fora da pasta desta tarefa:

- **`EF07-MC-001`** — a ausência de transação em `criarMeta`, que exigiria editar `modulos/contas/`.
- **`EF07-MC-002`** — o badge da sidebar do desktop, que exigiria editar
  `web/app/config/navegacao.ts` (o `Destino` não tem campo de badge hoje).

## Próximo passo

Nenhuma dependência aberta desta matriz bloqueia a próxima história. A **EF-08** (Fechamento)
segue a tabela de dependências de `docs/especificacoes/README.md`. Se uma história futura tocar
`modulos/contas/servico.ts` para dar suporte a `tx` em `criarConta`, `EF07-MC-001` pode ser fechada
como efeito colateral — não precisa ser reaberta como tarefa própria de `metas`.

## Status final do ciclo

- [x] EF atualizada (`EF-07-metas.md` §5 marca o DoD contra o teste que prova cada item, e registra
      as decisões D1..D5 e o que a execução encontrou no caminho — ver MANUAL-07)
- [x] MC criada
- [x] MANUAL as-built criado
- [x] Toda tarefa de construção desta história (#85 a #88) citada `PASS`/`APROVADA` pela tabela de
      linhagem da issue #89 (conferido: não recarimbado por esta tarefa — fora do escopo de `docs`;
      ver a ressalva de Confiança sobre a ausência de carimbo no corpo dos merges)
- [ ] PR aberto — a devolver pelo condutor após o merge desta tarefa (#89: fecha a tríade EF/MC/MANUAL
      desta história)
- [ ] Fork ao humano: `EF07-MC-001` (transação em `criarMeta`, depende de editar `modulos/contas/`)
      e `EF07-MC-002` (badge da sidebar, depende de editar `web/app/config/navegacao.ts`) — nenhum
      dos dois é da pasta desta tarefa
