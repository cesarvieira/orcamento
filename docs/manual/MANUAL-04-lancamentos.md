# MANUAL as-built — EF-04 Lançamentos

> O que foi **construído**, não o que a EF previu. Nasce na implantação; é a base para entender o
> módulo sem ler o código. Ver [EF-04](../especificacoes/EF-04-lancamentos.md) (o contrato) e
> [MC-04](../especificacoes/MC-04-lancamentos.md) (o que falta).

- **Identificação:** Lançamentos · EF-04 · história [#18](https://github.com/cesarvieira/orcamento/issues/18)
  · tarefas que **construíram o módulo** — o que este manual documenta:
  [#51](https://github.com/cesarvieira/orcamento/issues/51) (skill de negócio),
  [#52](https://github.com/cesarvieira/orcamento/issues/52) (módulo de lançamentos, dados,
  parcelamento, 5 selos `@fundacao`),
  [#60](https://github.com/cesarvieira/orcamento/issues/60) (contrato divergente — **não
  planejada**), [#62](https://github.com/cesarvieira/orcamento/issues/62) (total da série na
  leitura — **não planejada**), [#53](https://github.com/cesarvieira/orcamento/issues/53) (folha e
  modal), [#54](https://github.com/cesarvieira/orcamento/issues/54) (Visão do mês e Extrato),
  [#64](https://github.com/cesarvieira/orcamento/issues/64) (prova de propagação em tempo real
  entre dois clientes da mesma família — **não planejada**)
- **Tarefas de documentação** que mantiveram este manual, a `MC-04` e a `EF-04` §5 fiéis ao
  código — não constroem produto, por isso ficam fora da lista acima:
  [#55](https://github.com/cesarvieira/orcamento/issues/55),
  [#65](https://github.com/cesarvieira/orcamento/issues/65),
  [#66](https://github.com/cesarvieira/orcamento/issues/66),
  [#67](https://github.com/cesarvieira/orcamento/issues/67) (esta tarefa).
  **Lista viva de toda tarefa mesclada nesta história, na ordem real — a fonte que não envelhece:**
  `git log --oneline --first-parent main..historia/18-ef-04-lancamentos`
- **Construído por:** agente `docs` (#51); agente `backend`, esforço alto (#52, #60, #62); agente
  `frontend`, esforço alto (#53, #54); agente `qa` (#64) — todos `claude-sonnet-5`
- **Data:** 2026-08-27 (#51, #52) e 2026-08-28 (#60, #62, #53, #54, #64)
- **Commits e merges (na ordem do DAG real — só as tarefas de construção listadas acima; a lista
  completa de merges, incluindo as de documentação, é o comando `git log` acima):**
  - #51 — `045154e` mesclado em `708b068`
  - #52 — `56dc794` (módulo) + `eb53184` (RN-06, 4º selo) + `46593ba` (limpeza de knip) mesclados
    em `c771b1b`
  - #60 — `2d90d8e` (parâmetros + gate geral) + `387240a` (limites declarados + R1 na query)
    mesclados em `fb1c131`
  - #62 — `f859153` mesclado em `675bfe5`
  - #53 — `31e8669` (folha + modal) + `46edf89` (importa o contrato tipado da #60) + `6cc8d16`
    (usa `quantidadeParcelas` da #62) mesclados em `fdb9f6f`
  - #54 — `7f4e44f` mesclado em `e647bfa`
  - #64 — `6bc1238` mesclado em `ddd0239`
- **Confiança:** Alta (arquivos de teste e código lido linha a linha pelo agente `docs`, mais os
  laudos de revisão de diff de cada tarefa — incluindo duas rodadas em #52 e duas em #60 —, mais o
  gate re-executado pelo condutor a cada merge).

---

## O que o módulo faz, para quem usa

A família registra **lançamentos**: receita, despesa ou transferência. Toda despesa em categoria
consome o teto daquela categoria **na competência da data do lançamento** — mesmo retroativa, sem
mexer no mês corrente. Compra no crédito consome o teto na hora, mas **não** move o saldo da conta;
o saldo só se move quando a fatura é paga (isso é da EF-05 — aqui só a metade negativa existe: o
saldo fica parado). Transferência (pagar fatura, guardar em meta) nunca conta como gasto de
categoria nenhuma.

Uma compra pode ser parcelada em até 48×, sem juros: o app gera **um lançamento por parcela**, um
por competência subsequente, com o resíduo do arredondamento sempre na última parcela — a soma
fecha exatamente com o total, sempre.

A **Visão do mês** (`/`) mostra recebido, planejado e não alocado (os mesmos números que
`/orcamento` já calculava, agora com dado real por trás) mais a lista de categorias com barra de
gasto. O **Extrato** (`/extrato`) lista os lançamentos agrupados por dia, com filtro por conta;
tocar um lançamento abre o modal de detalhe, que mostra quem lançou, e — se o lançamento pertence a
uma série parcelada — pergunta o alcance da exclusão.

## Skill de negócio — `.preator/skills/negocio/lancamentos-e-parcelamento/` (#51)

Aprovada na 3ª rodada de revisão (as duas primeiras reprovadas por escopo/costura, não por
conteúdo de negócio — ver histórico da issue #51). Cobre RN-15 a RN-22 e RN-39, distingue
explicitamente o parcelamento **sem juros** deste produto (divisão inteira em N, resíduo na
última) da tabela de amortização com juros da skill agnóstica da fábrica
(`preator/conhecimento/negocio/financeiro/credito`) — a fonte do resíduo é reaproveitada, a tabela
Price/SAC/CET não. Fecha os dois forks da EF-04 §6 como **decididos**, não como abertos: exclusão
de parcela pergunta o alcance; RN-22 fica com selo `@fundacao` apontando a EF-08.

## Backend — `api/src/modulos/lancamentos/` (#52, #60, #62)

### Dados

- **`lancamentos`** (`api/src/db/schema.ts:517-568`, migration `api/drizzle/0006_massive_eternals.sql`):
  `tipo` explícito (`RECEITA`/`DESPESA`/`TRANSFERENCIA`, não sinal — EF-04 §1 marca isso como
  divergência deliberada do mockup), `data` e `competencia` **colunas distintas** (a segunda
  calculada na escrita, RN-15/RN-18), `categoriaId` obrigatório só em `DESPESA`, `contaDestinoId`
  só em `TRANSFERENCIA`, `criadoPorMembroId` **imutável** (RN-16), `serieParcelaId` +
  `numeroParcela` nulos fora de parcelamento.
- **`series_parcelas`** (`schema.ts:476-494`): `totalCentavos` + `quantidade` — a **compra
  original**. CHECK `quantidade between 2 and 48` no próprio banco (RN-20).
- **CHECKs de defesa em profundidade** (mesmo padrão de `contas.teste.ts`): `categoriaId` só fora
  de `DESPESA` recusado, `contaDestinoId` só fora de `TRANSFERENCIA` recusado, `contaDestinoId ==
contaId` recusado — testados em `api/testes/lancamentos.teste.ts:706-758`.

### Regras

- **RN-15** (retroativo): a competência gravada é a do mês da **data**, nunca a de "hoje" — testado
  gravando em janeiro (`lancamentos.teste.ts:301-317`) e confirmando que um retroativo de
  fevereiro não move o gasto de agosto, o mês corrente (`:319-352`).
- **RN-16** (autor imutável): `criadoPorMembroId` vem de `membroDaRequisicao(req)`
  (`rotas.ts:111`), nunca do corpo — mesmo tentando forjar, o valor gravado é o da sessão
  (`lancamentos.teste.ts:112-127`). Não existe rota de edição: o único jeito de mudar um
  lançamento é excluir e recriar (`:129-148`, `PATCH` cai no 404 do Express).
- **RN-17** (transferência não é despesa): `TRANSFERENCIA` sempre nasce com `categoriaId` nulo
  (`:152-168`) e não move `gastoCentavos` de categoria nenhuma na leitura da competência
  (`:170-195`). Fork 3/#52 — decisão do condutor durante a #52: `contaId == contaDestinoId`
  responde `400` (validação de entrada), não `422` (`:197-209`, `rotas.ts:97-108`).
- **RN-18/RN-19** (crédito × débito): compra numa conta `CREDITO` consome o teto na data da compra
  (`:238-259`) mas mantém o saldo derivado em `0` (`:213-236`) — `contas/servico.ts:73`,
  `case when tipo = 'CREDITO' then 0 else (...) end`. Numa conta `DEBITO`, `RECEITA`/`DESPESA`
  movem o saldo com sinal, e `TRANSFERENCIA` move as duas pontas (`:261-297`). **Só a metade
  negativa de RN-19 é desta EF** — quem move o saldo de fato (fatura paga) é a EF-05, que não
  existe. Ver `MC-04`, `EF04-MC-002`.
- **RN-20/RN-21** (parcelamento sem juros): até 48× (CHECK no banco + `422` acima disso,
  `:464-478`), um lançamento por competência subsequente com o **mesmo** `serieParcelaId`
  (`:377-397`), resíduo na última parcela — 100,00 em 3× vira `33,33 · 33,33 · 33,34`, soma
  exatamente `10000` centavos (`:356-374`, o teste que a DoD da EF-04 pede literalmente). Cada
  parcela consome o teto da **sua própria** competência (`:436-462`). `SerieParcelas` e as N linhas
  nascem na **mesma transação** (`DbOuTx`, `servico.ts:97-103`) — nunca uma série sem todas as suas
  parcelas.
- **RN-22** (competência selada): `competenciaEstaSelada` (`servico.ts:109-129`) é o ponto de
  checagem **nomeado**, chamado nos dois lugares de escrita (`servico.ts:221,258`). Hoje sempre
  devolve `false` — comentário acima da função deixa a query exata que a EF-08 vai colocar no
  lugar, mesmo padrão de `contas/servico.ts#contaPodeSerExcluida`. Testado que o guarda está no
  lugar e hoje sempre libera, inclusive retroativo (`:524-540`). **O caso positivo é
  `Pendente`, não `Concluído`** — ver `MC-04`, `EF04-MC-001`.
- **RN-39** (recebido da competência): soma só `RECEITA` da competência informada, ignora
  `DESPESA` na mesma competência e `RECEITA` em outra (`:482-520`). Consumida por
  `orcamento/servico.ts:178-195` (`recebidoDaCompetencia`).

### Fork — exclusão de parcela (EF-04 §6, decidido em 2026-08-27)

O alcance é escolhido pelo chamador via `DELETE /lancamentos/{id}?modo=esta|todas|a-partir-desta`:
`esta` remove só aquela linha (`:559-577`), `todas` remove a série inteira (`:636-649`),
`a-partir-desta` remove esta e as de competência **posterior**, mantém as anteriores
(`:651-669`). Modo ausente equivale a `esta`; modo inválido responde `422` (`:683-695`); id
inexistente responde `404` (`:697-702`).

### Suposição declarada (condutor, #52 — consumida pela #62)

`series_parcelas.totalCentavos`/`quantidade` guardam a **compra original** e **não são
reescritos** por exclusão de parcela — mesmo motivo de `criadoPorMembroId` ser imutável. Provado
direto no banco: exclui uma parcela com `modo=esta`, relê a série, `totalCentavos`/`quantidade`
continuam os da criação (`:671-681`). RN-21 vale **na geração**, que é onde a EF-04 §2 a
especifica.

### O defeito que isso gerou, e o conserto (#62)

`GET /lancamentos` não expunha o total da série — só `numeroParcela`. A tela de detalhe precisava
de "Parcela N de M", e o caminho óbvio (contar as linhas irmãs vivas) **dava número errado**:
`modo=esta` não renumera as irmãs, então excluir a parcela 2 de uma compra em 3× deixava vivas as
parcelas 1 e 3 — contar dava 2, a tela diria "Parcela 3 de 2". A #62 expôs `quantidadeParcelas`
(de `series_parcelas.quantidade`, a compra original) na leitura de `Lancamento`, nulo fora de
série. Testado no caso que quebrava: 3×, exclui a parcela 2, a parcela 3 continua reportando `3` —
na listagem **e** no detalhe, sem divergência entre as duas leituras (`:579-634`).

### Contrato — o defeito que a #53 encontrou, e o conserto (#60)

A #52 deixou `GET /lancamentos` lendo `req.query.competencia`/`req.query.contaId` e
`DELETE /lancamentos/{id}` lendo `req.query.modo`, **nenhum declarado no OpenAPI** — o contrato
gerado dizia `query?: never` nas duas operações. Causa-raiz de **infra**, não descuido da #52:
`api/src/openapi/registro.ts` derivava parâmetro só de **caminho**; nenhuma rota do projeto
conseguia declarar query. Consequência já materializada: o front (#53) foi obrigado a redeclarar
`ModoDeExclusao` à mão, violando a regra inviolável nº 4 — até a #60 devolver o tipo gerado.

A #60 (i) estendeu `registro.ts` para aceitar parâmetro de query, (ii) declarou os três parâmetros
em `rotas.ts:153-172`, (iii) envolveu `EsquemaModoDeExclusao` com `registrarEsquema()` para o
contrato expor o **tipo** (`packages/contrato/src/index.ts:43`, `ModoDeExclusao`), e (iv) escreveu
um gate próprio (`api/testes/contrato.teste.ts:150-174`) que lê o **código-fonte** de toda rota
registrada e reprova se algum handler ler `req.query.X` sem `X` declarado — geral, não hardcoda os
três parâmetros do defeito original. O ponto cego que isso fechou: o gate `contrato` antigo
comparava o documento servido com o gerado, e os dois saíam do mesmo registro — mentiam juntos.

A #60 também estendeu a guarda de R1 (`familiaId` só do token) para parâmetros de **query**, não
só de caminho (`tenant.teste.ts:139-172`). Limite conhecido e não corrigido, herdado das duas
guardas pré-existentes: case-sensitive, e não cobre um parâmetro chamado só `familia` sem sufixo —
sem explorador hoje, virou a issue **#61**.

### Cinco selos `@fundacao` fechados (nomeavam a EF-04 desde EFs anteriores)

| Selo                                | Onde                        | O que virou                                                                                                      |
| ----------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `gastoCentavosAindaNaoExiste()`     | `orcamento/servico.ts`      | `expressaoGastoDerivado(competencia)` (`servico.ts:163-171`) — subselect real em `lancamentos`, `tipo='DESPESA'` |
| `recebidoCentavosAindaNaoExiste()`  | `orcamento/servico.ts`      | `recebidoDaCompetencia()` (`servico.ts:178-195`) — soma `tipo='RECEITA'` (RN-39)                                 |
| `termoDosLancamentosAindaNaoExiste` | `contas/servico.ts`         | `expressaoSaldoDerivado()` (`contas/servico.ts:54-77`) — soma com sinal por tipo, trava `CREDITO` em 0           |
| `contaPodeSerExcluida` (RN-06)      | `contas/servico.ts:197-204` | consulta real em `lancamentos` (`contaId` ou `contaDestinoId`)                                                   |
| `membroDaRequisicao`                | `http/middleware/tenant.ts` | consumido por `rotas.ts:111` para `criadoPorMembroId` (RN-16)                                                    |

Os comentários `@fundacao` de `dataDoFato`/`competencia` (`api/src/db/tipos.ts`) e o corpo da
função `membroDaRequisicao` também foram atualizados para deixar de mentir ("ninguém usa ainda") —
sem mudar uma linha de código executável, só o comentário (2ª rodada de revisão da #52).

### Rotas

`POST/GET /lancamentos`, `GET/DELETE /lancamentos/:id` (`api/src/modulos/lancamentos/rotas.ts`) —
todas atrás de `exigirSessao` + `familiaDaRequisicao(req)`. `POST` e `DELETE` chamam
`invalidarLancamentos` (`rotas.ts:134,275`) — os dois pontos de mutação, nenhum órfão.

### Tempo real

Emissão provada com um socket real: cria um lançamento, confere que o evento
`recurso.alterado` chega com `recurso:'lancamentos'` e a **competência** do lançamento
(`lancamentos.teste.ts:924-948`). Isolamento entre famílias com dois sockets reais, usando o
recurso `lancamentos`: família A recebe, família B não (`realtime.teste.ts:88-109`) — mas **não
há teste de dois clientes da MESMA família ambos recebendo** a mesma invalidação. Ver `MC-04`,
`EF04-MC-005`.

### Isolamento entre famílias

4 testes dedicados (`lancamentos.teste.ts:836-895`): não lista no extrato, não vê detalhe (404),
não exclui (404, dado intacto), não usa `contaId` de outra família para criar (404).

### Seed

**Nenhum.** `api/src/db/semear.ts:60` — `SEMEADORES_DE_MODULO = [semeadorDeContas,
semeadorDeOrcamento]` — não inclui `lancamentos`. A issue #52 proibiu explicitamente tocar
`semear.ts`, porque a DoD exigia o extrato **no estado vazio**. Consequência: o gate de navegação
sempre viu a home e o extrato sem lançamento nenhum — ver `MC-04`, `EF04-MC-003`.

### Testes

`api/testes/lancamentos.teste.ts`, **40 casos** — um bloco por RN, mais CHECKs de banco, validação
de corpo, 404, isolamento e tempo real. Soma aos testes de `contrato.teste.ts` (6, incluindo o gate
geral de #60), aos 2 novos de `tenant.teste.ts` (guarda de R1 na query) e a 1 novo em
`realtime.teste.ts` (dois clientes da mesma família, tarefa #64 — arquivo que já pertencia à base
pré-EF-04, por isso não entra nos "40 novos") para os **181 testes** que a suíte roda hoje. Número
literal, conferido de novo por esta tarefa (`node scripts/contar-testes.mjs`) — muda só se um
módulo ganhar ou perder teste, não com o passar de tarefas de documentação.

## Frontend — folha, modal, Visão do mês, Extrato (#53, #54)

### A folha de novo lançamento — `web/app/components/FolhaLancamento.vue` (597 linhas)

Componente **global**, montado uma vez em `layouts/default.vue`, aberto de qualquer tela via
`useFolhaLancamento().abrir()` (sem pré-seleção, do FAB/sidebar; com `{ categoriaId }`, do cartão
de categoria da home). Teclado de valor em centavos (`textoParaCentavos`/`formatarCentavos`,
`utils/dinheiro.ts` — nenhum `parseFloat` no módulo), seletor de tipo (RECEITA/DESPESA/
TRANSFERENCIA — **não existe no mockup**, construído contra a EF-04 §1), categoria, conta, conta de
destino (só em `TRANSFERENCIA`), data, parcelas (stepper 2..48, `parcelasMenos`/`parcelasMais`,
`FolhaLancamento.vue:216-221`) e atalhos — desenhados no mockup mas **inertes**: sem fonte para o
que são nem endpoint para persisti-los, tratados como "Foto do recibo"/"Importar extrato" (visível,
com aviso, sem dado inventado). `dataHint` nunca mostra valor por parcela — a divisão de RN-20/RN-21
é sempre do servidor.

### O modal de detalhe — `web/app/components/ModalDetalheLancamento.vue` (239 linhas)

Componente global, aberto via `useDetalheLancamento().abrir(lancamento)` de qualquer tela que já
tenha o `Lancamento` em mãos (hoje, só o Extrato). Mostra descrição, valor, categoria, conta, data,
**quem lançou** (nome do membro), e "Parcela N de M" quando há série — `M` vem direto de
`quantidadeParcelas` (contrato, #62), sem chamada extra e sem recontagem.

**A caixa de exclusão de parcela é decisão do humano, não desenho do mockup.** No protótipo,
"Excluir" é um botão só que apaga direto — coerente com o mockup, onde compra parcelada gerava um
lançamento só (EF-04 §4). O humano fechou o fork em 2026-08-27 (issue #53, "Forks"): quando o
lançamento pertence a uma série, o detalhe **pergunta** o alcance — `esta` · `todas` · `a partir
desta` — numa caixa construída no vocabulário visual das outras folhas do app (pílulas, cor sólida
para "seguem-se as outras", contorno vermelho para a mais destrutiva). Para um lançamento avulso
(sem série), "Excluir" continua batendo com o desenho: apaga direto, sem perguntar. Declarado em
comentário no topo do arquivo (`ModalDetalheLancamento.vue:12-34`), incluindo a história do bug
anterior (contar irmãs vivas dava "Parcela 3 de 2") que a versão atual corrige.

### Composable — `web/app/composables/useLancamentos.ts` (225 linhas)

Único ponto de acesso HTTP a `lancamentos`: `listarLancamentos`, `buscarLancamento`,
`criarLancamento`, `excluirLancamento` (modo padrão `'esta'`), mais `useFolhaLancamento()` e
`useDetalheLancamento()` — o estado compartilhado (`useState`, seguro em SSR) que abre a folha e o
modal de qualquer tela sem remontá-los. Todos os tipos vêm de `@orcamento/contrato` — zero
`interface`/`type` redeclarando o modelo do back (`ModoDeExclusao` importado do contrato gerado,
não mais redeclarado à mão como na entrega original da #53, corrigido depois da #60).

### Visão do mês — `web/app/pages/index.vue` (248 linhas, a tela `home` do mockup)

Cabeçalho com `recebidoCentavos`/`planejadoCentavos`/`naoAlocadoCentavos` — todos **derivados pelo
servidor**, lidos de `CompetenciaLida`, nunca recalculados. Lista de categorias com barra de gasto
(`larguraBarra`, só a faixa gasta) e, por categoria com `disponivelCentavos < 0`, o **cartão de
estouro** — cópia literal do que `orcamento.vue` já tinha (mesmo texto, mesma condição); o botão
"Remanejar" navega para `/orcamento` (onde a folha de remanejar de verdade já existe) em vez de
abrir um segundo caminho, porque `sheetRemanejar` é ~150 linhas de estado que não são desta tarefa.

**Duas divergências do mockup, declaradas em comentário (`index.vue:2-52`) e verificadas contra a
fonte fechada na revisão de diff:** o número dominante do cartão-herói no protótipo é o **lastro**
(EF-06/#20, não construída — `CompetenciaLida` não tem esse campo); a tela usa `planejadoCentavos`
no lugar, com rótulo trocado. A faixa de bloqueio/hachura da barra também depende do lastro e foi
**omitida, não simulada** — só a faixa gasta é desenhada.

### Extrato — `web/app/pages/extrato.vue` (323 linhas)

Agrupa por dia, filtra por conta, abre o modal de detalhe ao tocar um lançamento. **Dois textos de
vazio, um com fonte e um sem:** o vazio **🟦 "por filtro/mês"** (tem lançamento em outro mês/conta,
não neste filtro) é do mockup; o vazio **🟨 "família sem histórico"** (zero lançamentos, ponto) é
texto próprio, sem fonte no desenho — a distinção existe porque `verificarSeFamiliaTemHistorico()`
(`extrato.vue:112-120`) faz uma segunda leitura sem filtro só quando a primeira vem vazia. Como o
seed não tem lançamento nenhum (ver Backend acima), **na prática só o vazio 🟨 aparece hoje** —
inclusive no gate de navegação.

### Costura com o layout (fork #52, resolvido pela #53)

`layouts/default.vue:50` tinha `rotaDeLancamento = '/extrato'`, com comentário "é da EF-04.
Enquanto ela não existe, o shell leva para o extrato". A #53 resolveu o selo: o FAB central
(mobile) e "Novo lançamento" (sidebar) passaram de `<NuxtLink>` (`<a>`) para `<button>` que chama
`abrirNovoLancamento()`, abrindo a folha direto — a rota de contorno foi removida. Consequência
declarada: os dois elementos ganharam reset de borda/padding em `default.scss` (mesmo reset que
`.sidebar__sair` já usava).

## O que a EF-00/EF-01/EF-02/EF-03 já tinham deixado pronto (não foi refeito)

`emitirInvalidacao`, o middleware de tenant (`familiaDaRequisicao`, `membroDaRequisicao`),
`registrarRota`, `SEMEADORES_DE_MODULO`, `useRealtime()` no front, o padrão de tela
(`layouts/default.vue`, `assets/scss/pages/`), e as duas fórmulas de `orcamento` (`disponível =
teto − gasto`, `não alocado = recebido − planejado`) que só esperavam o dado real desta EF.

## O que não é desta EF

A **fatura do cartão** — e a metade positiva de RN-19 (o saldo se mover quando ela é paga) — é da
[EF-05](../especificacoes/EF-05-faturas.md) (#19). O **lastro**, o número dominante da home no
mockup e a faixa de bloqueio da barra são da [EF-06](../especificacoes/EF-06-lastro.md) (#20). A
tabela `fechamentos_mes` que dá corpo ao caso positivo de RN-22 é da
[EF-08](../especificacoes/EF-08-fechamento.md) (#22).

## Prova rodada (evidência)

Re-executada pelo condutor, independente do relato dos agentes, nas tarefas #51 a #55 — todas
`PROVA_DE_COMPORTAMENTO=PASS`, 8/8 gates, `fails=0`, `skips_bloqueantes=0`. Das #64 em diante, o
diff é só texto/teste isolado e o revisor aceitou o carimbo já em disco em vez de reexecutar
`gate-motor.sh`, para não colidir com outro gate em curso nas mesmas portas 3010/3011 — declarado
em cada item abaixo:

1. **#51** (skill): `708b068`. 3 rodadas de revisão de diff (2 reprovadas por citação sem fonte
   sustentando — ver histórico da issue), 3ª aprovada.
2. **#52** (backend, módulo): `c771b1b`. 2 rodadas de revisão (1ª reprovada por escopo — costura
   estendida pelo condutor; 2ª aprovada). 174 testes.
3. **#60** (contrato divergente, não planejada): `fb1c131`. 2 rodadas (1ª reprovada por escopo;
   2ª aprovada). 177 testes.
4. **#62** (quantidadeParcelas, não planejada): `675bfe5`. 1 rodada, aprovada sem retrabalho. 180
   testes.
5. **#53** (folha + modal): `fdb9f6f`. 1 rodada, aprovada sem 🔴 (1 🟡 conhecido e não corrigido de
   propósito: citação de skill ausente num ponto de uso correto).
6. **#54** (Visão do mês + Extrato): `e647bfa`. 1 rodada, aprovada sem 🔴. 10 rotas navegadas, 0
   quebradas.
7. **#55** (docs — cria MC-04/MANUAL-04, ajusta DoD/forks da EF-04): `7e8f9c6`. 1 rodada, aprovada
   (revisor abriu 13 das 21 linhas da matriz, todas as citações bateram); 1 🔵 ainda não corrigido
   (contagem de linhas dos dois componentes errada por um — este manual e a MC-04 dizem 597/239,
   o real é 596/238 — fora do escopo desta tarefa, que é só a contagem de tarefas/testes). Achou a
   lacuna que abriu a #64.
8. **#64** (qa — prova de propagação em tempo real entre dois clientes da mesma família, não
   planejada): `ddd0239`. Carimbo herdado (revisor não reexecutou o gate). 1 rodada, aprovada sem
   🔴 (1 🔵 endereçado à issue #63: os testes do arquivo chamam `emitirInvalidacao()` direto, não
   por mutação HTTP amarrada a um socket). Vermelho→verde provado sabotando o teste (trocada a
   família da segunda sessão, a asserção falhou). 181 testes.
9. **#65** (docs — atualiza MC-04/DoD após a prova da #64): `51dd0ce`. Carimbo herdado (mesmo
   motivo). 1 rodada, aprovada sem achado; o revisor varreu os dois documentos inteiros com grep
   amplo e confirmou zero negação velha remanescente nos seis lugares corrigidos, com RN-19/RN-22
   byte-idênticas (`word-diff`).
10. **#66** (docs — corrige a contagem de tarefas/testes na EF-04/MC-04): `f866dc0`. Carimbo
    herdado (mesmo motivo — diff só texto, nada que os gates medem muda). 1 rodada, aprovada; o
    revisor recontou os números de forma independente (`git log`, `contar-testes.mjs`) e achou um
    erro a mais no relato original ("duas" tarefas fora da decomposição — eram quatro: #60, #62,
    #64, #65).
11. **#67** (docs — fecha a tríade e a recursão da contagem, esta tarefa): commit ainda sem hash
    no momento em que este texto foi escrito — nenhuma tarefa consegue citar o hash do próprio
    merge antes de ele existir. Confira com `git log --oneline --first-parent
main..historia/18-ef-04-lancamentos`.

```
build        PASS  (bloqueante)
test(N>0)    PASS  (bloqueante) — 181 testes executados, 0 falhando
front        PASS  (bloqueante)
typecheck    PASS
lint         PASS
deadcode     PASS
contrato     PASS  (bloqueante)
navegacao    PASS  (bloqueante) — 10 rotas abertas, 0 quebradas
PROVA_DE_COMPORTAMENTO=PASS
```

Bloco acima re-executado pelo revisor da costura sobre a árvore integrada em `51dd0ce` (9 merges
de tarefa até esse ponto) — não uma soma dos carimbos individuais. As tarefas de documentação
seguintes (#66 e #67, esta) não tocam código nem teste, então nenhum destes oito números muda por
causa delas; a contagem de testes acima já reflete o teste que a #64 acrescentou (181, não 180).

**O que o `PASS` NÃO cobriu, medido — não afirmado:** a família semeada não tem lançamentos
(`api/src/db/semear.ts:60`), então o gate de navegação exercitou o extrato no vazio 🟨 "sem
histórico", nunca no vazio 🟦 do mockup, e o cartão de estouro/"Remanejar" da home nunca renderizou.
A folha (`FolhaLancamento.vue`) e o modal (`ModalDetalheLancamento.vue`) ficam atrás do FAB e de um
clique no extrato — o crawler do gate abre **rotas**, não esses cliques — e por isso **não foram
exercitados por máquina nenhuma**: layout real, scroll com teclado aberto, z-index de dropdowns e
o fechamento por clique-fora foram lidos, não vistos rodando. Ver `MC-04`, `EF04-MC-003` e
`EF04-MC-004`.

## O que não foi portado do mockup

Receita como valor negativo (EF-04 §1/§4 — vira tipo explícito). Transferência não existia no
protótipo (§4 — vira tipo próprio, RN-17). Parcelamento gerava um lançamento só (§4 — vira N
lançamentos, RN-20/RN-21) — e é exatamente essa mudança que criou o fork da caixa de exclusão
(ver Frontend acima). Os atalhos de lançamento rápido são desenhados mas inertes (sem fonte, sem
endpoint). O range fixo de data do protótipo (`min="2026-06-01" max="2026-08-20"`) não foi copiado.
`support.js` (runtime do dc-runtime) segue não portado, já registrado desde a EF-00.

## O que ainda não é desta EF

O caso positivo de RN-22 (competência de fato selada) depende da [EF-08](../especificacoes/EF-08-fechamento.md)
(#22). A metade positiva de RN-19 (saldo se mover com fatura paga) depende da
[EF-05](../especificacoes/EF-05-faturas.md) (#19). O número de lastro e a faixa de bloqueio da home
dependem da [EF-06](../especificacoes/EF-06-lastro.md) (#20). Nenhuma das três existe ainda.
