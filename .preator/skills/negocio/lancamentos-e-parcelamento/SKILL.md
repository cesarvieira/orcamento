---
name: negocio-lancamentos-e-parcelamento
tipo: negocio # tipo 3 — conhecimento de NEGÓCIO/domínio
projeto: orcamento
dominio: lançamentos e parcelamento — competência × caixa, transferência, parcelamento sem juros, selagem
aplica-se-a: [orcamento]
status: ativa
revisao: por-mudanca-de-regra
---

# Negócio — lançamentos e parcelamento

> **Skill de Negócio (tipo 3).** O conhecimento do NEGÓCIO que suporta a **especificação**. É o
> que faz o agente de Requirements/PO escrever specs corretas e o Dev não violar regra de domínio.
> Não é sobre código — é sobre _o que o cliente faz e as regras que o regem_.

## O que é o negócio (em 3 linhas)

Todo dinheiro que entra ou sai da família vira um **lançamento**: receita, despesa ou
transferência entre contas próprias. Ele carrega duas datas com papéis distintos — a
**competência**, que decide qual mês de orçamento ele consome, e a **data de caixa**, que decide
quando o saldo de verdade se move — e uma compra parcelada não é um lançamento, é uma **série**
deles, um por competência, sem juros. Este módulo decide **o que aconteceu e quando**; ele não
decide se cabia no teto (isso é da `orcamento-por-envelope`) nem se havia lastro por trás (isso é
da `contas-e-lastro`).

## Atores / personas

| Ator   | Quem é                        | O que faz no sistema                                                               | Restrições                                          |
| ------ | ----------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------- |
| Membro | pessoa com login numa família | registra lançamento (receita/despesa/transferência), parcela compra, exclui        | só enxerga e altera dado da própria família         |
| App    | o guarda da competência       | calcula a competência na escrita, recusa lançamento em mês selado, soma `recebido` | leitura/derivação, nunca decide sozinho o que houve |

## Glossário do domínio (a linguagem ubíqua)

> Todo nome de código, tela e evento deve usar estes termos — não sinônimos técnicos. Termos já
> fixados pelas skills irmãs (`competência`, `teto`, `lastro`, `conta`) são **referenciados**, não
> redefinidos — ver `../orcamento-por-envelope/SKILL.md` e `../contas-e-lastro/SKILL.md`.

| Termo                     | Definição precisa                                                                                                                                                                                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lançamento                | um movimento de dinheiro: `tipo` é `RECEITA`, `DESPESA` ou `TRANSFERENCIA` — **campo explícito**, nunca sinal do valor. [EF-04 §1](../../../../docs/especificacoes/EF-04-lancamentos.md)                                                                                                                     |
| Data                      | a data que o membro escolheu para o lançamento — coluna própria, distinta de `competência` (RN-15). [EF-04 §1](../../../../docs/especificacoes/EF-04-lancamentos.md)                                                                                                                                         |
| Competência               | o mês de orçamento que o lançamento **consome** — calculada na escrita a partir de `data`, não copiada dela. Mesmo termo de `orcamento-por-envelope`; aqui é a chave que decide qual `OrcamentoMes` ele afeta. [EF-04 §1/§2](../../../../docs/especificacoes/EF-04-lancamentos.md)                           |
| Caixa (data de caixa)     | o momento em que o **saldo da conta** de fato se move. Para despesa em débito e receita, coincide com `data`; para compra no crédito, **não coincide** — o saldo só se move quando a fatura é paga ([EF-05](../../../../docs/especificacoes/EF-05-faturas.md)), que pode ser mês seguinte ao da competência. |
| Retroativo                | lançamento cuja `data` cai num mês **já fechado no calendário** (mês anterior ao corrente) — ainda assim consome o teto **do mês da própria data**, nunca o do mês corrente (RN-15).                                                                                                                         |
| Transferência             | movimento entre duas contas **da mesma família** (ex.: pagar fatura, guardar em meta) — não é ganho nem gasto, é o dinheiro trocando de lugar (RN-17).                                                                                                                                                       |
| Série de parcelas         | `SerieParcelas` — agrupa as N parcelas de uma compra parcelada; guarda o total e a quantidade da **compra original** (RN-20/RN-21). [EF-04 §1](../../../../docs/especificacoes/EF-04-lancamentos.md)                                                                                                         |
| Resíduo                   | a diferença de centavos que a divisão inteira do total por N não fecha; tem destino fixo: a **última** parcela (RN-21).                                                                                                                                                                                      |
| Recebido (da competência) | soma dos lançamentos `RECEITA` daquela competência (RN-39) — o termo já existe em `orcamento-por-envelope` como campo consumido por `não alocado`; **esta skill é a dona da regra de apuração**, aquela só o consome.                                                                                        |
| Competência selada        | mês em que `FechamentoMes` já foi criado ([EF-08](../../../../docs/especificacoes/EF-08-fechamento.md)); não aceita novo lançamento, nem retroativo (RN-22).                                                                                                                                                 |

## Regras de negócio (as invioláveis)

> Numeradas para rastrear na spec e no teste. Cada regra vira critério de aceite e edge case.

| #     | Regra                                                                                                                    | Onde é imposta                                            | Origem (lei/norma/decisão)                                                                                                                                                                                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RN-15 | Lançamento com `data` em mês anterior **não consome o teto do mês corrente** — consome o teto do mês **da própria data** | cálculo da competência na escrita                         | [EF-04 §2](../../../../docs/especificacoes/EF-04-lancamentos.md) — mockup                                                                                                                                                                          |
| RN-16 | Todo lançamento registra `criadoPorMembroId`, e o campo é **imutável**                                                   | handler / schema                                          | [EF-04 §1/§2](../../../../docs/especificacoes/EF-04-lancamentos.md) — mockup                                                                                                                                                                       |
| RN-17 | **Transferência não é despesa**: não consome teto de categoria nenhuma, e `categoriaId` é nulo nela                      | validação + leitura                                       | [EF-04 §1/§2](../../../../docs/especificacoes/EF-04-lancamentos.md); [D-06](../../../../docs/decisoes/D-06-dinheiro-em-centavos.md)                                                                                                                |
| RN-18 | Compra no crédito consome a categoria **na data da compra** e **não altera o saldo da conta**                            | leitura de saldo                                          | [EF-04 §2](../../../../docs/especificacoes/EF-04-lancamentos.md) — mockup                                                                                                                                                                          |
| RN-19 | O saldo da conta só se move **quando a fatura é paga**                                                                   | [EF-05](../../../../docs/especificacoes/EF-05-faturas.md) | [EF-04 §2](../../../../docs/especificacoes/EF-04-lancamentos.md) — mockup                                                                                                                                                                          |
| RN-20 | Parcelamento **até 48×**: gera **N lançamentos**, um por competência                                                     | serviço de criação                                        | [EF-04 §2](../../../../docs/especificacoes/EF-04-lancamentos.md) — fonte primária; ver nota sobre o teto de 48× abaixo                                                                                                                             |
| RN-21 | O resíduo do parcelamento vai para a **última** parcela; a soma das parcelas é **exatamente** o total                    | serviço de criação (na **geração**)                       | [D-06](../../../../docs/decisoes/D-06-dinheiro-em-centavos.md) — tabela "Divisão → Destino do resíduo"; ancorado também em [`financeiro/credito`](../../../../preator/conhecimento/negocio/financeiro/credito/SKILL.md) (ver seção própria abaixo) |
| RN-22 | Competência **selada não aceita** novo lançamento — inclusive retroativo                                                 | validação na escrita                                      | [EF-04 §2](../../../../docs/especificacoes/EF-04-lancamentos.md); regra irmã de RN-37 em [EF-08 §2](../../../../docs/especificacoes/EF-08-fechamento.md)                                                                                           |
| RN-39 | `recebido` da competência = **soma dos lançamentos `RECEITA`** daquela competência                                       | leitura da competência                                    | [EF-04 §2](../../../../docs/especificacoes/EF-04-lancamentos.md) — decisão do humano, 2026-08-27                                                                                                                                                   |

### Competência × caixa (RN-18 + RN-19 juntas)

É a distinção que a própria EF-04 chama de **"a fonte de confusão mais comum em app de
finanças"** ([EF-04 §2](../../../../docs/especificacoes/EF-04-lancamentos.md)), e o coração desta
skill.

- **Competência** responde "de qual mês de orçamento isto sai". Uma compra no crédito consome a
  categoria (o teto) **na data da compra** — não na data em que a fatura vence nem na data em que
  ela é paga (RN-18). Se a compra é em 15/agosto, ela é gasto de agosto no orçamento, ponto final.
- **Caixa** responde "quando o dinheiro de verdade sai da conta". Para uma compra no crédito, isso
  **não acontece na compra** — o saldo da conta só se move quando a fatura correspondente é paga
  (RN-19), o que é regra e ato da [EF-05](../../../../docs/especificacoes/EF-05-faturas.md), fora
  do escopo desta skill.
- As duas datas podem cair em **meses de calendário diferentes**: compra em 28/agosto, fatura
  fecha e vence em setembro. O teto de agosto já sentiu o gasto (RN-18); o saldo da conta de
  débito só sente em setembro, quando a fatura é paga (RN-19).
- **O que RN-39 (`recebido`) não decide, e fica registrado aqui como o mesmo cuidado que a EF-04
  já sinaliza**: a soma usa a **competência** do lançamento de receita, coerente com RN-15 e com
  `recebido` ser leitura de uma competência — não a data de caixa em que o dinheiro efetivamente
  entrou na conta. [EF-04 §2](../../../../docs/especificacoes/EF-04-lancamentos.md) registra
  isso como um ponto a olhar de novo "quando esta EF for construída de verdade"; esta skill não
  resolve essa tensão sozinha — só a expõe, porque escalar é a regra, não co-evoluir regra com
  código.

### Transferência não é despesa (RN-17) — por que contá-la como gasto corrompe três coisas de uma vez

Fonte literal, [EF-04 §4](../../../../docs/especificacoes/EF-04-lancamentos.md) ("o que não se
copia do protótipo"): _"Transferência não existe no protótipo, mas pagar fatura e guardar em meta
são transferências. Sem o tipo, viram despesa e corrompem teto, gasto e lastro de uma vez."_

Decompondo o porquê:

- **Teto** — uma transferência não tem `categoriaId` (nulo, como receita — [EF-04
  §1](../../../../docs/especificacoes/EF-04-lancamentos.md)). Se fosse contada como despesa, teria
  de forçar uma categoria artificial, e o disponível daquela categoria (RN-10 da
  `orcamento-por-envelope`) cairia por um movimento que não é gasto real da família.
- **Gasto** — o extrato e qualquer relatório de "quanto a família gastou" inflariam com dinheiro
  que só trocou de conta dentro da própria família — pagar a própria fatura de cartão não é
  consumir nada novo.
- **Lastro** — mover dinheiro do débito para pagar o cartão (ou para uma reserva) não reduz o
  lastro da família (`contas-e-lastro`, RN-27/RN-28): o caixa real de uma conta cai, mas o limite
  livre do cartão sobe (a fatura foi paga) ou a reserva recebeu o que já não contava como gasto.
  Contar como despesa faria o lastro cair **duas vezes** pelo mesmo dinheiro: uma na compra
  original (se fosse crédito) e outra na transferência que só a quita.

### Parcelamento sem juros (RN-20 + RN-21) — o que se toma emprestado da skill de crédito, e o que não

⚠️ **A skill agnóstica `financeiro/credito` é de crédito COM JUROS** (Price, SAC, CET, IOF — ver
[`preator/conhecimento/negocio/financeiro/credito/SKILL.md`](../../../../preator/conhecimento/negocio/financeiro/credito/SKILL.md)).
O parcelamento **deste produto não tem juros**: é **divisão inteira de um total em N parcelas
iguais**, sem tabela de amortização, sem taxa periódica, sem CET, sem IOF. Nada dessas mecânicas
entra aqui — nem por analogia, nem "por completude".

**O que se aproveita daquela skill, e só isso**: o princípio do **resíduo de arredondamento**, que
lá aparece três vezes de forma idêntica:

- Princípio 3: _"O saldo final tem que fechar em zero (salvo arredondamento na última parcela —
  ajuste a última amortização para zerar)."_
- Receita A (Tabela Price): _"Ajuste a última amortização para zerar o saldo (absorve
  arredondamento)."_
- "Armadilhas comuns": _"Saldo que não zera. Arredondamento por parcela acumula; ajuste a última
  amortização para fechar em zero e recalcule a última prestação."_

A mecânica geral — **quando uma divisão de inteiros não fecha exatamente, o resíduo vai para o
último elemento da série, nunca distribuído** — é o que RN-21 herda. Neste produto ela é mais
simples ainda, porque não há juros a recalcular: é aritmética inteira pura.

```
parcelaCentavos = totalCentavos DIV quantidade          (divisão inteira, trunca)
residuoCentavos = totalCentavos MOD quantidade
parcela[1..quantidade-1] = parcelaCentavos
parcela[quantidade]      = parcelaCentavos + residuoCentavos
Σ parcela[1..quantidade] == totalCentavos                (sempre, por construção)
```

Esta é também, literalmente, a regra do projeto: [D-06](../../../../docs/decisoes/D-06-dinheiro-em-centavos.md)
já registra, na tabela "Divisão → Destino do resíduo", que para **Parcelamento** o destino é **"a
última parcela — a soma das parcelas é sempre exatamente o total"**. RN-21 não inventa regra nova:
é a aplicação, em lançamentos, de uma decisão de projeto que já existia para dinheiro em geral.

**RN-20 (o teto de 48×) não tem âncora na skill agnóstica** — `financeiro/credito` não menciona
"48" em lugar nenhum (conferido no arquivo e em `EXTRACOES/`). A fonte citável do limite é a
própria [EF-04 §2](../../../../docs/especificacoes/EF-04-lancamentos.md), que é EF fechada e,
portanto, fonte válida por si — mas registra-se aqui, às claras, que **não existe origem externa
para o número 48**; se algum dia isso for questionado, a pergunta é para o humano, não para esta
skill inventar uma justificativa regulatória que a fonte não dá.

**RN-21 vale na geração da série, não em edições posteriores** — ver a seção de forks decididos
abaixo, sobre `SerieParcelas.total`/`quantidade` serem imutáveis.

## Forks — decididos pelo humano, registrados aqui como fechados

> A EF-04 §6 lista "excluir uma parcela apaga a série inteira ou só aquela parcela?" como fork
> **aberto**. Ele **foi fechado** desde então, na condução desta tarefa. Este registro é a fonte
> do fechamento até que a EF-04 seja atualizada para refletir.

### 1 — Excluir parcela: pergunta o alcance

Excluir uma parcela **não tem alcance único** — o detalhe da parcela **pergunta**:

| Opção            | Efeito                                                                                |
| ---------------- | ------------------------------------------------------------------------------------- |
| `esta`           | remove só o lançamento **daquela** parcela                                            |
| `todas`          | remove a série inteira — **todos** os lançamentos gerados por aquela `SerieParcelas`  |
| `a partir desta` | remove esta parcela **e** as de competência posterior (mantém as anteriores intactas) |

Nenhuma dessas opções reescreve `SerieParcelas.total`/`quantidade` — ver a suposição abaixo.

### 2 — RN-22: o guardião ainda não pode ler o que precisa

A tabela `FechamentoMes` — a que registra que uma competência foi selada — é da
[EF-08](../../../../docs/especificacoes/EF-08-fechamento.md)
([issue #22](https://github.com/cesarvieira/orcamento/issues/22)), **ainda não construída** (ver
"Estado atual" em `.preator/CONTEXT.md`).

**A regra RN-22 vale por inteiro** — competência selada não aceita lançamento novo, inclusive
retroativo (a própria EF-08, RN-37, é explícita: _"RN-37 dá ao retroativo (RN-15) um limite claro:
pode-se lançar em mês anterior **aberto**, nunca em mês fechado"_
[[EF-08 §2](../../../../docs/especificacoes/EF-08-fechamento.md)]). O que fica pendente é só a
**leitura**: enquanto `FechamentoMes` não existe, o guarda de escrita fica como um ponto de
checagem nomeado, comentado `@fundacao` (mesma convenção já usada em
`api/src/modulos/contas/servico.ts` para o termo de saldo derivado que espera a EF-04), apontando
para a EF-08, e **retorna "não selada" para toda competência** até que a tabela exista. O caso
positivo (competência de fato selada, lançamento de fato recusado) fica **pendente da EF-08** — não
é lacuna desta skill, é dependência real, do mesmo jeito que RN-39 registrou sua dependência da
própria EF-04 antes de esta EF existir.

## Suposição declarada pelo condutor (a registrar, não a inventar de novo)

`SerieParcelas.total` (centavos — ver nota de nomenclatura abaixo) e `SerieParcelas.quantidade`
guardam a **compra original** e **não são reescritos** por exclusão de parcelas — pelo mesmo
motivo de `criadoPorMembroId` ser imutável (RN-16): são o registro histórico do que foi decidido
na criação, não um total corrente recalculável. **RN-21 (soma == total) vale na geração da série**,
que é onde [EF-04 §2](../../../../docs/especificacoes/EF-04-lancamentos.md) a especifica —
excluir parcelas depois (fork 1 acima) não é obrigado a manter essa igualdade, porque o total
guardado é o da compra, não da série remanescente.

**Nota de nomenclatura:** [EF-04 §1](../../../../docs/especificacoes/EF-04-lancamentos.md) nomeia
os campos como "total, quantidade", sem sufixo. Por convenção já em vigor no projeto —
[D-06](../../../../docs/decisoes/D-06-dinheiro-em-centavos.md) e os precedentes `valorCentavos`,
`limiteCentavos`, `saldoInicialCentavos`, `sobraCentavos` — o campo monetário materializa como
`totalCentavos`. Esta skill usa as duas grafias de propósito: `total` quando cita a EF-04
literalmente, `totalCentavos` quando descreve o campo de implementação.

## Regulação / compliance (o que a lei/norma exige)

- **Dinheiro em centavos** — `valorCentavos` e `SerieParcelas.totalCentavos` são inteiros na pilha
  toda. Ver [D-06](../../../../docs/decisoes/D-06-dinheiro-em-centavos.md). Este é o módulo dono
  da divisão de parcelamento; o rateio do lastro é da skill irmã `contas-e-lastro`, não recontado
  aqui.
- **Isolamento entre famílias** — nenhum `Lancamento` ou `SerieParcelas` expõe dado de uma família
  a outra, em REST e em WebSocket (mesma exigência transversal do produto, ver `.preator/CONTEXT.md`).
- **Tipo explícito, não sinal** — `Lancamento.tipo` é enum de string (`RECEITA` · `DESPESA` ·
  `TRANSFERENCIA`), nunca inferido do sinal do valor. [EF-04 §1](../../../../docs/especificacoes/EF-04-lancamentos.md)
  ("o protótipo representa receita como valor negativo... falha para relatar, filtrar e validar, e
  torna transferência inexprimível").

## Processos / fluxos principais

1. **Lançar despesa/receita** — membro abre a folha de novo lançamento, escolhe tipo, valor,
   categoria (obrigatória em despesa, nula em receita), conta e data; o app calcula a competência
   na escrita (RN-15) e grava o autor de forma imutável (RN-16).
   [EF-04 §3](../../../../docs/especificacoes/EF-04-lancamentos.md)
2. **Transferir** — membro escolhe conta de origem e destino (`contaId`/`contaDestinoId`, só
   preenchidos em `TRANSFERENCIA`); nenhuma categoria é pedida; nenhum teto é tocado (RN-17).
3. **Comprar parcelado no crédito** — membro informa o total e a quantidade de parcelas (até 48×);
   o serviço gera N lançamentos, um por competência subsequente, com o resíduo absorvido na última
   (RN-20/RN-21); cada parcela consome o teto da sua própria competência na data da compra
   correspondente (RN-18), sem mexer no saldo da conta (RN-19 — quem move é a fatura, EF-05).
4. **Excluir parcela** — membro abre o detalhe de uma parcela e escolhe o alcance: `esta`, `todas`
   ou `a partir desta` (fork 1 acima).
5. **Selar o mês** — ato da [EF-08](../../../../docs/especificacoes/EF-08-fechamento.md); a partir
   daí, RN-22 recusa novo lançamento naquela competência.

## Casos de uso principais

| UC    | Ator   | Objetivo                                                                 | Regras envolvidas      |
| ----- | ------ | ------------------------------------------------------------------------ | ---------------------- |
| UC-01 | Membro | Lançar um gasto retroativo sem inflar o teto do mês corrente             | RN-15                  |
| UC-02 | Membro | Ver quem lançou cada movimento, mesmo depois de meses                    | RN-16                  |
| UC-03 | Membro | Pagar a própria fatura sem que isso apareça como gasto de categoria      | RN-17                  |
| UC-04 | Membro | Comprar no crédito e ver o teto do mês da compra reagir na hora          | RN-18                  |
| UC-05 | Membro | Ver o saldo da conta de débito só mudar quando a fatura é paga           | RN-19                  |
| UC-06 | Membro | Parcelar uma compra em N vezes sem juros, com a soma batendo com o total | RN-20, RN-21           |
| UC-07 | Membro | Excluir só uma parcela, sem afetar as demais já lançadas                 | fork 1                 |
| UC-08 | Membro | Tentar lançar num mês já selado e ser recusado                           | RN-22 (pendente EF-08) |
| UC-09 | App    | Somar `recebido` da competência para alimentar `não alocado`             | RN-39                  |

## Edge cases e exceções do domínio

- **Compra parcelada com valor quebrado** — R$ 100,00 em 3×: `parcela = 3333` centavos ×2 +
  `3334` centavos na última; soma = `10000` centavos, exatamente o total (RN-21). É o mínimo que
  [D-06](../../../../docs/decisoes/D-06-dinheiro-em-centavos.md) exige testar para toda divisão.
- **Compra parcelada que atravessa a virada do ano** — a competência de cada parcela é calculada
  independentemente (mês + N), sem tratamento especial; nenhuma fonte lida define exceção de
  virada de ano para lançamentos (distinto do fim de mês em `orcamento-por-envelope`, que também
  não abre exceção — RN-13 daquela skill).
- **Retroativo em mês fechado no calendário mas não selado** — permitido; RN-15 e RN-22 tratam
  coisas diferentes: RN-15 é sobre **qual teto** o retroativo consome (o do mês da data, não o
  atual); RN-22 é sobre **se o mês aceita escrita** (selado ou não), independente de quão antigo
  ele é.
- **Transferência com valor negativo ou conta de origem == destino** — nenhuma fonte lida define
  essa validação; não inventado aqui — é pergunta para quem construir o handler, não fato de
  negócio já decidido.
- **Excluir `todas` numa série já parcialmente paga (algumas faturas já pagas)** — as fontes lidas
  não relacionam exclusão de série com o estado da fatura (assunto da EF-05); esta skill não
  resolve essa interação, só registra que ela existe e não foi coberta em nenhuma fonte.

## Fontes do conhecimento

- [docs/especificacoes/EF-04-lancamentos.md](../../../../docs/especificacoes/EF-04-lancamentos.md)
  — EF fechada (Portão A) que define `Lancamento`, `SerieParcelas` e as regras RN-15 a RN-22 e
  RN-39. Fonte primária desta skill.
- [preator/conhecimento/negocio/financeiro/credito/SKILL.md](../../../../preator/conhecimento/negocio/financeiro/credito/SKILL.md)
  — skill agnóstica da fábrica, de crédito **com juros**. Âncora citável **só** do princípio do
  resíduo de arredondamento (RN-21) — nunca da tabela de amortização, CET ou IOF, que não se
  aplicam a este produto (parcelamento sem juros). Ver seção própria acima.
- [docs/decisoes/D-06-dinheiro-em-centavos.md](../../../../docs/decisoes/D-06-dinheiro-em-centavos.md)
  — ADR aceita que já registra, para "Parcelamento", que o resíduo vai para a última parcela; fonte
  direta e independente de RN-21, e também a origem da convenção de nomenclatura `*Centavos`.
  Obrigatória para toda implementação de parcelamento.
- [docs/especificacoes/EF-08-fechamento.md](../../../../docs/especificacoes/EF-08-fechamento.md) —
  EF fechada, dona de `FechamentoMes` e de RN-36/RN-37/RN-38; RN-37 é a regra irmã de RN-22 aqui.
  Módulo **fora de escopo e ainda não construído** — citada só para fundamentar o fork 2 e o selo
  `@fundacao`.
- [`.preator/skills/negocio/orcamento-por-envelope/SKILL.md`](../orcamento-por-envelope/SKILL.md)
  — skill irmã, dona de `competência`, `teto`, `disponível`, `planejado`, `não alocado` e RN-09 a
  RN-14/RN-40. Referenciada para o vocabulário; RN-39 (apuração de `recebido`) é desta skill, não
  daquela — aquela só consome o resultado.
- [`.preator/skills/negocio/contas-e-lastro/SKILL.md`](../contas-e-lastro/SKILL.md) — skill irmã,
  dona de `conta`, `lastro`, `caixa real`, `limite livre` e RN-06/07/08 e RN-27 a RN-32.
  Referenciada para o vocabulário e para explicar por que transferência mal-contada corromperia o
  lastro (RN-17); regras dela não recontadas aqui.
- Protótipo funcional no Claude Design: `Orcamento Familiar.dc.html` e Desktop, folha `sheetLanc`
  (novo lançamento) e modal de detalhe. A lógica visual é derivada dali, com as ressalvas de
  [EF-04 §4](../../../../docs/especificacoes/EF-04-lancamentos.md) sobre o que não se copia
  (receita como valor negativo, ausência de transferência, parcelamento gerando um lançamento só).
