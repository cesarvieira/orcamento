# MANUAL as-built — EF-06 Lastro

> O que foi **construído**, não o que a EF previu. Nasce na implantação; é a base para entender o
> módulo sem ler o código. Ver [EF-06](../especificacoes/EF-06-lastro.md) (o contrato) e
> [MC-06](../especificacoes/MC-06-lastro.md) (o que falta).

- **Identificação:** Lastro · EF-06 · história [#20](https://github.com/cesarvieira/orcamento/issues/20)
  · tarefas: [#76](https://github.com/cesarvieira/orcamento/issues/76) (módulo: caixa real, limite
  livre, déficit, rateio pró-rata), [#77](https://github.com/cesarvieira/orcamento/issues/77) (home:
  número liberado, faixa de bloqueio, barra hachurada), [#78](https://github.com/cesarvieira/orcamento/issues/78)
  (os dez casos do DoD, valores quebrados), [#79](https://github.com/cesarvieira/orcamento/issues/79)
  (documentação, esta tarefa). **Nenhuma tarefa nasceu fora do DAG avalizado pelo humano na abertura
  da #20** — a tarefa #76 teve retrabalho **dentro do próprio ciclo dela** (reprovada na revisão,
  corrigida, aprovada), o que é o Portão B funcionando, não uma tarefa extra.
  **Lista viva de toda tarefa mesclada, na ordem real:** `git log --oneline f2b67aa^..7d9f35d`
- **Construído por:** agente `backend`, esforço alto (#76); agente `frontend` (#77); agente `qa`
  (#78); agente `docs` (#79) — todos `claude-sonnet-5`
- **Data:** 2026-08-29 (todas as tarefas)
- **Commits e merges (na ordem do DAG real):**
  - #76 — `eb815ef` (módulo: caixa real, limite livre, rateio pró-rata) + `3aa59b1` (remove export
    sem consumidor, knip) **reprovado na revisão de diff** + `1b81f1f` (retrabalho: capa o déficit,
    distribui o resíduo em cascata) mesclados em `f2b67aa`
  - #77 — `2899ac8` (home: liberado, faixa de bloqueio, barra hachurada) mesclado em `fccec4b`
  - #78 — `84e5547` (os dez casos do DoD, fixture com valores quebrados) mesclado em `7d9f35d`
  - #79 — esta tarefa (docs — MC-06/MANUAL-06, as-built de EF-06 §5, proposta de texto de RN-32 em
    §2): commit ainda sem hash no momento em que este texto foi escrito — confira com
    `git log --oneline f2b67aa^..HEAD`
- **Confiança:** Alta (os dois arquivos de teste e o serviço lidos linha a linha por este agente
  `docs`, cada citação abaixo aberta na linha exata, mais o carimbo `Gate PASS + revisão APROVADA`
  citado no próprio commit de merge de cada tarefa).

---

## O que o módulo faz, para quem usa

O app não deixa a família acreditar que pode gastar mais do que realmente tem. O **lastro** é a
soma do dinheiro de verdade disponível **agora**: o que está nas contas correntes (nunca a
poupança) **mais** o quanto ainda sobra de limite nos cartões de crédito. Quando a soma dos planos
por categoria (o que ainda falta gastar até o teto de cada uma) ultrapassa esse lastro, o app
**bloqueia** proporcionalmente: cada categoria perde a mesma fração do seu próprio plano, e o
número em destaque da home para de mostrar o total planejado — mostra só o que dá para gastar de
verdade.

A família vê isto na tela **Visão do mês** (`/`, a home): o número "LIBERADO ATÉ O FIM DO MÊS" no
topo é o número pós-bloqueio, nunca o plano cheio; quando há bloqueio, um cartão de aviso explica o
porquê; e cada categoria com bloqueio ganha uma segunda faixa hachurada na barra e o rótulo
`parcial`. **Nenhum cálculo acontece na tela** — os cinco campos que fecham o lastro
(`lastroCentavos`, `deficitCentavos`, `liberadoTotalCentavos`, e por categoria
`bloqueadoCentavos`/`liberadoCentavos`) chegam prontos do servidor, na mesma leitura que já trazia
teto/gasto/disponível (regra inviolável nº 4 do `.preator/CONTEXT.md`).

## Backend — `api/src/modulos/lastro/servico.ts` (#76)

### `calcularLastro` — caixa real + limite livre

`caixaRealCentavos` (`servico.ts:50-54`) soma **só** as contas `DEBITO`, com piso em zero **conta a
conta** (RN-27): uma conta de débito no vermelho não puxa o total para baixo, ela só contribui zero
— e a `RESERVA` nunca entra no filtro. Isto é **deliberadamente** uma soma nova, não um reaproveite
do total pronto de `listarContas` (que soma o saldo bruto, podendo ir negativo) — o comentário do
próprio código (`:41-49`) explica por quê.

`limiteLivreTotalCentavos` (`api/src/modulos/faturas/servico.ts:355-363`, estendido por esta
história, RN-28) soma `limite + saldoCentavos` de **todos** os cartões da família — não recalcula
nada de D1 (EF-05): o `saldoCentavos` de uma `CREDITO` já chega negativo, com "fatura em aberto" no
sentido amplo de D1 embutido. `calcularLastro` (`lastro/servico.ts:61-73`) soma os dois números:
`lastro = caixaReal + limiteLivre`.

### `ratearDeficit` — a função pura do déficit (RN-29/RN-32)

Recebe só o `disponivelCentavos` de cada categoria e o `lastroCentavos` — **não toca banco**, é a
peça mais fácil de testar isoladamente (`lastro/servico.ts:161-245`). O piso pró-rata é divisão
inteira (`Math.floor`, D-06, `:196-200`); o resíduo da divisão (`:202-203`) segue para a categoria
de maior saldo, em **cascata** quando ela não tem folga (ver a seção própria abaixo).

## D1-como · o cap do déficit (decisão da execução, não do humano — é derivação)

> **`déficit = min(restanteTotal, max(0, restanteTotal − lastro))`**, nunca o `restanteTotal −
> lastro` cru.

A primeira entrega de #76 (`3aa59b1`) **foi reprovada** na revisão de diff: sem o `min(...)`, um
`lastroCentavos` negativo (um cartão pode ficar acima do próprio limite — nenhum módulo trava
`DESPESA` além do `limiteCentavos` hoje, ver "O que ainda não é desta EF" abaixo) fazia
`déficit > restanteTotal`, e o rateio pró-rata bloqueava mais que o disponível de pelo menos uma
categoria — `liberadoCentavos` chegava a ficar **negativo**, quebrando a garantia que o próprio
esquema Zod declara (`api/src/modulos/orcamento/esquemas.ts:121,127`, `.nonnegative()`).

**Isto não foi uma regra nova inventada na hora.** É consequência aritmética direta das duas
invariantes que a EF-06 §5 já enunciava antes desta história ("soma dos bloqueados == déficit" e
"bloqueado nunca excede o disponível") — as duas juntas **forçam** `déficit ≤ restanteTotal`. A
derivação completa está comentada em `api/src/modulos/lastro/servico.ts:110-134`, e o texto
equivalente entrou em [EF-06 §5, nota (c)](../especificacoes/EF-06-lastro.md). O caso de regressão
que a revisão reproduziu (cartão com limite 0 e uma despesa de 1 centavo, `lastro = −1`) está
provado em `api/testes/lastro.teste.ts:255-292`.

## A cascata do resíduo — extensão de RN-32, não citação literal

A letra original de RN-32 ("o resíduo do rateio vai para a categoria de maior saldo") está no
**singular** e não previa o caso em que essa categoria não tem folga (`disponível − bloqueado
bruto`) para absorver o resíduo inteiro. A mesma revisão que reprovou o cap do déficit reproduziu
este segundo achado com `disponíveis=[1,1,1], lastro=1`: déficit=2, cada bloqueado bruto é 0
(`floor(1×2/3)=0`), resíduo=2 — jogar os 2 centavos inteiros numa categoria de disponível 1
estouraria a invariante do DoD §5.

O conserto (`api/src/modulos/lastro/servico.ts:205-233`) distribui em cascata: ordena as categorias
por disponível decrescente, e para cada uma dá o mínimo entre a folga dela e o resíduo restante,
avançando para a próxima até o resíduo se esgotar. Uma defesa em profundidade (`:224-232`) lança
erro se sobrar resíduo ao final — a própria prova matemática do comentário (`:136-160`) diz que isto
não deveria acontecer quando o cap do déficit já está em vigor.

A revisão de diff classificou esta correção como 🔵 **extensão** de RN-32, não uma regra nova — a
letra ("maior saldo primeiro") e o propósito ("a soma fecha exatamente o déficit") continuam
valendo juntos. **O texto de RN-32 na [EF-06 §2](../especificacoes/EF-06-lastro.md) já foi
atualizado por esta tarefa (#79)** para registrar a cascata; a skill de negócio
`.preator/skills/negocio/contas-e-lastro/SKILL.md` **ainda não foi** — está fora do escopo de
arquivo desta tarefa (`docs` não toca `.preator/skills/`), e foi aberta como fork ao humano (ver o
relato desta tarefa ao condutor).

## Contrato — `api/src/modulos/orcamento/esquemas.ts`

Os cinco campos do lastro entram no schema Zod que gera o OpenAPI e os tipos do front — nenhum é
redeclarado no cliente. No nível da categoria (`:121-131`): `liberadoCentavos` e
`bloqueadoCentavos`, ambos `.nonnegative()` — a garantia de tipo que o cap do déficit (acima)
existe para nunca violar. No nível da competência (`:147-159`): `lastroCentavos` (**sem**
`.nonnegative()` — pode ser negativo de propósito, é o próprio sinal de cartão acima do limite),
`deficitCentavos` e `liberadoTotalCentavos` (os dois `.nonnegative()`).

## Wiring — `api/src/modulos/orcamento/servico.ts` (a costura, não pasta desta história)

A leitura de competência (`lerCompetencia`) chama `calcularLastro` e `ratearDeficit`
(`servico.ts:345-352`) e junta o resultado a cada categoria (`:355-367`) e ao topo da resposta
(`:369-382`). Os três campos de topo (`lastroCentavos`, `deficitCentavos`, `liberadoTotalCentavos`)
estão declarados na interface `CompetenciaLida` (`:57-62`). Esta costura pertence à pasta
`orcamento/`, não a `lastro/` — mas é onde o módulo se conecta ao resto do produto, e por isso está
registrada aqui.

## Frontend — `web/app/pages/index.vue` (#77)

Fecha três pontos do cabeçalho da tela `home` (já existente desde a EF-04, `#77` só adiciona o que
é do lastro — ver o cabeçalho do próprio arquivo, `index.vue:1-94`, para o resto da tela):

- **O número dominante do cartão-herói** (`:241-242`) passa a ser `liberadoTotalCentavos` — RN-30,
  "nunca o plano cheio quando há déficit". Rótulo do mockup, "LIBERADO ATÉ O FIM DO MÊS".
- **A faixa de bloqueio** (`:259-268`), condicionada a `deficitCentavos > 0`: o valor do déficit no
  título, e o texto explicativo — ver a decisão de texto abaixo.
- **A barra de duas faixas por categoria e o rótulo `parcial`**: `pctLabel` (`:183-188`) decide
  `estourou` > `parcial` > percentual, nesta ordem de prioridade; `larguraBloqueio` (`:201-204`)
  mede a segunda faixa contra o **teto** (mesma base da faixa gasta); `bloqLabel` (`:206-209`) monta
  a linha "«valor» bloqueado por falta de lastro", mostrada só quando `bloqueadoCentavos > 0`
  (`:298`). A hachura em si é CSS (`web/app/assets/scss/pages/home.scss:267-270`,
  `repeating-linear-gradient`).

### A decisão de texto da faixa de bloqueio (humano, 2026-08-29)

O texto que entrou é a variante **DESKTOP** do mockup:

> *"Conta corrente + limite dos cartões cobrem «lastro». A reserva fica fora do orçamento."*
> (`index.vue:264-265`)

Decidido pelo humano porque `lastro` e `reserva` são os termos do produto — o glossário da skill de
negócio os define precisamente, e o app já usa os dois em toda parte — e o plural ("cartões") é
correto quando a família tem mais de um. **O mockup MOBILE traz outra redação** para o mesmo aviso
— "limite do cartão" (singular) e "A poupança está reservada para as metas" ("poupança" em vez de
"reserva") — e essa variante **não foi portada**: esta tela é um único template responsivo, sem
split mobile/desktop, e só uma das duas fontes podia entrar. **A divergência é do desenho** (o
protótipo tem duas variantes de texto que nunca precisaram concordar entre si, porque cada uma
vivia na sua própria tela), não um desvio do código em relação a uma fonte única.

## Testes

Dois arquivos de teste, **deliberadamente disjuntos** — cada cabeçalho declara isso, e nenhum
cenário repete valores ou combinação de conta/cartão/categoria do outro:

### `api/testes/lastro.teste.ts` (#76, 7 `describe`) — prova a fiação

Que `modulos/lastro/servico.ts` está de fato ligado a `contas`, `faturas` e `orcamento`, e que os
campos chegam certos na leitura HTTP real de competência: RN-27 com débito negativo (`:151-176`),
RN-28 com dois cartões (`:178-194`), RN-29/RN-32 com resíduo simples (`:196-235`), sem déficit
(`:237-253`), os dois casos de regressão da revisão — cap do déficit com lastro negativo
(`:255-292`) e cascata com `disponíveis=[1,1,1]` (`:294-336`) — e isolamento entre famílias
(`:339-352`).

### `api/testes/lastro-rateio.teste.ts` (#78, 10 `describe`) — prova a regra em largura

Os `describe` são nomeados literalmente com o item do DoD e a RN — a âncora que este MANUAL e a
[MC-06](../especificacoes/MC-06-lastro.md) usam para citar. Em ordem no arquivo: RN-27 dinâmico
(`:200`, a reserva **recebe** dinheiro depois e o lastro não se move), RN-28 quebrado (`:220`),
RN-29 com empate exato entre quatro categorias (`:235`), RN-30 (`:280`), RN-31/§5.5 com receita
desbloqueando sem mexer em teto (`:310`), RN-32 com vencedor único (`:352`), §5.2/§5.4 no limite
exato do bloqueio (`:408`), §5.3 sem déficit em largura (`:456`), §5.6 guardar em meta (`:489`, ver
a seção seguinte) e a cascata do resíduo em largura — empate de duas categorias **e** uma categoria
de disponível **zero** no meio do laço (`:545`).

## "Guardar em meta" provado sem EF-07

`Meta` não é entidade: `api/src/db/schema.ts` não declara nenhuma tabela `metas` — a lista completa
de `pgTable(...)` do arquivo vai de `familias` a `faturas`, sem `metas`. A tarefa #78 provou o
efeito de RN-27 com o que já existe: uma `TRANSFERENCIA` (`schema.ts:67-71`, o enum
`tipoLancamento` já tem o valor) de `DEBITO` para `RESERVA` reduz o caixa real exatamente pelo valor
guardado, sem tocar `tetoCentavos`/`gastoCentavos` de categoria nenhuma (regra inviolável nº 3,
"transferência não é despesa") — e pode **criar** bloqueio que não existia antes, porque o dinheiro
passou a estar comprometido de verdade. Provado em `api/testes/lastro-rateio.teste.ts:489-535`.
Quando a [EF-07](../especificacoes/EF-07-metas.md) formalizar `Meta` como entidade própria, RN-35
daquela EF é a mesma RN-27 por outro nome.

## O que não foi portado do mockup

`cenarioSemLastro` (EF-06 §4) — a chave que o protótipo usa para forçar o déficit a 55% na
demonstração. Não é regra, é conveniência de apresentação; não tem equivalente no código real.

## Costura reportada, não implementada nesta história (fora de escopo de pasta)

- O texto do aviso na home é o único ponto de UI da EF-06 — a `home` (EF-04) já existia; esta
  história só adicionou os elementos do lastro a ela, sem reescrever o resto da tela.
- `EF06-MC-004` (MC-06) — falta política para travar `DESPESA` além do `limiteCentavos` do cartão;
  é essa lacuna, de outro módulo, que permite `lastroCentavos` chegar negativo na prática.

## Prova rodada (evidência)

Re-executada pelo condutor, independente do relato dos agentes, em toda tarefa desta história —
carimbo citado no próprio commit de merge:

1. **#76** (backend, módulo — com retrabalho interno): `f2b67aa`. "Gate: PROVA_DE_COMPORTAMENTO=PASS
   (214 testes). Revisao: APROVADO em `1b81f1f` (reprovada em `3aa59b1`, retrabalhada)".
2. **#77** (home): `fccec4b`. "Gate: PROVA_DE_COMPORTAMENTO=PASS (214 testes, navegacao 10/0).
   Revisao: APROVADO em `2899ac8`".
3. **#78** (qa — os dez casos do DoD): `7d9f35d`. "Gate: PROVA_DE_COMPORTAMENTO=PASS (224 testes).
   Revisao: APROVADO em `84e5547` (valores esperados reconferidos a mao contra a spec)".
4. **#79** (docs — esta tarefa): commit ainda sem hash no momento em que este texto foi escrito —
   nenhuma tarefa consegue citar o hash do próprio merge antes de ele existir. Confira com
   `git log --oneline f2b67aa^..HEAD`.

Esta tarefa (#79), de documentação, não toca `api/`/`web/`/`.preator/skills/` e portanto não altera
nenhum dos números de gate acima — são evidência **por tarefa**, herdadas, não recarimbadas. O
carimbo de NÍVEL-HISTÓRIA que fecha o DoD da #20 é aplicado por `carimbar-issue.sh 20`
(`preator/esteira/motor/issues/carimbar-issue.sh`), na branch da história, depois da revisão de
costura sobre a árvore integrada inteira — não executado ainda no momento em que este texto foi
escrito.

**O que o `PASS` NÃO cobriu, medido — não afirmado:** o gate de navegação abre a rota `/`
(`web/app/config/navegacao.ts:62`), mas não força um cenário com `deficitCentavos > 0` — a faixa de
aviso, a barra hachurada e o rótulo `parcial` foram lidos no código, nunca vistos rodando pelo
crawler. Mesma classe de limitação já registrada em MC-04 e MC-05 (seed sem o cenário).

## O que ainda não é desta EF

**Uma trava de `DESPESA` além do `limiteCentavos` do cartão** não existe em nenhum módulo — é essa
lacuna, e não o rateio do lastro, que permite `lastroCentavos` chegar negativo na prática hoje. É de
outra EF. A **formalização de "meta" como entidade** é da [EF-07](../especificacoes/EF-07-metas.md)
— esta história só provou o efeito no lastro com o vocabulário que já existe (`TRANSFERENCIA`). O
**risco teórico de overflow de `Number`** em `disponível × déficit`
(`api/src/modulos/lastro/servico.ts:199`) no limite de 32 bits é pré-existente ao lastro (o mesmo
teto que [D-06](../decisoes/D-06-dinheiro-em-centavos.md) já documenta) e não foi criado nem
resolvido por esta história.

## Achado de fan-out, fora de escopo desta EF e desta MC (registrado por completude)

`preator-perfil.sh:92-99` fixa o projeto de compose de teste (`-p orcamento-teste`) e as portas
`3010`/`3011` para o gate mestre — dois gates simultâneos disputando o mesmo projeto/portas colidem.
Isto **aconteceu duas vezes** nesta história: um FAIL falso no gate do revisor da tarefa #77
(diagnosticado por `curl` contra a porta errada) e, mais grave, um FAIL falso no gate do revisor da
tarefa #78 que **sobrescreveu o carimbo de máquina** de uma tarefa correta — sem uma re-execução
isolada depois, essa tarefa não teria mesclado. Isolado (um gate por vez), tudo passa. O conserto
real é o projeto compose e as portas derivarem do worktree, não ficarem fixos no perfil — é mudança
de perfil/fábrica, não desta história. Não registrado em arquivo por esta tarefa (fora do escopo de
`docs/especificacoes` e `docs/manual`); proposto como fork ao humano no relato desta tarefa (#79).
