# ADR-003 — Ciclo real de fatura no MVP

- **Status:** aceita
- **Data:** 2026-08-22
- **Decisor:** Cesar Vieira
- **Regras que gera:** RN-CAR-001..004

## Contexto

O mockup pede o dia de fechamento e o dia de vencimento ao cadastrar um cartão, guarda os dois —
e depois **não usa nenhum dos dois**. O cálculo da fatura soma todos os lançamentos do cartão no
mês civil.

Além disso, ao pagar a fatura o protótipo debita a conta corrente **e reatribui todos os
lançamentos do cartão para ela**. Depois disso não há como saber que a compra foi no cartão: o
histórico é reescrito.

Era preciso decidir se o MVP simplifica (mês civil, como no protótipo) ou implementa o ciclo real.

## Decisão

**Ciclo real, no MVP.** A compra entra na fatura cujo intervalo de fechamento contém a data.

**`Fatura` é entidade de primeira classe** — cartão × ciclo, com status, data de pagamento e a
conta que pagou.

**Pagar a fatura é uma transferência** entre a conta pagadora e o cartão. Os lançamentos
originais **mantêm** sua conta de origem, sempre.

## Alternativa considerada

**Mês civil no MVP, ciclo real depois.** Descartada. O valor de um app de orçamento familiar
está em bater com a realidade — e a fatura do cartão é justamente onde a família confere. Um
app que diz um número e o banco diz outro perde a confiança na primeira conferência, e não há
como recuperá-la depois.

Além disso, migrar de mês civil para ciclo real depois exigiria reprocessar o histórico de
faturas — retrabalho maior que fazer certo desde o início.

## Consequências

- **É a fatia de maior risco técnico do plano.** Compra no dia da virada de ciclo é o caso de
  teste que precisa existir, junto com: compra após o fechamento (cai na fatura seguinte),
  fechamento em dia que não existe no mês (dia 30 em fevereiro) e parcela que atravessa ciclos.
- O saldo do cartão exibido é a **fatura em aberto do ciclo corrente**, não a soma de tudo que
  já se gastou no cartão.
- O `limiteLivre` que alimenta o lastro depende da fatura em aberto — logo, depende do ciclo.
  Errar o ciclo erra o lastro.
- Como o lançamento mantém a conta de origem, o extrato filtrado por cartão continua correto
  depois do pagamento — o que o protótipo perdia.
