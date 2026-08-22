# Domínio — orçamento familiar por envelope

> Este documento é o dono do **modelo e da linguagem**. Todo nome de tabela, endpoint, componente
> e evento sai daqui. Regra numerada mora em [REGRAS-DE-NEGOCIO.md](REGRAS-DE-NEGOCIO.md);
> convenção de código, em [PADROES.md](PADROES.md).

---

## O modelo mental

Não é um app de categorizar gastos. É **orçamento por envelope**: no começo do mês a família
distribui o dinheiro em categorias com teto, e cada gasto consome o teto da sua categoria.
A pergunta que o app responde não é *"quanto gastei?"*, é *"quanto ainda posso gastar?"*.

Sobre isso vem a camada que dá identidade ao produto: o **lastro**.

---

## Glossário (linguagem ubíqua)

| Termo | Definição precisa |
|---|---|
| **Família** | Unidade de isolamento. Todo dado pertence a exatamente uma. É o *tenant*. |
| **Membro** | Pessoa com login dentro de uma família. |
| **Competência** | O mês do orçamento, no formato `AAAA-MM`. Não confundir com a data do lançamento. |
| **Categoria** | Envelope de gasto. Tem nome, ícone e cor — **não tem valor**. |
| **Teto** | Quanto uma categoria pode gastar **numa competência**. Vive no par categoria × mês. |
| **Gasto** | Soma dos lançamentos de despesa da categoria na competência. |
| **Disponível** | `teto − gasto`. Negativo significa que a categoria **estourou**. |
| **Planejado** | Soma de todos os tetos da competência. |
| **Recebido** | Soma das receitas efetivamente lançadas na competência. |
| **Previsto** | Renda que a família *espera* receber no mês. Referência de planejamento — não move teto. |
| **Não alocado** | `recebido − planejado`. Quando negativo, a tela chama de *falta cobrir*. |
| **Lastro** | Dinheiro que existe de verdade para bancar o plano. Ver abaixo. |
| **Déficit** | Quanto do plano **não** tem lastro. |
| **Bloqueado** | A parte do teto de uma categoria que o déficit tornou indisponível. |
| **Liberado** | `disponível − bloqueado`. É o número que a família pode gastar hoje. |
| **Remanejar** | Mover teto de uma categoria para outra, **só na competência corrente**. |
| **Fatura** | Conjunto de lançamentos de um cartão dentro de um ciclo de fechamento. |
| **Ciclo** | Intervalo entre dois fechamentos do cartão. Define em qual fatura a compra cai. |
| **Meta** | Objetivo de poupança com alvo e acumulado. |
| **Reserva** | Conta cujo dinheiro está comprometido com metas. Fora do orçamento e fora do lastro. |
| **Fechar o mês** | Selar a competência. Não move dinheiro. |

> **Não use sinônimos técnicos.** É *teto*, não `limit`. É *lançamento*, não `transaction`.
> É *competência*, não `period`. A linguagem da tela e a do código são a mesma.

---

## O lastro

O conceito central do produto, e a razão de ele existir.

Um orçamento comum deixa a família planejar R$ 8.000 tendo R$ 3.000 em caixa. O plano fica
bonito e falha na terceira semana. Este app se recusa a fazer isso: calcula quanto do plano
tem respaldo real e **bloqueia o resto**.

```
caixaReal      = Σ max(0, saldo) das contas de DÉBITO
limiteLivre    = Σ (limite − fatura em aberto) dos CARTÕES
lastro         = caixaReal + limiteLivre

restanteTotal  = Σ max(0, teto − gasto) das categorias
déficit        = max(0, restanteTotal − lastro)

por categoria:
  bloqueado    = disponível × déficit / restanteTotal      ← rateio pró-rata
  liberado     = disponível − bloqueado
```

Três decisões embutidas, cada uma deliberada:

**A reserva fica de fora.** O dinheiro da poupança está comprometido com as metas. Contá-lo como
lastro seria deixar a família gastar a reserva de emergência sem perceber.

**O limite do cartão entra.** É dinheiro disponível para gastar neste mês, mesmo que a conta
chegue depois. Ignorá-lo tornaria o bloqueio pessimista demais para ser útil.

**O rateio é proporcional, não por prioridade.** Categoria maior perde mais em valor absoluto,
mas todas perdem a mesma fração. Não existe categoria privilegiada — se a família quiser
priorizar, ela **remaneja**, que é um ato consciente.

### O corolário: desbloqueio automático

Quando entra dinheiro, `caixaReal` sobe, o lastro sobe, o déficit cai e o bloqueado encolhe.
**Nenhum teto muda de valor** — o que muda é quanto do teto está liberado.

É isso que a tela quer dizer com *"os tetos se ajustam sozinhos ao que entrou"*. Não é um
aumento automático de teto: é desbloqueio. Ver [RN-ORC-004](REGRAS-DE-NEGOCIO.md).

---

## Entidades

| Entidade | Papel | Notas |
|---|---|---|
| `Familia` | Tenant. Raiz de todo isolamento. | O `familiaId` deriva do token, nunca do request |
| `Membro` | Usuário dentro de uma família. | Autor imutável de cada lançamento |
| `Convite` | Email, token, expiração, uso único. | Ver RN-CVT-001..003 |
| `Conta` | `DEBITO` · `CREDITO` · `RESERVA` | Cartão tem limite, dia de fechamento e de vencimento |
| `Categoria` | Nome, ícone, cor. | **Sem valor** — o teto não mora aqui |
| `OrcamentoMes` | Categoria × competência × teto. | A tabela que torna o remanejo mensal possível |
| `Lancamento` | `RECEITA` · `DESPESA` · `TRANSFERENCIA` | Valor em centavos; data e competência são campos distintos |
| `Fatura` | Cartão × ciclo. | Status, pago em, pago por qual conta |
| `Remanejamento` | Origem, destino, valor, competência, autor. | Histórico auditável de quem mexeu no teto |
| `Meta` | Alvo, acumulado, conta reserva vinculada. | |
| `FechamentoMes` | Competência, sobra apurada, quando fechou. | Não move dinheiro |

### Por que o teto não fica na categoria

Porque remanejar altera o teto **só do mês corrente**. Se o teto fosse atributo da categoria,
remanejar em agosto mudaria setembro também — e o histórico de agosto seria reescrito toda vez
que alguém ajustasse o mês seguinte. `OrcamentoMes` existe por isso.

### Por que transferência é um tipo de lançamento

Porque **pagar fatura** e **guardar em meta** são, os dois, movimento entre contas. Sem o tipo,
os dois viram despesa — e transferência contada como despesa é o erro que destrói a confiança
num app de orçamento: a família vê "gastei R$ 3.000 este mês" quando na verdade moveu o próprio
dinheiro de lugar.

---

## Os fluxos que importam

**Compra no crédito.** Consome a categoria na data da compra, entra na fatura do ciclo
correspondente e **não move o saldo da conta**. O saldo só muda quando a fatura é paga.
É competência × caixa, e é a fonte de confusão mais comum em app de finanças.

**Compra parcelada.** Gera N lançamentos, um por competência futura. Só a primeira parcela pesa
no mês corrente. O resíduo de arredondamento vai para a última parcela, de modo que a soma das
parcelas seja exatamente o total.

**Lançamento retroativo.** Data em mês anterior não consome o teto do mês corrente — a
competência segue a data, não o dia do registro.

**Fechar o mês.** Sela a competência e apura a sobra. A sobra **fica onde está**, em conta
corrente. Como está em caixa, ela entra no lastro do mês seguinte: um mês contido amplia o
teto liberado do próximo sem ninguém mexer em teto nenhum.
