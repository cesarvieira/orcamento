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
  prova: *"hoje NUNCA existe lançamento (a tabela é da EF-04): a checagem sempre libera a
  exclusão"* — descreve a limitação em vez de fingir cobertura do ramo 409.

### Escopo tocado além do declarado (aceito pelo condutor)

| Arquivo | Por que é costura necessária |
|---|---|
| `api/src/openapi/emitir.ts` (+1 linha) | o emissor do OpenAPI importa cada módulo à mão; sem isto o `BUILD_CMD` geraria o contrato sem as rotas de `contas`, quebrando D-03 em silêncio para quem construísse o front depois |
| `packages/contrato/src/index.ts` (+4 linhas) | exporta os tipos gerados, no padrão alfabético existente. `ContaCriada` (cadastro de usuário, EF-01) convive sem colidir com `Conta`/`NovaConta`/`ContasListadas` (financeira) |

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
  `valorLabel` alterna *Limite do cartão* / *Saldo atual* com o tipo (EF-02 §3). O bloco de
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
humano** se a família precisar *escolher* a cor — a folha de categoria (`sheetEditCat`) tem uma
grade de cor como precedente, se a decisão for por aí. Ver `EF02-MC-003`.

### `diaFechamento`/`diaVencimento`: capturados, exibidos, ainda não consumidos por lógica de fatura

Isto é **deliberado**, não um campo morto esquecido (EF-02 §4: o mockup captura os dois e não usa
nenhum — a fatura dele soma o mês civil; aqui os dois existem para a EF-05 usar). A tela **exibe**
os valores na linha de apoio do cartão de crédito (`"Fecha dia 20 · vence dia 27"`, montada em
`subDaConta()`), mas nenhum cálculo de ciclo de fatura roda em lugar nenhum ainda — quem procurar
por essa lógica no módulo de contas não vai achar, porque ela não é deste módulo. Ver `EF02-MC-004`.

### *Ver fatura* / *Pagar fatura* — omitidos, não deixados inertes

O mockup mostra os dois no item de cartão de crédito. A tarefa #40 os **omitiu** da tela (não
existem no HTML renderizado) — são da EF-05, e diferente do que a EF-00 fez com "Google"/"Apple" em
`/entrar` (que ficaram visíveis e inertes, com "em breve"), aqui a decisão foi não mostrar um botão
para uma tela que ainda não existe. Confirmado pelo condutor lendo o template renderizado.

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
família descobrir sozinha. A folha responde ao tipo como a EF-02 §3 manda: débito mostra *Saldo
atual* sem bloco de vencimento; crédito mostra *Limite do cartão* com o bloco, vencimento antes de
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

`support.js` (runtime gerado do dc-runtime, conforme já registrado desde a EF-00) e os botões *Ver
fatura*/*Pagar fatura* do item de cartão — omitidos por serem da EF-05, ver acima.

## O que ainda não é desta EF

A fatura do cartão (soma, ciclo, pagamento) é da [EF-05](../especificacoes/EF-05-faturas.md). O
lastro (`caixaReal`, `limiteLivre`, disponível por categoria) é da
[EF-06](../especificacoes/EF-06-lastro.md) — este módulo só entrega os dados (saldo derivado,
`totalEmContaHojeCentavos`) que os dois vão consumir.
