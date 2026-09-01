---
name: negocio-faturas-e-ciclo-do-cartao
tipo: negocio # tipo 3 — conhecimento de NEGÓCIO/domínio
projeto: orcamento
dominio: faturas e ciclo do cartão — quando uma compra vira fatura, quando a fatura vira saldo
aplica-se-a: [orcamento]
status: ativa
revisao: por-mudanca-de-regra
---

# Negócio — faturas e ciclo do cartão

> **Skill de Negócio (tipo 3).** O conhecimento do NEGÓCIO que suporta a **especificação**. É o
> que faz o agente de Requirements/PO escrever specs corretas e o Dev não violar regra de domínio.
> Não é sobre código — é sobre _o que o cliente faz e as regras que o regem_.

## O que é o negócio (em 3 linhas)

Todo cartão de crédito organiza suas compras em **ciclos** que não coincidem com o mês civil: um
ciclo abre, acumula compras, fecha numa data fixa e vira uma **fatura** que vence dias depois. Este
módulo decide **em qual fatura uma compra cai** e **o que acontece quando a fatura é paga** — ele
não decide se a compra cabia no orçamento (isso é da `lancamentos-e-parcelamento`, RN-18) nem
quanto a família pode gastar de verdade (isso é da `contas-e-lastro`, que **consome** o resultado
deste módulo). Errar o ciclo aqui propaga erro para o lastro inteiro — é por isso que esta skill
existe antes do código.

## Atores / personas

| Ator   | Quem é                        | O que faz no sistema                                                                                        | Restrições                                                                             |
| ------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Membro | pessoa com login numa família | vê a fatura do ciclo corrente e a(s) anterior(es) em aberto, paga a fatura escolhendo a conta pagadora      | só enxerga e paga fatura de cartão da própria família                                  |
| App    | o guarda do ciclo             | calcula em qual fatura uma compra cai, fecha o ciclo na data certa, registra o pagamento como transferência | leitura/derivação para o cálculo do ciclo; o pagamento em si é ato explícito do membro |

## Glossário do domínio (a linguagem ubíqua)

> Todo nome de código, tela e evento deve usar estes termos — não sinônimos técnicos. Termos já
> fixados pelas skills irmãs (`conta`, `limite`, `competência`, `caixa`, `transferência`) são
> **referenciados**, não redefinidos — ver `../contas-e-lastro/SKILL.md` e
> `../lancamentos-e-parcelamento/SKILL.md`.

| Termo                               | Definição precisa                                                                                                                                                                                                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fatura                              | entidade `cartão × ciclo` — **não** é soma calculada na hora. Guarda `abreEm`, `fechaEm`, `venceEm`, `status`, `pagaEm`, `pagaComContaId`. [EF-05 §1](../../../../docs/especificacoes/EF-05-faturas.md)                                                                 |
| Ciclo                               | o período entre um fechamento e o próximo; **não é o mês civil**. Cada cartão tem seu próprio ciclo, definido por `diaFechamento` (1–28, [EF-02](../../../../docs/especificacoes/EF-02-contas.md) RN-08). Ver EXTRACOES — é prática de mercado, sem norma que a defina. |
| `abreEm`                            | primeiro dia do ciclo: o dia seguinte ao `fechaEm` do ciclo anterior do mesmo cartão.                                                                                                                                                                                   |
| `fechaEm`                           | dia em que o ciclo encerra e a fatura passa a ter total fechado — cai no dia `diaFechamento` do mês do ciclo.                                                                                                                                                           |
| `venceEm`                           | dia em que a fatura deve ser paga — a **primeira ocorrência** do dia `diaVencimento` **estritamente depois** de `fechaEm` (ver §"Abre, fecha, vence" abaixo para o porquê disso resolver sozinho o caso "vencimento e fechamento no mesmo dia do mês").                 |
| `status` da Fatura                  | `ABERTA` (ciclo corrente, ainda acumulando) → `FECHADA` (ciclo encerrado, aguardando pagamento) → `PAGA` (quitada). **Cuidado de nomenclatura:** o valor de enum `ABERTA` **não é** o mesmo conceito que o termo de negócio "fatura em aberto" abaixo — ver D1.         |
| Fatura em aberto (termo de negócio) | **toda fatura com `status` ≠ `PAGA`** — ou seja, `ABERTA` **mais** `FECHADA`. Definição fixada pela decisão humana **D1** (2026-08-28, ver seção própria). Não confundir com o valor de enum `ABERTA` sozinho.                                                          |
| Saldo do cartão (exibido)           | soma dos totais de **todas** as faturas em aberto (D1) do cartão — a fechada aguardando pagamento **mais** o total acumulado até agora no ciclo corrente. RN-25.                                                                                                        |
| Pagar a fatura                      | ato do membro: escolhe uma conta pagadora e confirma. Gera um lançamento `TRANSFERENCIA` (conta pagadora → cartão) e marca a `Fatura` como `PAGA`, com `pagaEm` e `pagaComContaId`. **Não** reatribui os lançamentos originais. RN-24.                                  |
| Extrato filtrado por cartão         | a lista de lançamentos que têm aquele cartão como `contaId` — precisa continuar correta **depois** do pagamento, porque os lançamentos originais nunca trocam de conta (RN-24). [EF-05 §4](../../../../docs/especificacoes/EF-05-faturas.md)                            |
| Limite livre                        | termo da skill irmã `contas-e-lastro`: `limite − fatura em aberto`. Referenciado aqui só para deixar explícito que o "fatura em aberto" que entra nessa fórmula é a definição de D1, não uma leitura estreita de "só o ciclo corrente". RN-26.                          |

## Regras de negócio (as invioláveis)

> Numeradas para rastrear na spec e no teste. Cada regra vira critério de aceite e edge case.

| #     | Regra                                                                                                | Onde é imposta                 | Origem (lei/norma/decisão)                                                                                                                                                                                               |
| ----- | ---------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RN-23 | A compra entra na fatura cujo **ciclo de fechamento** contém a data da compra — nunca o mês civil    | serviço de fatura, na escrita  | [EF-05 §2](../../../../docs/especificacoes/EF-05-faturas.md); [EF-02](../../../../docs/especificacoes/EF-02-contas.md) RN-08 para os campos. **Mecânica em si é prática de mercado — sem norma citável** (ver EXTRACOES) |
| RN-24 | Pagar é **transferência**: os lançamentos originais **mantêm** sua conta de origem (o cartão)        | `POST /faturas/:id/pagar`      | [EF-05 §2/§4](../../../../docs/especificacoes/EF-05-faturas.md) — decisão de modelagem deste produto                                                                                                                     |
| RN-25 | O saldo exibido do cartão é a **fatura em aberto** — redefinida por **D1** como toda fatura não paga | leitura                        | [EF-05 §2](../../../../docs/especificacoes/EF-05-faturas.md) mockup + **decisão humana D1** (2026-08-28) — ver seção própria                                                                                             |
| RN-26 | O **limite livre** do cartão é `limite − fatura em aberto` (mesma definição de D1)                   | leitura; consumida pelo lastro | [EF-06 §2](../../../../docs/especificacoes/EF-06-lastro.md) RN-26/RN-28 + **decisão humana D1**                                                                                                                          |

### D1 · "fatura em aberto" — decisão humana (2026-08-28)

> **"Fatura em aberto" = TODA fatura não paga** — a fechada aguardando pagamento **mais** a do
> ciclo corrente. O limite livre só se recompõe **no pagamento** (RN-24), nunca no fechamento.

Isto desempata uma ambiguidade real e verificada entre duas fontes que usam a mesma expressão com
escopos diferentes:

- [EF-05 §2](../../../../docs/especificacoes/EF-05-faturas.md), RN-25: _"o saldo do cartão é a
  fatura em aberto **do ciclo corrente**"_ — leitura estreita, só o que está acumulando agora.
- [EF-06 §2](../../../../docs/especificacoes/EF-06-lastro.md) / RN-26: `limiteLivre = limite −
fatura em aberto` — sem qualificar "do ciclo corrente", e o próprio texto da EF-06 já fala em
  "fatura em aberto" no sentido amplo de dívida pendente.

**D1 resolve a favor do escopo amplo.** Consequência a registrar: o **saldo exibido do cartão**
passa a ser "tudo que não foi pago" (fatura fechada aguardando pagamento **mais** o total corrente
do ciclo aberto), não apenas o ciclo corrente isolado. A redação de RN-25 em
[EF-05 §2](../../../../docs/especificacoes/EF-05-faturas.md) e do item correspondente do DoD em
[EF-05 §5](../../../../docs/especificacoes/EF-05-faturas.md) ("o limite livre reflete a fatura em
aberto do ciclo corrente") ficam **superadas em escopo** por D1 — esta skill registra a superação;
não é desta tarefa editar a EF (fora do escopo desta pasta).

**Por que isto importa:** sem esta decisão, o lastro contaria como gastável o dinheiro de uma
fatura **já fechada e ainda não paga** — que é exatamente o "errar o ciclo erra o lastro" que a
EF-05 anuncia em sua abertura. Uma fatura fechada não paga ainda consome limite do cartão até ser
quitada; só contá-la pelo ciclo corrente devolveria esse limite prematuramente, no fechamento, em
vez de no pagamento (RN-24).

**Cuidado de nomenclatura para quem for implementar:** o valor de enum `status = ABERTA` (o ciclo
que ainda está acumulando) **não é sinônimo** do termo de negócio "fatura em aberto" fixado por D1.
Uma fatura `FECHADA` (aguardando pagamento) também está "em aberto" no sentido de D1. Uma soma que
filtrar só `status = 'ABERTA'` implementa a leitura estreita de RN-25 (a que D1 rejeitou), não a
correta. Este é exatamente o tipo de colisão de nomes que produz implementação divergente.

**Nota, fora de escopo desta skill:** o mockup e a decisão de tela **D2** (mostrar as duas faturas
— fechada e corrente — na tela) são coerentes com esta leitura ampla, mas são decisão de UI de
outra tarefa; não é regra de negócio e não é recontada aqui além desta observação.

## Abre, fecha, vence — como os três campos produzem um ciclo concreto

Fonte dos dois campos base: [EF-02 §1](../../../../docs/especificacoes/EF-02-contas.md), RN-08 —
`diaFechamento` e `diaVencimento` existem só em `CREDITO`, e valem **1–28** (a faixa evita o dia
29–31, que não existe em todo mês). O que segue é a derivação lógica de `abreEm`/`fechaEm`/
`venceEm` a partir desses dois campos — não é norma externa, é a mecânica que este produto usa
para os cumprir; nenhuma fonte lida contradiz esta derivação, e nenhuma fonte a formaliza melhor
do que a definição direta abaixo.

- **`fechaEm` do ciclo que contém uma data `d`:** se o dia-do-mês de `d` for **menor ou igual** a
  `diaFechamento`, o ciclo fecha no `diaFechamento` **daquele mesmo mês**. Se for **maior**, o
  ciclo fecha no `diaFechamento` do **mês seguinte**. É exatamente RN-23: a comparação decide em
  qual fatura a compra cai, nunca o mês civil da compra.
- **`abreEm`:** o dia seguinte ao `fechaEm` do ciclo anterior do mesmo cartão. Para o **primeiro**
  ciclo de um cartão recém-cadastrado não há "ciclo anterior" — nenhuma fonte lida define o corte
  inicial (data de cadastro? primeira compra?); isto fica como **lacuna**, não inventada aqui.
- **`venceEm`:** a **primeira ocorrência** do dia `diaVencimento` estritamente **depois** de
  `fechaEm`. Como `diaFechamento` e `diaVencimento` são ambos 1–28: se `diaVencimento >
diaFechamento`, `venceEm` cai no **mesmo mês** de `fechaEm`; caso contrário (`diaVencimento ≤
diaFechamento`, inclusive quando são iguais), `venceEm` cai no **mês seguinte**. Esta regra
  simples resolve os dois casos sem exceção — nenhuma fonte contradiz, e é a única forma de nunca
  produzir um vencimento no mesmo dia ou antes do fechamento.

### Os três casos obrigatórios do DoD (EF-05 §5)

- **Compra no dia do fechamento** — dia-do-mês da compra **igual** a `diaFechamento`: pela regra
  acima ("menor ou igual"), cai no ciclo que fecha **hoje**, na fatura que está prestes a fechar,
  não na próxima.
- **Compra no dia seguinte ao fechamento** — dia-do-mês estritamente maior: cai no ciclo que fecha
  no **mês seguinte**, isto é, na próxima fatura. É o caso que o protótipo erra ao somar o mês
  civil (ver [EF-05 §4](../../../../docs/especificacoes/EF-05-faturas.md)).
- **Parcela que atravessa ciclos** — cada parcela de uma `SerieParcelas` tem sua própria `data`
  ([lancamentos-e-parcelamento](../lancamentos-e-parcelamento/SKILL.md), RN-20). O ciclo de cada
  parcela é resolvido **independentemente**, pela mesma regra acima aplicada à data daquela
  parcela — exatamente como aquela skill já registra para a competência ("a competência de cada
  parcela é calculada independentemente, mês + N, sem tratamento especial"). Não há lógica
  especial de "série atravessando ciclo": cada parcela é, para efeito de fatura, uma compra comum
  na sua própria data.

## Pagar é transferência (RN-24) — por que reatribuir corromperia o extrato

[EF-05 §4](../../../../docs/especificacoes/EF-05-faturas.md) marca isto como uma das **duas
piores armadilhas** do protótipo: _"Pagar a fatura reatribui os lançamentos do cartão para a conta
corrente. Depois disso ninguém sabe que a compra foi no cartão — o extrato filtrado por cartão
passa a mentir."_

Decompondo o porquê, no mesmo espírito de RN-17 (transferência não é despesa) da skill irmã
`lancamentos-e-parcelamento`:

- **O lançamento original é o registro histórico do que aconteceu** — a compra foi feita no
  cartão, na data da compra ([lancamentos-e-parcelamento](../lancamentos-e-parcelamento/SKILL.md)
  RN-18/RN-19: a compra consome a categoria na data da compra, e **não move o saldo da conta**
  até a fatura ser paga). Reatribuir a conta depois do pagamento reescreveria esse histórico.
- **O pagamento é um evento separado, em uma data separada** — a `Fatura` guarda `pagaEm` e
  `pagaComContaId` exatamente para registrar **quando** e **com qual conta** ela foi quitada, sem
  apagar o **onde** cada compra ocorreu.
- **O extrato filtrado por cartão é a prova de auditoria do produto**: se reatribuir, o extrato do
  cartão perde as compras já pagas, e o extrato da conta pagadora ganha compras que nunca ocorreram
  nela — a família não consegue mais responder "quanto gastei neste cartão este ano".

O pagamento em si segue a mecânica de transferência já fixada pela skill irmã: sem `categoriaId`,
sem tocar teto nenhum ([orcamento-por-envelope](../orcamento-por-envelope/SKILL.md) não é afetada),
e com efeito direto no lastro — o caixa real da conta pagadora cai, e o limite livre do cartão sobe
(a fatura paga sai da soma de "fatura em aberto" de D1). Essa segunda parte — como o pagamento
recompõe o lastro — é regra da skill `contas-e-lastro`, só apontada aqui, não recontada.

## Fronteiras — o que esta skill NÃO decide

- **`contas-e-lastro`** é dona da fórmula do lastro, do caixa real e da agregação `limiteLivre =
Σ(limite − fatura em aberto)` **entre todos os cartões** (RN-27/RN-28). Esta skill fornece o
  valor de "fatura em aberto" **de um cartão** (RN-25/RN-26, com o escopo de D1); a soma entre
  cartões e a combinação com caixa real são da skill irmã — não recontadas aqui.
- **`lancamentos-e-parcelamento`** é dona da **competência** (RN-15 a RN-22) — qual mês de
  orçamento uma compra consome. Essa skill já delega explicitamente "quando o saldo da conta se
  move" a esta EF (RN-19). **Competência e ciclo de fatura são eixos independentes** que podem
  divergir: uma compra em 28/agosto com `diaFechamento = 25` consome o teto de **agosto** (RN-18,
  pela data da compra), mas cai na fatura cujo ciclo fecha em 25 de **setembro** — a competência
  não segue o ciclo do cartão, e o ciclo do cartão não segue o mês civil (RN-23). As duas datas só
  coincidem por acaso, nunca por regra.
- **Financiamento com juros** (Price, SAC, CET, IOF) — coberto por
  [`preator/conhecimento/negocio/financeiro/credito`](../../../../preator/conhecimento/negocio/financeiro/credito/SKILL.md),
  que é sobre **empréstimo com juros**. O ciclo de fatura deste produto **não tem parcela de
  juros nem amortização** — é só a data em que compras já feitas se consolidam em um total a
  pagar. Nenhuma mecânica daquela skill se aplica aqui, nem por analogia.

## Regulação / compliance (o que a lei/norma exige)

- **Não há norma do BCB/CMN encontrada que defina o ciclo de fechamento ou diga em qual fatura uma
  compra entra (RN-23)** — é prática de mercado, verificada e registrada em
  [EXTRACOES/normas-fatura-cartao.md](EXTRACOES/normas-fatura-cartao.md). Não apresentar isto como
  norma em nenhuma spec ou comentário de código que citar esta skill.
- **Resolução BCB nº 96/2021, art. 6º-A** (incluído pela Resolução BCB nº 365/2023) — direito do
  cliente a ao menos três datas de vencimento com diferença mínima de 7 dias entre elas. Norma
  real, mas **tangencial**: regula a multiplicidade de datas ofertadas pelo emissor, não a
  mecânica de "qual fatura recebe a compra" nem a existência de um único `diaVencimento` por
  cartão neste produto. Ver EXTRACOES para o texto completo da checagem.
- **Dinheiro em centavos** — `limiteCentavos` e os totais de `Fatura` são inteiros na pilha toda.
  Ver [D-06](../../../../docs/decisoes/D-06-dinheiro-em-centavos.md). Este módulo não introduz
  nenhuma divisão nova (não há rateio nem parcelamento aqui); a exigência é apenas nunca
  representar valor de fatura em ponto flutuante.
- **Isolamento entre famílias** — nenhuma `Fatura` ou pagamento expõe dado de uma família a
  outra, em REST e em WebSocket (mesma exigência transversal do produto, ver `.preator/CONTEXT.md`).

## Processos / fluxos principais

1. **Uma compra no cartão é registrada** (ato da EF-04, fora desta skill) — o serviço de fatura
   calcula, na escrita, em qual `Fatura` (existente ou a ser criada) a compra cai, pela regra de
   RN-23 aplicada à `data` do lançamento.
2. **O ciclo fecha** — na data `fechaEm`, a `Fatura` passa de `ABERTA` para `FECHADA`; o total já
   está consolidado; o limite do cartão continua reduzido por ela (D1: fechar não libera limite).
3. **O membro vê a fatura** — tela de fatura mostra total, datas do ciclo, limite livre e itens
   ([EF-05 §3](../../../../docs/especificacoes/EF-05-faturas.md)); o saldo do cartão exibido soma
   todas as faturas em aberto (D1), não só a corrente.
4. **O membro paga** — escolhe conta pagadora, confirma; gera `TRANSFERENCIA` (conta pagadora →
   cartão), marca a `Fatura` como `PAGA` com `pagaEm`/`pagaComContaId` (RN-24); o limite livre do
   cartão sobe porque essa fatura sai da soma de "em aberto" (D1); o lastro (skill irmã) recalcula.
5. **O extrato por cartão continua correto** — porque nenhum lançamento original mudou de conta
   (RN-24).

## Casos de uso principais

| UC    | Ator   | Objetivo                                                                    | Regras envolvidas |
| ----- | ------ | --------------------------------------------------------------------------- | ----------------- |
| UC-01 | App    | Decidir em qual fatura uma compra recém-lançada cai                         | RN-23             |
| UC-02 | Membro | Ver o total e as datas do ciclo corrente e da fatura anterior em aberto     | RN-25, D1         |
| UC-03 | Membro | Pagar a fatura escolhendo a conta de origem, sem perder o extrato do cartão | RN-24             |
| UC-04 | App    | Recompor o limite livre do cartão só quando a fatura é de fato paga         | RN-26, D1         |

## Edge cases e exceções do domínio

- **Compra no dia exato do fechamento** — cai no ciclo que fecha hoje (regra "menor ou igual"),
  não no seguinte. É o primeiro caso obrigatório do DoD ([EF-05 §5](../../../../docs/especificacoes/EF-05-faturas.md)).
- **Compra no dia seguinte ao fechamento** — cai no ciclo seguinte. Segundo caso obrigatório do DoD.
- **`diaFechamento` igual a `diaVencimento`** — pela regra de `venceEm` ("estritamente depois"), o
  vencimento cai no mês seguinte inteiro, dando quase um mês para pagar. Nenhuma fonte lida proíbe
  essa combinação nem define um mínimo de dias entre fechamento e vencimento para este produto
  (distinto da Resolução BCB nº 96/2021, que regula quantidade de opções de vencimento, não o
  intervalo mínimo entre fechamento e vencimento) — consequência da fórmula, não regra à parte.
- **Primeiro ciclo de um cartão recém-cadastrado** — não há `fechaEm` anterior para calcular
  `abreEm`. Nenhuma fonte lida (EF-02, EF-05) define o corte inicial. **Lacuna registrada, não
  inventada** — fica para quem construir o serviço de fatura decidir com o humano se necessário.
- **Fatura em aberto com duas faturas simultâneas** — o cenário central de D1: uma `FECHADA`
  aguardando pagamento e uma `ABERTA` acumulando ao mesmo tempo. Exemplo numérico: fatura de julho
  fechou em R$ 800 e está `FECHADA` (não paga); a fatura de agosto já acumulou R$ 300 e está
  `ABERTA`. O saldo exibido do cartão (RN-25) é R$ 1.100 — a soma das duas —, não R$ 300 (só a
  corrente). Se o limite do cartão é R$ 2.000, o limite livre (RN-26) é R$ 900, não R$ 1.700.
- **Pagamento parcial de uma fatura** — nenhuma fonte lida (EF-05) descreve pagamento parcial; o
  campo `pagaComContaId` e o fluxo descrito assumem quitação integral em um único ato. Não
  inventado aqui — se o produto precisar de pagamento parcial, é pergunta nova para o humano.
- **Excluir/editar uma parcela cuja fatura já fechou ou já foi paga** — a skill irmã
  `lancamentos-e-parcelamento` já registra que "as fontes lidas não relacionam exclusão de série
  com o estado da fatura"; esta skill confirma o mesmo do lado da fatura — nenhuma fonte define o
  que acontece ao total de uma `Fatura` já `FECHADA` ou `PAGA` se uma parcela nela incluída for
  excluída depois. Lacuna registrada em ambas as skills, não resolvida aqui.

## Fontes do conhecimento

- [docs/especificacoes/EF-05-faturas.md](../../../../docs/especificacoes/EF-05-faturas.md) — EF
  que define `Fatura`, RN-23 a RN-26, e a armadilha do protótipo (reatribuição de lançamentos e
  soma pelo mês civil). Fonte primária desta skill.
- [docs/especificacoes/EF-02-contas.md](../../../../docs/especificacoes/EF-02-contas.md) — fonte
  de `diaFechamento`/`diaVencimento` e RN-08 (faixa 1–28), já implementados em
  `api/src/db/schema.ts` (conferido: `diaFechamento`/`diaVencimento` existem, restritos a 1–28,
  só em contas `CREDITO`). A derivação de `abreEm`/`fechaEm`/`venceEm` desta skill é construída
  sobre esses dois campos.
- [docs/especificacoes/EF-06-lastro.md](../../../../docs/especificacoes/EF-06-lastro.md) §2 — a
  ponte: `limiteLivre = Σ(limite − fatura em aberto)`. Fonte de RN-26 e do segundo lado da
  ambiguidade que D1 resolve.
- [docs/decisoes/D-06-dinheiro-em-centavos.md](../../../../docs/decisoes/D-06-dinheiro-em-centavos.md)
  — ADR aceita que decide que dinheiro é inteiro em centavos na pilha toda.
- **Decisão humana D1** (2026-08-28, registrada na issue #69 da história #19) — fecha a
  ambiguidade de escopo de "fatura em aberto" entre RN-25 e RN-26/EF-06 §2. Ver seção própria
  acima. Não há outra fonte para D1 além do próprio registro da decisão.
- [EXTRACOES/normas-fatura-cartao.md](EXTRACOES/normas-fatura-cartao.md) — rastreabilidade da
  pesquisa de normas do BCB/CMN sobre fatura de cartão: confirma que RN-23 (a mecânica do ciclo)
  não tem norma citável, e que a única norma real encontrada sobre o tema (Resolução BCB nº
  96/2021, art. 6º-A) é tangencial (multiplicidade de datas de vencimento, não o ciclo em si).
- [`.preator/skills/negocio/contas-e-lastro/SKILL.md`](../contas-e-lastro/SKILL.md) — skill irmã,
  dona do lastro, caixa real e da agregação de `limiteLivre` entre cartões. Referenciada para a
  fronteira; não recontada.
- [`.preator/skills/negocio/lancamentos-e-parcelamento/SKILL.md`](../lancamentos-e-parcelamento/SKILL.md)
  — skill irmã, dona da competência (RN-15 a RN-22) e da distinção competência × caixa. Fonte de
  RN-18/RN-19, referenciadas aqui para explicar por que competência e ciclo de fatura são eixos
  independentes. Referenciada; não recontada.
- [`preator/conhecimento/negocio/financeiro/credito/SKILL.md`](../../../../preator/conhecimento/negocio/financeiro/credito/SKILL.md)
  — skill agnóstica da fábrica, de crédito **com juros** (Price/SAC/CET/IOF). Citada só para
  registrar que **não se aplica**: o ciclo de fatura deste produto não tem juros nem amortização.
- Protótipo funcional no Claude Design: `Orcamento Familiar.dc.html` e Desktop, tela `fatura`. A
  lógica visual é derivada dali, com as ressalvas de
  [EF-05 §4](../../../../docs/especificacoes/EF-05-faturas.md) sobre o que não se copia (o
  protótipo reatribui lançamentos ao pagar, e soma pelo mês civil — os dois erros que esta EF e
  esta skill existem para evitar).
