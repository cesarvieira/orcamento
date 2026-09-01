# MANUAL as-built — EF-02 Contas

> O que foi **construído**, não o que a EF previu. Nasce na implantação; é a base para entender o
> módulo sem ler o código. Ver [EF-02](../especificacoes/EF-02-contas.md) (o contrato) e
> [MC-02](../especificacoes/MC-02-contas.md) (o que falta).

- **Identificação:** Contas · EF-02 · história [#16](https://github.com/cesarvieira/orcamento/issues/16) · tarefas [#37](https://github.com/cesarvieira/orcamento/issues/37) (skill de negócio), [#38](https://github.com/cesarvieira/orcamento/issues/38) (renomeação `/contas`→`/cadastros`), [#39](https://github.com/cesarvieira/orcamento/issues/39) (backend), [#40](https://github.com/cesarvieira/orcamento/issues/40) (frontend)
- **Construído por:** agente `docs` (retrabalho de tier subido a Sonnet 5, #37); agentes `backend` e `frontend` (Sonnet 5, tier padrão, esforço alto — #38/#39/#40)
- **Data:** 2026-08-26 · **Commits:** `04050f7`→`4fd192b` mesclado em `81222c7` (#37); `14beb2f` (#38); `a362050` (#39); `a684800` (#40)
- **Confiança:** Alta (código + gate re-executado pelo condutor, independente do relato dos agentes)

---

## Skill de negócio — `.preator/skills/negocio/contas-e-lastro/` (#37)

A primeira tentativa (`04050f7`) foi **reprovada pelo condutor**: relatava "zero regra sem origem"
mas continha 11 afirmações inventadas (saldo inicial imutável, mecânica de fatura que é da EF-05,
mensagem de erro literal apresentada como regra, sinônimo inventado no glossário, data de decisão
inventada) e um erro aritmético no rateio do lastro com uma categoria. O retrabalho (`4fd192b`),
com o tier subido para `claude-sonnet-5`, fechou os 11 e **achou um 12º por conta própria** (o piso
de `limiteLivre` em zero, sem fonte). O que sobrou do 12º defeito virou o fork registrado abaixo
(`EF02-MC-002`) — não bloqueia esta EF, mas precisa de dono humano antes da EF-06.

## Backend — `api/src/modulos/contas` (#39)

- **Schema** (`api/src/db/schema.ts`): tabela `contas` com `tipo` como **enum de string**
  (`tipoConta`), nunca inteiro — enum inteiro serializa como número e reprova o gate de contrato.
  Quatro `CHECK` impõem no próprio banco, além do Zod na borda:
  - `contas_dia_fechamento_intervalo` / `contas_dia_vencimento_intervalo` — RN-08, faixa 1–28
    quando o campo não é nulo.
  - `contas_campos_de_credito_apenas_em_credito` — `limiteCentavos`, `diaFechamento` e
    `diaVencimento` só existem quando `tipo = 'CREDITO'`.
  - `contas_saldo_inicial_nao_em_credito` — `saldoInicialCentavos` nunca existe em `CREDITO`.
- **Saldo derivado** (`servico.ts`, `expressaoSaldoDerivado()`): **não é coluna** — é
  `coalesce(saldoInicialCentavos, 0) + termoDosLancamentos`, com o termo dos lançamentos **fixo em
  `0`** hoje (comentado `@fundacao`) porque a tabela `lancamentos` é da EF-04. A expressão já está
  montada como soma, exatamente para a EF-04 trocar só esse termo por um subselect sem reescrever a
  leitura inteira.
- **RN-07** (`totalEmContaHoje()`): filtra `tipo !== 'RESERVA'` antes de somar. O código documenta
  explicitamente que isto **não** é o `caixaReal` da EF-06 (que usa `max(0, …)` e só em débito) —
  são conceitos distintos, e o comentário evita a confusão em vez de cair nela.
- **RN-06** (`contaPodeSerExcluida()`): ponto de checagem nomeado, com a assinatura que a EF-04 vai
  manter. Hoje o corpo **sempre devolve `true`** — nenhuma conta tem lançamento, porque
  `lancamentos` não existe. `excluirConta()` já distingue os três resultados
  (`'excluida' | 'nao_encontrada' | 'tem_lancamentos'`), e a rota `DELETE /contas/:id` já mapeia
  `'tem_lancamentos'` para `409 { erro: 'conta_com_lancamentos', mensagem: '...' }`. **Este caminho
  nunca roda de verdade hoje** — ver `EF02-MC-001` na MC-02.
- **Rotas** (`rotas.ts`): `GET /contas`, `POST /contas`, `PATCH /contas/:id`, `DELETE /contas/:id`,
  todas atrás de `exigirSessao` + `familiaDaRequisicao(req)` (nunca `familiaId` do corpo/query/path
  — `registrarRota` recusa rota com `:familiaId` no caminho). O `PATCH` usa a **mesma forma inteira**
  do `POST` (`AtualizarConta` é o mesmo esquema Zod de `NovaConta`, não um `.partial()`) — decisão
  de desenho registrada em comentário: a EF-02 §3 descreve editar como reabrir o mesmo formulário
  preenchido e reenviar inteiro, e um `.partial()` cruzado com união discriminada por `tipo` seria
  ambiguidade que a especificação não cobre.
- **Contrato** (`esquemas.ts`): `NovaConta`/`AtualizarConta` são uma união discriminada por `tipo`
  (`DEBITO`/`RESERVA` pedem `saldoInicialCentavos`; `CREDITO` pede `limiteCentavos` + as duas datas,
  cada uma validada 1–28 pelo Zod). `Conta` (leitura) tem forma fixa com os campos que não se
  aplicam ao tipo vindo `null` — mais simples para o front do que redeclarar a união na leitura.
  `ContasListadas` embrulha `{ contas: Conta[], totalEmContaHojeCentavos }`.
- **Tempo real:** toda mutação (`POST`/`PATCH`/`DELETE`) chama `invalidarContas()` →
  `emitirInvalidacao({ familiaId, recurso: 'contas', origemClienteId })`, lendo
  `x-origem-cliente` do cabeçalho (R5 — descarte do próprio eco). Nenhum número viaja no evento
  (R3/D-04).
- **Seed** (`semear.ts`, registrado em `SEMEADORES_DE_MODULO`): três contas, uma de cada tipo —
  `Conta corrente` (DEBITO, saldo R$ 2.500,00), `Cartão de crédito` (CREDITO, limite R$ 5.000,00,
  fecha dia 20, vence dia 27), `Reserva de emergência` (RESERVA, R$ 10.000,00). Idempotente: não
  duplica se a família já tem contas.
- **Testes** (`api/testes/contas.teste.ts`, 19 casos — os 19 "novos" que somam aos 86 da base para
  os 105 do gate): um bloco por RN, mais isolamento entre
  famílias (leitura, edição, exclusão) e o CRUD básico. O teste de RN-06 é explícito sobre o que
  prova: _"hoje NUNCA existe lançamento (a tabela é da EF-04): a checagem sempre libera a
  exclusão"_ — descreve a limitação em vez de fingir cobertura do ramo 409.

### Escopo tocado além do declarado (aceito pelo condutor)

| Arquivo                                      | Por que é costura necessária                                                                                                                                                        |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api/src/openapi/emitir.ts` (+1 linha)       | o emissor do OpenAPI importa cada módulo à mão; sem isto o `BUILD_CMD` geraria o contrato sem as rotas de `contas`, quebrando D-03 em silêncio para quem construísse o front depois |
| `packages/contrato/src/index.ts` (+4 linhas) | exporta os tipos gerados, no padrão alfabético existente. `ContaCriada` (cadastro de usuário, EF-01) convive sem colidir com `Conta`/`NovaConta`/`ContasListadas` (financeira)      |

## Campo de valor digitável — divergência deliberada do mockup (2026-08-27)

A folha `sheetConta` do mockup tem **só o stepper** `−/+` para o valor, sem campo digitável.
Aqui o stepper continua (R$ 10 por clique, útil para ajustar um valor já perto do certo), mas o
número no meio virou **input**, por decisão do humano: com só o stepper, digitar R$ 1.234,56
custaria 124 cliques, e centavos seriam inalcançáveis.

É divergência **registrada**, não descuido — o mockup é fonte, e quem o sobrepõe é a pessoa que
decide o produto.

- O campo mantém a forma canônica da tela (`R$ 1.234,56`, via `formatarCentavos`), então
  visualmente ele continua sendo o número do desenho, não uma caixa de formulário.
- `textoParaCentavos()` aceita `1234,56`, `1.234,56`, `1234.56`, `1234` e ignora `R$`, espaço e
  qualquer outro lixo. A regra é uma só: **o último separador é o decimal, e só quando deixa
  duas casas ou menos** — caso contrário é separador de milhar.
- **Trunca em centavos, não arredonda.** Inventar meio centavo é a divergência que D-06 existe
  para impedir.
- ⚠️ **Sem teste automatizado** — ver `EF02-MC-007` na [MC-02](../especificacoes/MC-02-contas.md).
  A verificação manual pegou um bug real antes do commit: `1.000` era lido como R$ 1,00.

## Renomeação `/contas` → `/cadastros` (#38)

A EF-01 já tinha usado o caminho `POST /contas` para o **cadastro de usuário** (criar a família e o
dono). Com a EF-02 chegando e precisando de `/contas` para o **cadastro financeiro**, e o registro
de rota (`registrarRota`) recusando caminho duplicado, a tarefa #38 renomeou o cadastro de usuário:

- `POST /contas` → `POST /cadastros` e `POST /contas/confirmar` → `POST /cadastros/confirmar`, no
  handler (`api/src/modulos/familia/rotas.ts`) **e** no registro do contrato.
- **Só o caminho mudou.** Os esquemas do contrato (`CriarConta`, `ContaCriada`, `ConfirmarConta`) e
  o composable `web/app/composables/useConta.ts` (singular — cadastro de usuário) mantiveram os
  nomes: renomear o tipo público arrastaria o front inteiro sem necessidade, e o que colidia era o
  caminho da rota, não o nome do tipo.
- `web/app/config/navegacao.ts` e `web/app/pages/contas.vue` continuaram apontando para `/contas`
  como **rota de tela** do Nuxt — não são a rota da API, e não foram tocados por esta tarefa.
- Renomeação pura: a suíte passou com a **mesma contagem de antes** (56 testes), sem teste novo e
  sem teste removido.
- **A incoerência de enumeração de email (`EF01-MC-006` na MC-01) continua aberta** — mudou o nome
  da rota que revela `email_ja_cadastrado`, não a regra RN-07 nem a decisão do humano de não mexer
  nela nesta história. A MC-01 foi atualizada para citar `/cadastros` em vez de `/contas`.

## Frontend — `web/app/pages/contas.vue` + `web/app/composables/useContas.ts` (#40)

- **`useContas.ts`** (plural — não confundir com `useConta.ts`, singular, do cadastro de usuário):
  importa `AtualizarConta`, `Conta`, `ContasListadas`, `NovaConta` do contrato gerado
  (`@orcamento/contrato`), sem redeclarar o modelo (D-03 · R4). Expõe `listarContas`, `criarConta`,
  `atualizarConta`, `excluirConta` — `excluirConta` **nunca traduz** o erro 409 de RN-06: quem
  chama decide o que exibir, lendo a mensagem que a API devolveu.
- **`contas.vue`**: lista com saldo real por conta e o cartão "EM CONTA HOJE" no topo; folha de
  cadastro/edição na ordem do desenho (nome → tipo → valor → cartão: vencimento/fechamento → ícone).
  `valorLabel` alterna _Limite do cartão_ / _Saldo atual_ com o tipo (EF-02 §3). O bloco de
  vencimento/fechamento só é renderizado quando `tipo === 'CREDITO'`. **Não recalcula** nada — usa
  `saldoCentavos` e `totalEmContaHojeCentavos` exatamente como o servidor derivou; formata centavos
  → reais só na borda, no componente (D-06).
- **Tempo real:** `useRealtime({ recursos: ['contas'], aoInvalidar: carregar })`, mesmo padrão que
  a EF-01 já usa para convites.
- **RN-08** no cliente: `clampeDia()` trava o seletor de dia em `Math.min(28, Math.max(1, dia))` —
  redundante com a validação do servidor, mas evita a viagem de rede para um valor já sabido
  inválido.

### O fork da `cor` (F4) — resolvido reusando o dado real, não inventando paleta nova

A EF-02 §1 exige `cor` como campo da entidade, mas a folha `sheetConta` do mockup tem seletor de
**ícone** e nenhum seletor de **cor**. A tarefa #40 não inventou um seletor novo: `MAPA_COR_POR_TIPO`
(`useContas.ts`) deriva a cor do `tipo`, reusando **os mesmos valores** que o seed da #39 já grava
(`#2563eb` débito, `#dc2626` crédito, `#16a34a` reserva) — conferido pelo condutor, os dois arquivos
batem exatamente, sem uma segunda paleta para divergir depois. **Continua sendo fork para o
humano** se a família precisar _escolher_ a cor — a folha de categoria (`sheetEditCat`) tem uma
grade de cor como precedente, se a decisão for por aí. Ver `EF02-MC-003`.

### `diaFechamento`/`diaVencimento`: capturados, exibidos, ainda não consumidos por lógica de fatura

Isto é **deliberado**, não um campo morto esquecido (EF-02 §4: o mockup captura os dois e não usa
nenhum — a fatura dele soma o mês civil; aqui os dois existem para a EF-05 usar). A tela **exibe**
os valores na linha de apoio do cartão de crédito (`"Fecha dia 20 · vence dia 27"`, montada em
`subDaConta()`), mas nenhum cálculo de ciclo de fatura roda em lugar nenhum ainda — quem procurar
por essa lógica no módulo de contas não vai achar, porque ela não é deste módulo. Ver `EF02-MC-004`.

### _Ver fatura_ / _Pagar fatura_ — omitidos na #40, **construídos na história #74**

O mockup mostra os dois no item de cartão de crédito. A tarefa #40 os **omitiu** da tela (não
existiam no HTML renderizado) — são da EF-05, e diferente do que a EF-00 fez com "Google"/"Apple" em
`/entrar` (que ficaram visíveis e inertes, com "em breve"), a decisão de então foi não mostrar um
botão para uma tela que ainda não existia.

**Isso deixou de valer.** A tela `fatura` passou a existir na EF-05 (história #19), e a história
**#74** (tarefa #110) construiu as duas portas — ver a seção "As duas portas da fatura" logo abaixo.
O texto acima fica registrado porque explica **por que** houve um intervalo em que os botões não
existiam: não foi esquecimento, foi decisão datada.

## As duas portas da fatura e o `faturaAviso` — história #74, tarefa #110

**A origem é uma lacuna de escopo, não um defeito de execução.** A decomposição da história #19 não
encarregou ninguém de `contas.vue`, e a tarefa da tela de fatura (#71) foi explicitamente proibida
de tocá-lo — corretamente, porque duas tarefas na mesma pasta produzem implementações divergentes.
O buraco ficou **entre** as pastas, e foi a revisão de costura da #19 que o pegou.

O que entrou em `web/app/pages/contas.vue` (+ `web/app/assets/scss/pages/contas.scss`):

| Peça               | Comportamento                                                                                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **"Ver fatura"**   | navega para `/faturas?contaId=<id>` — a **porta 1**. Sem ela, só se chegava à fatura pelo _Mais_ (mobile) ou pela sidebar (desktop), e os dois caem no fallback "primeiro cartão" |
| **"Pagar fatura"** | paga **sem trocar de tela** — a **porta 4**. Perdê-la faria o produto exigir dois passos onde o desenho pede um                                                                   |
| **`faturaAviso`**  | 3ª linha do card "EM CONTA HOJE": _"Faturas de X ainda não debitadas"_ / _"Nenhuma fatura em aberto"_                                                                             |

Os dois botões só aparecem em conta `CREDITO` (`sc-if value="{{ a.ehCartao }}"` no mockup).

### As duas decisões humanas que o desenho não cobria (2026-08-31)

O desenho tem os botões, mas não resolve duas ambiguidades. As duas foram **escaladas como fork
antes de qualquer código ser escrito** — não decididas pelo agente:

- **F1 · a conta pagadora.** D3 (2026-08-28) já exigia que ela fosse **escolhida, nunca fixa**, mas
  a lista de contas não tem seletor. Decidido: "Pagar fatura" **sempre abre uma folha de
  confirmação** com o seletor de conta pagadora, reaproveitando o padrão de `faturas.vue`. ⛔ Não
  porta a armadilha do protótipo (`contaPagadora` fixa na primeira conta `DEBITO`,
  `Orcamento Familiar.dc.html:1004`), que a [EF-05 §4](../especificacoes/EF-05-faturas.md) nomeia.
  A folha é superfície que o desenho **não** tem — é decisão humana registrada, não invenção.
- **F2 · qual fatura o botão único paga.** D1/D2 admitem mais de uma fatura em aberto (a `FECHADA`
  aguardando pagamento **mais** o ciclo `ABERTA` corrente). Decidido: paga a **`FECHADA` mais
  antiga**; com **2+ `FECHADA`s** navega para `/faturas?contaId=`, onde cada bloco tem seu próprio
  botão; **sem nenhuma `FECHADA`** mostra _"Não há fatura em aberto nesse cartão."_ — a frase do
  próprio desenho, idêntica à do 409 `fatura_sem_valor` — **sem** disparar o POST. Mesmo critério
  que `faturas.vue#faturaParaBotaoNoCabecalho` já aplicava.

**Só fatura `FECHADA` é pagável** — o ciclo `ABERTA` só acumula. Isso não foi suposto: está em
`faturas.vue#blocos` (campo `temBotao`), e foi conferido no código antes de virar sinal da tarefa.

### O `faturaAviso` não abriu endpoint novo

No protótipo o aviso soma `a.faturaConta` de cada cartão. Aqui o valor **já chega derivado do
servidor**: o `saldoCentavos` de uma conta `CREDITO` é `−Σ(fatura em aberto, D1)`
(`api/src/modulos/contas/servico.ts#expressaoSaldoDerivado`). A tela **soma o que já tem em mão e
formata** — não recalcula regra de lastro (regra inviolável #4) e não chama `GET /faturas` por
cartão só para montar o aviso. A revisão de costura conferiu essa matemática contra a expressão do
servidor, em vez de aceitar o comentário do código.

### A nota de RN-07 sobreviveu

O desenho tem **uma** linha nessa posição (`faturaAviso`); o código tinha **outra** (_"Não inclui as
contas reserva."_, acréscimo da #40 para tornar RN-07 visível à vista). Apagá-la seria regressão de
algo que a EF-02 provou. As duas convivem: o aviso de fatura na posição do desenho, a nota de RN-07
abaixo, em `.contas__resumo-nota`.

### A fonte de desenho — como quase se perdeu

A issue da história apontava um recorte de desenho que **não existia mais**: era anotação
não-versionada do condutor da #19, apagada pelo `limpar-sessao.sh`. O MCP do Claude Design também
falhou a conectar na sessão. Isso teria virado fork — mas **o mockup está versionado** em
`docs/mockup/project/` desde `349dd62`, e o recorte foi reextraído de lá. Fica registrado porque é
o antídoto de um defeito medido na própria #19: recorte incompleto faz o agente inventar com
convicção, contra um texto que afirma que "o desenho não define".

## O que a EF-00/EF-01 já tinham deixado pronto (não foi refeito)

`emitirInvalidacao`, o middleware de tenant (`familiaDaRequisicao`), `registrarRota` (recusa de
`:familiaId` no caminho), `SEMEADORES_DE_MODULO`, `useRealtime()` no front, e o padrão de tela
(`layouts/default.vue`, `assets/scss/pages/`) que `mais/convidar.vue` e `entrar.vue` já usavam.

## Verificação visual do condutor (tarefa #40), com o stack de produção de pé e dado do seed

```
EM CONTA HOJE           R$  2.500,00     ← "Não inclui as contas reserva."
Conta corrente          R$  2.500,00
Cartão de crédito       R$      0,00     ← "Fecha dia 20 · vence dia 27"
Reserva de emergência   R$ 10.000,00     ← "Fora do orçamento"
```

**RN-07 provada à vista:** o total é `2.500 + 0` (débito + crédito), e os `10.000` da reserva ficam
de fora — a tela ainda diz isso em texto ("Não inclui as contas reserva."), em vez de deixar a
família descobrir sozinha. A folha responde ao tipo como a EF-02 §3 manda: débito mostra _Saldo
atual_ sem bloco de vencimento; crédito mostra _Limite do cartão_ com o bloco, vencimento antes de
fechamento, na legenda do mockup.

### Observação cosmética, sem gravidade

O card de débito lê **"Conta corrente / Conta corrente"** — o nome que o seed da #39 escolheu para
a conta `DEBITO` é igual ao texto fixo que a linha de apoio mostra para esse tipo (`subDaConta()`
devolve `'Conta corrente'` para qualquer `DEBITO`). Não é bug da tela — é o seed. Ver `EF02-MC-005`.

## Prova rodada (evidência)

Re-executada pelo condutor, **independente do relato dos agentes**, por tarefa:

1. Tarefa #37 (skill de negócio): primeira tentativa reprovada por auditoria de conteúdo (não pelo
   gate); retrabalho auditado item a item contra EF-02/EF-06/D-06, depois `PROVA_DE_COMPORTAMENTO=PASS`.
2. Tarefa #38 (renomeação): `PROVA_DE_COMPORTAMENTO=PASS`, mesma contagem de testes de antes.
3. Tarefa #39 (backend): `PROVA_DE_COMPORTAMENTO=PASS`, **105 testes** (86 da base + 19 novos,
   contados por `scripts/contar-testes.mjs`), navegação 10 rotas / 0 quebradas.
4. Tarefa #40 (frontend): `PROVA_DE_COMPORTAMENTO=PASS`, 105 testes, navegação 10 rotas / 0
   quebradas, mais a verificação visual acima.

```
build        PASS  (bloqueante)
test(N>0)    PASS  (bloqueante) — 105 testes executados
front        PASS  (bloqueante)
typecheck    PASS
contrato     PASS  (bloqueante)
navegacao    PASS  (bloqueante) — 10 rotas abertas, 0 quebradas
PROVA_DE_COMPORTAMENTO=PASS
```

`fails=0` · `skips_bloqueantes=0` em ambas as tarefas #39 e #40.

## O que não foi portado do mockup

`support.js` (runtime gerado do dc-runtime, conforme já registrado desde a EF-00).

Os botões _Ver fatura_/_Pagar fatura_ do item de cartão **saíram desta lista na história #74**: eram
omissão temporária, não recusa de porte, e hoje estão na tela.

Continua não portada a linha de apoio do cartão como o mockup a monta (`'limite … · livre … · vence
dia …'`, `Orcamento Familiar.dc.html:1032`): `subDaConta()` mostra `'Fecha dia X · vence dia Y'`. É
divergência **pré-existente** da tarefa #40; a história #74 proibiu explicitamente que a tarefa #110
a "consertasse", por estar fora do escopo declarado dela.

## O que ainda não é desta EF

A fatura do cartão (soma, ciclo, pagamento) é da [EF-05](../especificacoes/EF-05-faturas.md). O
lastro (`caixaReal`, `limiteLivre`, disponível por categoria) é da
[EF-06](../especificacoes/EF-06-lastro.md) — este módulo só entrega os dados (saldo derivado,
`totalEmContaHojeCentavos`) que os dois vão consumir.
