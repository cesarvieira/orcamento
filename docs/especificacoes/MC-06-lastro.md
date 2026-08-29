# MC-06 — Matriz de Completude · Lastro

> O que **falta** decidir/construir/validar para EF-06 alcançar padrão implantável. Não repete o
> que a EF já resolveu. Ver [EF-06](EF-06-lastro.md) (o contrato) e
> [MANUAL-06](../manual/MANUAL-06-lastro.md) (o que foi construído).

- **Conteúdo base:** Com conteúdo — toda tarefa mesclada nesta história fechou
  `PROVA_DE_COMPORTAMENTO=PASS` e revisão `APROVADA` (lista viva, na ordem real — não envelhece
  como uma contagem fixa neste texto: `git log --oneline --first-parent
  main..historia/20-ef-06-lastro`, ou, antes de a branch de história existir localmente,
  `git log --oneline f2b67aa^..7d9f35d`). O DAG avalizado pelo humano na abertura da #20 listava
  #76 (backend), #77 (tela), #78 (os casos do DoD) e #79 (documentação, esta tarefa) — **nenhuma
  tarefa nasceu fora da decomposição original**. A tarefa #76 teve retrabalho **dentro** do próprio
  ciclo da tarefa (reprovada em `3aa59b1`, corrigida em `1b81f1f`, aprovada só depois) — não é
  tarefa extra do DAG, é o próprio Portão B fazendo o trabalho dele.
- **Confiança:** Alta (código e os dois arquivos de teste lidos linha a linha por este agente
  `docs`, cada citação abaixo aberta na linha exata — não só a região —, mais o carimbo
  `Gate PASS + revisão APROVADA` citado no próprio commit de merge de cada tarefa: `f2b67aa` #76,
  `fccec4b` #77, `7d9f35d` #78 — re-executado pelo condutor, não recarimbado por esta tarefa).
- **Critério de completude:** igual ao de [MC-00](MC-00-plataforma.md) a [MC-05](MC-05-faturas.md)
  — `Concluído` quando o gate prova de forma reproduzível; `Parcial` quando o código existe mas não
  há prova automatizada, ou a prova não alcança o caso; `Pendente` quando nem o código existe.

## Como ler a coluna de evidência

Dois arquivos de teste, **deliberadamente disjuntos** (cada cabeçalho declara isso): `lastro.teste.ts`
(tarefa #76 — prova a **fiação**: que `modulos/lastro/servico.ts` está de fato ligado a `contas`,
`faturas` e `orcamento`) e `lastro-rateio.teste.ts` (tarefa #78 — prova a **regra em largura**: um
`describe` por item do DoD §5, nomeado literalmente com o item e a RN). Os `describe` de
`lastro-rateio.teste.ts` são numerados **1 a 10** abaixo, na ordem em que aparecem no arquivo —
essa numeração é desta matriz, não do arquivo (que não numera).

| # | `describe` (linha) | O que prova |
|---|---|---|
| 1 | `:200` RN-27 dinâmico | reserva fora do lastro, inclusive quando ela recebe dinheiro depois |
| 2 | `:220` RN-28 quebrado | limite livre de dois cartões, valores não redondos |
| 3 | `:235` RN-29 empate | quatro categorias iguais recebem a mesma fração pró-rata |
| 4 | `:280` RN-30 destaque | `liberadoTotalCentavos` estritamente menor que o planejado e que o disponível |
| 5 | `:310` RN-31 desbloqueio | receita eleva o lastro, reduz bloqueado, **tetos intactos** |
| 6 | `:352` RN-32 vencedor único | resíduo cai inteiro na única maior categoria, sem empate |
| 7 | `:408` §5.2/§5.4 limite | déficit quase total — duas categorias tocam o teto exato do disponível |
| 8 | `:456` §5.3 sem déficit | quatro categorias, tetos quebrados, bloqueado zero em todas |
| 9 | `:489` §5.6 guardar em meta | `TRANSFERENCIA` DEBITO→RESERVA reduz o lastro e cria bloqueio novo |
| 10 | `:545` cascata em largura | empate de duas + uma categoria de disponível **zero** no meio do laço |

## Matriz de completude

| Área | Capacidade esperada | Status | O que falta / evidência |
|---|---|---|---|
| Dados | Nenhuma entidade nova — lastro é sempre **derivado** | Concluído | `api/src/modulos/lastro/servico.ts:1-21` (cabeçalho do módulo, cita EF-06 §1 e a skill de negócio); nenhuma migration nova nesta história (`find api/drizzle -newer <base>` vazio) |
| RN-27 · reserva fora do lastro | `RESERVA` nunca entra em `caixaReal`, nem no estado inicial nem dinamicamente | Concluído | `api/src/modulos/lastro/servico.ts:50-54` (`caixaRealCentavos`, filtra só `DEBITO`). Testado: `api/testes/lastro.teste.ts:151-176` (débito negativo não conta, reserva com saldo alto de fora) e `api/testes/lastro-rateio.teste.ts:200-218` (teste 1 — a reserva **recebe** receita depois e o lastro não se move um centavo: RN-27 não é só "começa de fora", é "está sempre de fora") |
| RN-28 · limite livre agregado | `Σ (limite − fatura em aberto)` de **todos** os cartões da família, D1 já herdado de EF-05 | Concluído | `api/src/modulos/faturas/servico.ts:355-363` (`limiteLivreTotalCentavos`, estende a fórmula por-cartão de RN-26/D1 para soma da família); `api/src/modulos/lastro/servico.ts:61-73` (`calcularLastro` soma com `caixaReal`). Testado: `lastro.teste.ts:178-194` (dois cartões, um com despesa) e `lastro-rateio.teste.ts:220-233` (teste 2 — limites e despesa em valores quebrados) |
| RN-29 · pró-rata sem privilégio | `bloqueado = max(0,disponível) × déficit / restanteTotal`, piso por `Math.floor` (D-06) | Concluído | `api/src/modulos/lastro/servico.ts:161-199` (`ratearDeficit`, o piso pró-rata). Testado: `lastro.teste.ts:196-235` (três categorias, valores quebrados) e `lastro-rateio.teste.ts:235-278` (teste 3 — **empate exato**: quatro categorias com o mesmo disponível recebem a mesma fração — só o resíduo, não a regra, diferencia uma delas) |
| RN-30 · número em destaque | `liberadoTotalCentavos = restanteTotal − déficit`, nunca o plano cheio | Concluído | `api/src/modulos/orcamento/servico.ts:61-62,378-379` (campo devolvido pronto, nunca recalculado no front); tela `web/app/pages/index.vue:241-242` (rótulo "LIBERADO ATÉ O FIM DO MÊS" + o número). Testado: `lastro-rateio.teste.ts:280-308` (teste 4 — o destaque é estritamente menor que `planejadoCentavos` **e** que `disponivelCentavos` da categoria, não só menor que o teto) |
| RN-31 · entrada de dinheiro desbloqueia | Receita eleva o lastro e reduz o bloqueado; **nenhum teto muda** | Concluído | Efeito é consequência pura de `ratearDeficit` ser recalculado a cada leitura (`orcamento/servico.ts:345-352`) sobre um `lastroCentavos` maior — nenhum código dedicado a "desbloquear". Testado: `lastro-rateio.teste.ts:310-350` (teste 5 — antes/depois de uma `RECEITA`: `bloqueadoCentavos` cai nas duas categorias, `tetoCentavos` e `planejadoCentavos` ficam bit a bit idênticos) |
| RN-32 · resíduo + soma exata | Resíduo vai para a maior categoria; soma dos bloqueados == déficit, sempre | Concluído — **com extensão sobre a letra original** (ver EF-06 §2/§5, e item "Cascata" abaixo) | `api/src/modulos/lastro/servico.ts:196-233` (piso + resíduo). Testado: `lastro.teste.ts:196-235` (caso simples, vencedor único) e `lastro-rateio.teste.ts:352-399` (teste 6 — cinco categorias assimétricas, resíduo inteiro na maior, sem empate) |
| DoD §5.1 · um teste por RN | RN-27..RN-32, cada uma com `describe` próprio | Concluído | `lastro-rateio.teste.ts` — ver a tabela de numeração acima (testes 1 a 6, um `describe` por RN, título literal com a RN) |
| DoD §5.2 · soma dos bloqueados == déficit | Com valores quebrados, a soma fecha exata | Concluído | Aritmética interna: `api/src/modulos/lastro/servico.ts:202-203` (`somaBrutaCentavos`/`residuoCentavos`, o resíduo é sempre `deficit − somaBruta`, nunca solto). Assert explícito: `lastro-rateio.teste.ts:393` (teste 6, 5 categorias) e `:447` (teste 7, no limite do bloqueio quase total) |
| DoD §5.3 · sem déficit → zero em todas | `lastro ≥ restanteTotal` ⇒ `bloqueado = 0` em toda categoria | Concluído | `api/src/modulos/lastro/servico.ts:180-191` (ramo de retorno antecipado quando `deficitCentavos === 0`). Testado com **largura** (quatro categorias, tetos quebrados, não a categoria única de #76): `lastro-rateio.teste.ts:456-481` (teste 8) |
| DoD §5.4 · bloqueado nunca excede disponível | Invariante que, junto com §5.2, **força** `déficit ≤ restanteTotal` | Concluído | Derivação comentada em `api/src/modulos/lastro/servico.ts:110-134` (a prova de que as duas invariantes do DoD obrigam o cap — ver EF-06 §5 abaixo). Testado no limite exato (`bloqueado == disponível`, `liberado == 0`): `lastro-rateio.teste.ts:408-449` (teste 7, `:435-444`); em largura (loop sobre todas): `:352-399` (teste 6, `:395-397`) e `:545-610` (teste 10, `:599-602`); implícito em `:489-535` (teste 9, `1679 ≤ 6000`) |
| DoD §5.5 · receita reduz bloqueado sem alterar teto | Mesmo item de RN-31, é o mesmo teste | Concluído | `lastro-rateio.teste.ts:310-350` (teste 5 — os "dois lados" comentados no próprio arquivo, `:339`) |
| DoD §5.6 · guardar em meta reduz o lastro | Provado **sem EF-07** — `TRANSFERENCIA` `DEBITO`→`RESERVA` (ver EF-06 §5, nota de decisão) | Concluído | `api/src/db/schema.ts:67-71` (enum `tipoLancamento`, `TRANSFERENCIA` existe; nenhum `pgTable('metas', ...)` no arquivo — `Meta` não é entidade ainda). Testado: `lastro-rateio.teste.ts:489-535` (teste 9 — a transferência não toca `tetoCentavos`/`gastoCentavos` da categoria, só o `lastroCentavos`, e pode **criar** bloqueio que não existia) |
| Cascata do resíduo (extensão sobre RN-32, retrabalho da revisão de #76) | Quando a maior categoria não tem folga para o resíduo inteiro, o excedente cai para a próxima maior | Concluído — 🔵 **extensão**, não citação literal de RN-32 (ver EF-06 §2/§5, proposta de texto) | `api/src/modulos/lastro/servico.ts:205-233` (o laço de cascata, com o `throw` de defesa em `:224-232` para o caso que a prova matemática do comentário diz que não deveria ocorrer). Nasceu do retrabalho `1b81f1f` (reprovação em `3aa59b1`). Provado em largura por #78: `lastro-rateio.teste.ts:545-610` (teste 10 — **duas categorias empatadas** absorvem o resíduo em sequência e **uma categoria de disponível zero** no meio do rateio nunca recebe nada e não trava o laço) |
| Cap do déficit em `restanteTotal` (retrabalho da revisão de #76) | `déficit = min(restanteTotal, max(0, restanteTotal − lastro))`, nunca o valor cru quando `lastro < 0` | Concluído | `api/src/modulos/lastro/servico.ts:176-177` (o cap em si) e `:110-134` (a derivação comentada — as duas invariantes do DoD §5 forçam isto por aritmética, não é regra nova). Testado (caso de regressão da revisão, cartão over-limit): `lastro.teste.ts:255-292` |
| Isolamento entre famílias | O lastro de uma família nunca aparece na leitura de outra | Concluído | `api/testes/lastro.teste.ts:339-352` (família B lê 0, mesmo com A tendo R$ 5.000 de lastro) |
| Tela — faixa de bloqueio | Card de aviso, entre o cartão-herói e "Categorias", quando `deficitCentavos > 0` | Concluído (código), **sem exercício por máquina** | `web/app/pages/index.vue:259-268` (o card e o texto, incluindo a variante DESKTOP — ver MANUAL-06/EF-06 §5); rota `/` coberta pelo gate de navegação (`web/app/config/navegacao.ts:62`), mas o crawler não força `deficitCentavos > 0` — mesma limitação de MC-04/MC-05 (seed sem o cenário) |
| Tela — barra hachurada | Segunda faixa da barra, largura `bloqueado/teto`, hachura visual | Concluído (código), sem exercício por máquina | `web/app/pages/index.vue:197-204` (`larguraBloqueio`, mede contra o TETO); `web/app/assets/scss/pages/home.scss:267-270` (`repeating-linear-gradient`, a hachura em si) |
| Tela — rótulo `parcial` | Prioridade `estourou` > `parcial` > percentual | Concluído (código), sem exercício por máquina | `web/app/pages/index.vue:183-188` (`pctLabel`, a ordem de prioridade) e `:294` (uso no template) |
| Tela — linha "bloqueado por falta de lastro" | Por categoria, quando `bloqueadoCentavos > 0` | Concluído (código), sem exercício por máquina | `web/app/pages/index.vue:206-209` (`bloqLabel`) e `:298` (uso, condicionado a `c.bloqueadoCentavos > 0`) |

## Lacunas

| Código | Lacuna | Impacto | Prioridade |
|---|---|---|---|
| EF06-MC-001 | **Nenhum teste de tela exercita o estado de bloqueio.** O gate de navegação abre a rota `/` (`navegacao.ts:62`), mas não força uma família com `deficitCentavos > 0` — a faixa de aviso, a hachura e o rótulo `parcial` foram lidos no código (`index.vue:183-209,259-268`; `home.scss:267-270`), nunca vistos rodando. Mesma classe de limitação de MC-04/MC-05. | O comportamento correto não tem confirmação visual automatizada | Baixa — herdada do padrão já aceito nas duas histórias anteriores |
| EF06-MC-002 | **Divergência de texto entre o mockup mobile e o que foi construído**, registrada e decidida — não é bug, é decisão do humano em 2026-08-29 (ver EF-06 §5): a variante DESKTOP entrou (`index.vue:264-265`, "Conta corrente + limite dos cartões cobrem «lastro». A reserva fica fora do orçamento."), a variante MOBILE ficou de fora ("limite do cartão", "A poupança está reservada para as metas") | Nenhum — decisão fechada, registrada para não ser redescoberta como bug | — decidida |
| EF06-MC-003 | **Risco teórico de overflow de `Number` em `disponível × déficit`**, pré-existente ao lastro: `api/src/modulos/lastro/servico.ts:199` multiplica dois `centavos` antes de dividir; com valores próximos do teto de 32 bits que `D-06` já documenta (`docs/decisoes/D-06-dinheiro-em-centavos.md`, "teto de ~R$ 21 milhões em centavos"), o produto intermediário pode ultrapassar `Number.MAX_SAFE_INTEGER` só num cenário de família com orçamento extremo. Nenhum teste desta história cobre esse limite. | Baixo na prática (o teto de 32 bits do `integer` do Postgres já limita os dois operandos bem abaixo do ponto onde o produto perderia precisão em `Number`, que é de 53 bits) — registrado porque é aritmética que ninguém verificou explicitamente | Baixa |
| EF06-MC-004 | **Falta política para travar `DESPESA` além do `limiteCentavos` do cartão.** É essa lacuna — não o rateio do lastro — que permite `lastroCentavos` chegar negativo na prática (cenário reproduzido pela revisão e testado em `lastro.teste.ts:255-292`). O cálculo do lastro já é determinístico em qualquer sinal (ver o cap acima), mas a pergunta "deveria a compra ter sido bloqueada antes?" é de outro módulo. | Sem trava, um cartão pode ficar indefinidamente over-limit, criando déficit e bloqueio de plano que uma trava anterior evitaria | Média — é de outra EF, não desta; registrada para não ser perdida |
| EF06-MC-005 | **Inconsistência interna no cabeçalho de `web/app/pages/index.vue`** (arquivo de #77, fora da pasta desta tarefa): a linha `:3` cita o recorte de desenho da EF-04 como `.motor/recorte-desenho-18.md` (com o prefixo `.motor/`), enquanto a linha `:5` do mesmo parágrafo diz que o recorte da EF-06, `recorte-desenho-20.md`, fica "também na raiz do worktree" (sem esse prefixo) — as duas frases descrevem convenções de caminho diferentes para o mesmo tipo de artefato, no mesmo comentário. Não corrigido aqui — é arquivo de #77, fora do escopo de pasta desta tarefa (#79 é só `docs/`). | Nenhum efeito em runtime (os `recorte-*.md` não são versionados, então nenhum código lê o caminho); é só uma inconsistência de documentação interna que pode confundir quem procurar o arquivo pelo caminho errado | Baixa — cosmética, registrada por completude |

## Riscos de implantação

| Risco | Severidade | Mitigação |
|---|---|---|
| Uma tela nova reimplementar o rateio no cliente em vez de ler `bloqueadoCentavos`/`liberadoCentavos` prontos, criando uma segunda fonte da regra que define o produto | Alta | Regra inviolável nº 4 do `.preator/CONTEXT.md`, reforçada em comentário em `orcamento/servico.ts:341-343` e no cabeçalho de `lastro/servico.ts:1-21`; o contrato gerado (`@orcamento/contrato`) já expõe os campos prontos, sem exigir recálculo |
| Um módulo futuro (EF-07/EF-08) reintroduzir "resíduo inteiro para a maior categoria, sem cascata" — a leitura estreita da letra original de RN-32, já reprovada por uma revisão real | Média | `api/src/modulos/lastro/servico.ts:136-160` documenta a prova matemática por que a cascata é necessária; proposta de atualização do texto de RN-32 registrada em EF-06 §2 (ver nota de decisão) para não depender só do comentário de código |
| `EF06-MC-004` (nenhuma trava em `DESPESA` além do limite do cartão) ser resolvida só dentro do módulo de lastro, "escondendo" o sintoma em vez do módulo de lançamentos/faturas tratar a causa | Baixa | Registrado explicitamente como de outra EF — quem tratar deveria decidir onde a trava mora, não remendar o cap do déficit |

## Validações obrigatórias para implantação

| Validação (EF-06 §5) | Resultado esperado | Status |
|---|---|---|
| Um teste por RN (RN-27..RN-32) | Cada RN com `describe` próprio, nomeado | Provado — `lastro-rateio.teste.ts`, testes 1–6 (ver tabela de numeração) |
| Soma dos bloqueados == déficit, com valores quebrados | Fecha exato, nunca sobra nem falta um centavo | Provado — `lastro-rateio.teste.ts:393` (teste 6) e `:447` (teste 7) |
| Sem déficit → bloqueado zero em todas | `lastro ≥ restanteTotal` não bloqueia ninguém | Provado em largura (4 categorias) — `lastro-rateio.teste.ts:456-481` (teste 8) |
| Bloqueado nunca excede o disponível da categoria | Inclusive no limite exato (`bloqueado == disponível`) | Provado — `lastro-rateio.teste.ts:408-449` (teste 7), reforçado em `:352-399` (teste 6) e `:545-610` (teste 10) |
| Receita reduz o bloqueado e não altera teto nenhum | `tetoCentavos`/`planejadoCentavos` idênticos antes/depois | Provado — `lastro-rateio.teste.ts:310-350` (teste 5) |
| Guardar em meta reduz o lastro | `TRANSFERENCIA` DEBITO→RESERVA, sem tocar teto/gasto | Provado — `lastro-rateio.teste.ts:489-535` (teste 9) |
| Cascata do resíduo (extensão de RN-32, não no DoD original, ratificada pela revisão) | Empates e categoria de disponível zero não travam nem estouram | Provado — `lastro-rateio.teste.ts:545-610` (teste 10) |
| `PROVA_DE_COMPORTAMENTO=PASS` | Gate mestre verde, sem SKIP bloqueante | Provado em toda tarefa mesclada — carimbo citado no próprio commit de merge: `f2b67aa` (#76, 214 testes), `fccec4b` (#77, 214 testes, navegação 10/0), `7d9f35d` (#78, 224 testes). **Evidência POR TAREFA** — o carimbo de NÍVEL-HISTÓRIA que fecha o DoD da #20 é aplicado por `carimbar-issue.sh 20`, depois da revisão de costura sobre a árvore integrada, não executado ainda no momento em que este texto foi escrito |

## Pendências de decisão

Nenhuma pendência **em aberto que bloqueie** a EF-06. Duas já foram decididas durante a execução e
estão registradas em EF-06 §5 (não repetidas aqui — fato duplicado é bug):

- **O texto da faixa de bloqueio** (variante desktop vs. mobile) — decisão humana, 2026-08-29.
- **O cap do déficit em `restanteTotal`** — não é decisão nova, é derivação obrigatória das duas
  invariantes que a própria EF-06 §5 já escrevia; registrado como tal, não como escolha.

Uma extensão de regra foi **implementada e testada, mas o texto de RN-32 na fonte (EF-06 §2 e a
skill de negócio) ainda não reflete a cascata** — ver EF-06 §5 para a proposta de texto e o fork
aberto sobre a skill (fora do escopo de arquivo desta tarefa).

## Próximo passo

A **EF-07** (Metas, #21, ainda não iniciada) é quem formaliza "guardar em meta" como entidade
própria — hoje provado só como `TRANSFERENCIA` `DEBITO`→`RESERVA` (RN-27 pura, ver EF-06 §5). Quando
a EF-07 nascer, ela herda o efeito no lastro já pronto (RN-27/RN-35 seriam a mesma regra por dois
nomes) e não deveria recalcular nada aqui. A **EF-08** (Fechamento) depende de EF-06 conforme a
tabela de dependências de `docs/especificacoes/README.md` — nenhuma pendência desta matriz bloqueia
sua abertura.

## Status final do ciclo

- [x] EF atualizada (`EF-06-lastro.md` §5 marca o DoD contra o teste que prova cada item, e registra
      as decisões e a derivação tomadas durante a execução; §2 recebe a proposta de texto atualizado
      de RN-32 — ver MANUAL-06)
- [x] MC criada
- [x] MANUAL as-built criado
- [x] Toda tarefa de construção desta história (#76 a #78) já estava carimbada
      `PROVA_DE_COMPORTAMENTO=PASS` com revisão `APROVADA`, citada no próprio commit de merge
      (conferido, não recarimbado por esta tarefa — fora do escopo de `docs`)
- [ ] PR aberto — a devolver pelo condutor após o merge desta tarefa (#79: fecha a tríade EF/MC/MANUAL
      desta história)
- [ ] Fork ao humano: texto de RN-32 na skill `.preator/skills/negocio/contas-e-lastro/SKILL.md`
      (fora do escopo de arquivo desta tarefa — ver EF-06 §5 e o relato desta tarefa)
