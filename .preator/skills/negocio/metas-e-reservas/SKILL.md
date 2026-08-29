---
name: negocio-metas-e-reservas
tipo: negocio # tipo 3 — conhecimento de NEGÓCIO/domínio
projeto: orcamento
dominio: metas e reservas — cofrinho, alvo, acumulado derivado, o ato de guardar
aplica-se-a: [orcamento]
status: ativa
revisao: por-mudanca-de-regra
---

# Negócio — metas e reservas

> **Skill de Negócio (tipo 3).** O conhecimento do NEGÓCIO que suporta a **especificação**. É o
> que faz o agente de Requirements/PO escrever specs corretas e o Dev não violar regra de domínio.
> Não é sobre código — é sobre _o que o cliente faz e as regras que o regem_.

## O que é o negócio (em 3 linhas)

A família cria **cofrinhos** — objetivos de poupança com um **alvo** — e **guarda** dinheiro
neles ao longo do mês. Guardar é uma **transferência real**, nunca lançamento de despesa nem
incremento direto de um contador: sai de uma conta de origem escolhida no momento do ato e entra
na conta `RESERVA` **própria** daquele cofrinho, sem nunca ultrapassar o que sobrou não alocado da
competência. O **acumulado** de cada cofrinho nunca é coluna: é sempre a soma das transferências
para a sua conta vinculada. Este módulo não decide se há dinheiro de verdade por trás do
orçamento (isso é do lastro, `contas-e-lastro`) nem é dono da mecânica de transferência em si
(isso é de `lancamentos-e-parcelamento`) — ele amarra as duas coisas no vocabulário do cofrinho.

## Atores / personas

| Ator   | Quem é                        | O que faz no sistema                                                              | Restrições                                                          |
| ------ | ----------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Membro | pessoa com login numa família | cria cofrinho, define alvo, escolhe as duas pontas e guarda dinheiro nele         | só enxerga e altera dado da própria família                         |
| App    | o guarda do teto de guardar   | recusa guardar acima do não alocado da competência; deriva o acumulado na leitura | nunca materializa acumulado; nunca infere a conta de origem sozinho |

## Glossário do domínio (a linguagem ubíqua)

> Todo nome de código, tela e evento deve usar estes termos — não sinônimos técnicos. Termos já
> fixados pelas skills irmãs (`não alocado`, `transferência`, `conta`, `lastro`) são
> **referenciados**, não redefinidos — ver `../orcamento-por-envelope/SKILL.md`,
> `../lancamentos-e-parcelamento/SKILL.md` e `../contas-e-lastro/SKILL.md`.

| Termo                            | Definição precisa                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cofrinho (= Meta)                | `Meta` — objetivo de poupança da família: nome, alvo, e uma conta `RESERVA` **própria**, vinculada 1:1. A família pode ter vários cofrinhos ao mesmo tempo. [EF-07 §1](../../../../docs/especificacoes/EF-07-metas.md); vínculo 1:1 único: **decisão humana · 2026-08-29 (D3)**                                                                                                        |
| Alvo (`alvoCentavos`)            | quanto a família pretende juntar naquele cofrinho; inteiro em centavos, como todo valor monetário do produto ([D-06](../../../../docs/decisoes/D-06-dinheiro-em-centavos.md)). [EF-07 §1](../../../../docs/especificacoes/EF-07-metas.md)                                                                                                                                              |
| Acumulado                        | quanto já foi guardado naquele cofrinho — **derivado, nunca coluna**: a soma das transferências (`TRANSFERENCIA`) para a conta `RESERVA` vinculada a ele. Materializar um `atual` criaria a segunda verdade que o produto evita em toda entidade derivada (mesmo motivo de saldo de conta e de lastro). [EF-07 §1](../../../../docs/especificacoes/EF-07-metas.md)                     |
| Guardar (o ato)                  | registrar uma `TRANSFERENCIA` (RN-33) de uma conta de origem `DEBITO` para a conta `RESERVA` de um cofrinho, escolhendo **as duas pontas** no ato — nunca uma conta inferida — e sem exceder o não alocado da competência (RN-34). [EF-07 §2](../../../../docs/especificacoes/EF-07-metas.md); as duas pontas: **decisão humana · 2026-08-29 (D5)**                                    |
| Conta `RESERVA` do cofrinho      | a conta de reserva **própria** de cada `Meta`, criada **junto** com ele, saldo inicial 0, em vínculo **1:1 único** — nunca compartilhada entre cofrinhos. **Decisão humana · 2026-08-29 (D3)**, que rejeita o padrão do mockup (ver edge case abaixo). Tipo `RESERVA` é o mesmo de [EF-02 §1](../../../../docs/especificacoes/EF-02-contas.md), dono em `../contas-e-lastro/SKILL.md`  |
| Conta de origem                  | a conta `DEBITO` de onde o dinheiro sai ao guardar. **Vem sempre do corpo da requisição, nunca inferida** — mesma armadilha (e mesmo remédio) que D3 · Seletor de conta pagadora, em [MANUAL-05](../../../../docs/manual/MANUAL-05-faturas.md) e [MC-05](../../../../docs/especificacoes/MC-05-faturas.md), já fechou para o pagamento de fatura. **Decisão humana · 2026-08-29 (D2)** |
| Não alocado (referência)         | `recebido − planejado` da competência corrente — termo e fórmula **de `orcamento-por-envelope`** (RN-11); aqui é só **consumido** como teto de RN-34, nunca redefinido. Ver `../orcamento-por-envelope/SKILL.md`                                                                                                                                                                       |
| Criar cofrinho (superfície nova) | tela nova, autorizada pelo humano — o mockup só desenha a **lista** de metas, não a criação. **Decisão humana · 2026-08-29 (D4)**                                                                                                                                                                                                                                                      |

## Regras de negócio (as invioláveis)

> Numeradas para rastrear na spec e no teste. Cada regra vira critério de aceite e edge case.
> **Regra da casa: um fato, um dono.** RN-33 e RN-35 já têm dona em skill irmã — aqui elas são
> **referenciadas e amarradas ao contexto de metas**, nunca recontadas por inteiro.

| #     | Regra                                                                                                                                                                                               | Onde é imposta                         | Fonte                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RN-33 | Guardar em meta é uma `TRANSFERENCIA`, **nunca despesa** — não consome teto de categoria nenhuma                                                                                                    | serviço de guardar                     | [EF-07 §2 RN-33](../../../../docs/especificacoes/EF-07-metas.md); mecânica dona: [EF-04 §1/§2 RN-17](../../../../docs/especificacoes/EF-04-lancamentos.md) — dona em `../lancamentos-e-parcelamento/SKILL.md`, que já cita literalmente "guardar em meta" como transferência (ver RN-17 daquela skill)                                                                                                                  |
| RN-34 | Guardar sai do **não alocado** do mês — como **TETO**: a API **recusa** guardar acima do não alocado da competência (`recebido − planejado`, RN-11); com não alocado ≤ 0, recusa **qualquer** valor | validação do serviço de guardar        | [EF-07 §2 RN-34](../../../../docs/especificacoes/EF-07-metas.md) — fonte original "mockup"; fórmula de `não alocado`: dona é [`orcamento-por-envelope` RN-11](../orcamento-por-envelope/SKILL.md); a **imposição como teto** é **decisão humana · 2026-08-29 (D1)**, ver seção própria abaixo                                                                                                                           |
| RN-35 | Conta `RESERVA` fica **fora do orçamento e fora do lastro**                                                                                                                                         | leitura de saldo / derivação do lastro | [EF-07 §2 RN-35](../../../../docs/especificacoes/EF-07-metas.md) — na tabela daquela EF, a coluna "Fonte" diz "decisão humana" e é a coluna "Onde é imposta" que aponta [EF-06](../../../../docs/especificacoes/EF-06-lastro.md); é **RN-27 por outro nome**, dona em `../contas-e-lastro/SKILL.md`; a própria EF-06 já registra a equivalência ([EF-06 §5, nota "a"](../../../../docs/especificacoes/EF-06-lastro.md)) |

### A consequência que parece bug e não é: guardar reduz o lastro do mês

Guardar tira caixa de débito (a conta de origem perde saldo) e a conta `RESERVA` de destino fica
**fora** do lastro (RN-35/RN-27). O resultado é que `caixaReal` — e portanto o **lastro** — **cai**
no momento em que a família guarda dinheiro. Isso está correto e é **intencional**: o dinheiro
passou a estar comprometido com a meta, não some. Fonte: [EF-07 §2](../../../../docs/especificacoes/EF-07-metas.md)
("Está correto e é intencional... Quem não entender isso vai 'consertar' a regra"); a própria
[EF-06 §5, nota "a"](../../../../docs/especificacoes/EF-06-lastro.md) já provou esse efeito **antes**
desta EF existir, usando só o vocabulário de `TRANSFERENCIA` de `DEBITO` para `RESERVA` — sem
`Meta` como entidade. Quando `Meta` nasce, RN-35 é a mesma RN-27, e este efeito não muda: só ganha
nome de produto (cofrinho) por cima de um mecanismo que já era verdade.

## Decisões humanas — 2026-08-29 (o mesmo padrão que EF-06 usa para o lastro)

> Tomadas pelo dono do produto, **antes de qualquer código**, exatamente como o precedente que
> [EF-06](../../../../docs/especificacoes/EF-06-lastro.md) já registra para o lastro. Citadas aqui
> como fonte própria — `decisão humana · 2026-08-29` — porque nenhuma EF fechada as continha por
> inteiro antes desta formalização.

**D1 · RN-34 é um TETO, não um rótulo de tela.** A API **recusa** guardar acima do não alocado da
competência. Com `naoAlocado ≤ 0`, recusa **qualquer** valor, mesmo pequeno. ⚠️ Antes desta decisão
a frase _"Guardar sai do não alocado do mês"_ existia só como **subtítulo da tela** no mockup —
puro texto, sem imposição: o protótipo calcula `naoAlocado = recebido − planejado` para exibição, e
os botões _Guardar 100_/_Guardar 500_ incrementam o acumulado direto no estado, sem tocar
`naoAlocado` nem qualquer conta ([EF-07 §4](../../../../docs/especificacoes/EF-07-metas.md), "o que
não se copia do protótipo"). Este registro existe para que, quando alguém "descobrir" no código que
o teto não estava no desenho original, não conclua que é seguro removê-lo — a imposição é decisão
de produto, tomada com o humano, não dedução do desenho.

**D2 · A conta de ORIGEM vem do corpo da requisição, nunca inferida.** Repetição literal do
precedente **D3 · Seletor de conta pagadora**, registrado em
[MANUAL-05:267](../../../../docs/manual/MANUAL-05-faturas.md) e em
[MC-05:34,39](../../../../docs/especificacoes/MC-05-faturas.md) — a "armadilha do protótipo" de
nunca inferir "a primeira conta de débito" ou qualquer conta por convenção. Quem guarda dinheiro
escolhe explicitamente de onde ele sai.

**D3 · A meta É um cofrinho, e cada cofrinho tem a PRÓPRIA conta `RESERVA`.** Criada **junto** com
o cofrinho (saldo inicial 0), em vínculo **1:1 único**. A família pode criar vários cofrinhos.
⚠️ **O mockup mostra o CONTRÁRIO** — uma única conta "Poupança" com três metas dependuradas nela.
Isso foi **rejeitado**: com conta compartilhada, as três metas exibiriam o **mesmo** acumulado,
porque [EF-07 §1](../../../../docs/especificacoes/EF-07-metas.md) deriva o acumulado da **conta
vinculada** — se três cofrinhos apontassem para a mesma conta, a soma das transferências para ela
seria idêntica para os três, e nenhum dos três progressos individuais seria representável. O
vínculo 1:1 não é preferência de modelagem: é a única forma de a fórmula do §1 (acumulado = soma
das transferências para **a** conta vinculada) fazer sentido com mais de um cofrinho por família.

**D4 · Criar cofrinho é superfície NOVA na tela**, autorizada pelo humano. O desenho do mockup só
tem a **lista** de metas ([EF-07 §3](../../../../docs/especificacoes/EF-07-metas.md), referência de
tela); a folha/fluxo de criação não tem fonte no protótipo e foi autorizada como trabalho novo,
não como cópia de tela existente — mesmo padrão já usado pela caixa de diálogo de exclusão de
parcela em `../lancamentos-e-parcelamento/SKILL.md` (fork 1), descrita em
[EF-04 §6](../../../../docs/especificacoes/EF-04-lancamentos.md) e
[MANUAL-04](../../../../docs/manual/MANUAL-04-lancamentos.md) como "construída no vocabulário
visual das outras folhas do app", sem fonte no desenho.

**D5 · Guardar escolhe as DUAS pontas** — a conta de origem (`DEBITO`, D2) **e** o cofrinho de
destino. Nenhuma das duas é padrão implícito ou pré-selecionada por convenção; o membro escolhe as
duas em todo ato de guardar.

## Processos / fluxos principais

1. **Criar cofrinho** (D4) — membro abre a superfície nova de criação, informa nome e alvo
   (`alvoCentavos`); o sistema cria a `Meta` e, junto, a conta `RESERVA` própria dela, com saldo
   inicial 0 (D3). [EF-07 §1](../../../../docs/especificacoes/EF-07-metas.md)
2. **Guardar** — membro escolhe a conta de origem (`DEBITO`, corpo da requisição — D2) e o
   cofrinho de destino (D5); o sistema calcula o não alocado da competência corrente
   (`orcamento-por-envelope` RN-11), recusa se o valor pedido exceder esse teto ou se o não
   alocado já for ≤ 0 (RN-34/D1), e — se aprovado — registra uma `TRANSFERENCIA` (RN-33) da conta
   de origem para a `RESERVA` do cofrinho.
3. **Ver o cofrinho** — o app lê alvo, soma as transferências para a conta `RESERVA` vinculada
   (acumulado derivado) e mostra a barra de progresso; nenhum valor é lido de coluna
   materializada. [EF-07 §1/§3](../../../../docs/especificacoes/EF-07-metas.md)
4. **Ver o efeito no lastro** — o guardar reduz o caixa de débito da conta de origem e a conta
   `RESERVA` de destino não entra no lastro (RN-35/RN-27); o lastro da família cai no mesmo
   instante — ver "consequência que parece bug e não é" acima.

## Casos de uso principais

| UC    | Ator   | Objetivo                                                                             | Regras envolvidas    |
| ----- | ------ | ------------------------------------------------------------------------------------ | -------------------- |
| UC-01 | Membro | Criar um cofrinho novo com nome e alvo                                               | D3, D4               |
| UC-02 | Membro | Guardar dinheiro num cofrinho dentro do não alocado do mês                           | RN-33, RN-34, D2, D5 |
| UC-03 | App    | Recusar guardar um valor que excede o não alocado da competência                     | RN-34, D1            |
| UC-04 | App    | Recusar qualquer valor quando o não alocado já é zero ou negativo                    | RN-34, D1            |
| UC-05 | Membro | Ver o acumulado de cada cofrinho sem que ele seja confundido com o de outro cofrinho | RN-35, D3            |
| UC-06 | Membro | Ter vários cofrinhos ao mesmo tempo, cada um com progresso independente              | D3                   |
| UC-07 | Membro | Ver o lastro da família cair depois de guardar, e entender que é esperado            | RN-35 (RN-27)        |

## Edge cases e exceções do domínio

- **Conta `RESERVA` compartilhada entre metas (o padrão do mockup):** rejeitado por D3. Se duas
  metas apontassem para a mesma conta `RESERVA`, ambas leriam o **mesmo** acumulado — a soma de
  todas as transferências feitas para aquela conta, sem distinção de qual meta o membro tinha em
  mente ao guardar. O vínculo 1:1 é o que torna "acumulado por cofrinho" um conceito que existe.
- **Não alocado zero ou negativo:** RN-34/D1 recusa **qualquer** valor de guardar, inclusive
  valores pequenos — não há piso de tolerância nas fontes lidas.
- **Guardar exatamente o não alocado inteiro:** nenhuma fonte lida proíbe; o teto é "não exceder",
  e o valor igual ao não alocado não o excede.
- **Alvo atingido (acumulado ≥ alvo):** nenhuma fonte lida (EF-07 nem as decisões D1..D5) define
  trava para continuar guardando depois de bater o alvo. Não inventado aqui — é pergunta em aberto
  para quem construir o handler, não fato de negócio já decidido.
- **Conta de origem igual à conta `RESERVA` de destino:** nenhuma fonte lida define essa
  validação — mesmo padrão de lacuna já registrado em `../lancamentos-e-parcelamento/SKILL.md`
  para transferência com origem igual a destino. Não inventado aqui.
- **Excluir um cofrinho com acumulado > 0:** nenhuma fonte lida (EF-07, D1..D5) define o que
  acontece com o saldo da conta `RESERVA` vinculada nem se a exclusão é permitida. Não inventado
  aqui — a criação e o ato de guardar têm fonte; a exclusão, não.

## Regulação / compliance (o que a lei/norma exige)

- **Dinheiro em centavos** — `alvoCentavos` e todo valor guardado são inteiros na pilha toda. Ver
  [D-06](../../../../docs/decisoes/D-06-dinheiro-em-centavos.md). Este módulo não introduz divisão
  nova (nem rateio, nem parcelamento) — a exigência aqui é apenas nunca representar alvo ou
  acumulado em ponto flutuante.
- **Isolamento entre famílias** — nenhuma `Meta` ou conta `RESERVA` vinculada expõe dado de uma
  família a outra, em REST e em WebSocket (mesma exigência transversal do produto, ver
  `.preator/CONTEXT.md`).

## Fontes do conhecimento

- [docs/especificacoes/EF-07-metas.md](../../../../docs/especificacoes/EF-07-metas.md) — EF fechada
  que define `Meta`, o acumulado derivado, e as regras RN-33 a RN-35. Fonte primária desta skill.
- [docs/especificacoes/EF-04-lancamentos.md](../../../../docs/especificacoes/EF-04-lancamentos.md)
  — dona da mecânica de `TRANSFERENCIA` e de RN-17; referenciada para RN-33, nunca recontada.
  §6 (fork 1) também é a fonte literal de "construída no vocabulário visual das outras folhas do
  app", citada em D4.
- [docs/especificacoes/EF-06-lastro.md](../../../../docs/especificacoes/EF-06-lastro.md) — dona de
  RN-27 e do efeito "guardar reduz o lastro", provado ali (§5, nota "a") **antes** de `Meta`
  existir como entidade. Fonte de RN-35 e da seção "consequência que parece bug e não é".
- [docs/manual/MANUAL-05-faturas.md](../../../../docs/manual/MANUAL-05-faturas.md) (§ "D3 · Seletor
  de conta pagadora", linha 267) e
  [docs/especificacoes/MC-05-faturas.md](../../../../docs/especificacoes/MC-05-faturas.md)
  (linhas 34 e 39) — fonte do precedente D3 do pagamento de fatura, que D2 desta skill repete
  literalmente ("nunca inferir a conta").
- [docs/especificacoes/EF-02-contas.md](../../../../docs/especificacoes/EF-02-contas.md) — dona do
  tipo `RESERVA` e de `saldoInicialCentavos`; referenciada para os campos da conta criada junto com
  o cofrinho (D3).
- [docs/decisoes/D-06-dinheiro-em-centavos.md](../../../../docs/decisoes/D-06-dinheiro-em-centavos.md)
  — ADR aceita que decide que dinheiro é inteiro em centavos na pilha toda; vale para `alvoCentavos`
  e para todo valor guardado.
- **Decisões humanas · 2026-08-29 (D1 a D5)** — tomadas pelo dono do produto antes de qualquer
  código desta história, no mesmo padrão que [EF-06](../../../../docs/especificacoes/EF-06-lastro.md)
  usa para as decisões do lastro. Registradas por inteiro na seção própria acima; são a **única**
  fonte de RN-34 como teto imposto (D1), da proveniência da conta de origem (D2), do vínculo 1:1
  entre `Meta` e `RESERVA` (D3), da superfície nova de criação (D4) e das duas pontas do ato de
  guardar (D5).
- [`.preator/skills/negocio/lancamentos-e-parcelamento/SKILL.md`](../lancamentos-e-parcelamento/SKILL.md)
  — skill irmã, dona de `TRANSFERENCIA`, RN-17 e RN-15/16/18-22/39. Referenciada para RN-33, nunca
  recontada; já citava "guardar em meta" como transferência antes desta skill existir.
- [`.preator/skills/negocio/contas-e-lastro/SKILL.md`](../contas-e-lastro/SKILL.md) — skill irmã,
  dona de `conta`, `lastro`, `caixa real` e RN-06/07/08/27-32. Referenciada para RN-35 (RN-27 por
  outro nome) e para o tipo `RESERVA`; regras dela não recontadas aqui.
- [`.preator/skills/negocio/orcamento-por-envelope/SKILL.md`](../orcamento-por-envelope/SKILL.md)
  — skill irmã, dona de `competência`, `teto`, `planejado`, `recebido` e `não alocado` (RN-11).
  Referenciada como fonte da fórmula que RN-34 usa como teto; a fórmula em si não é recontada aqui.
- Protótipo funcional no Claude Design (`Orcamento Familiar.dc.html` / Desktop), tela `metas` —
  fonte da lista de cofrinhos, do subtítulo _"Guardar sai do não alocado do mês"_ e dos botões
  _Guardar 100_/_Guardar 500_ que **não** se copiam ([EF-07 §4](../../../../docs/especificacoes/EF-07-metas.md)).
  A conta única "Poupança" com três metas do mockup é citada só para registrar a armadilha que D3
  rejeita — **não é fonte de estrutura de dados** desta skill.
