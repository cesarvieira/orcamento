# ADR-004 — Fechar o mês mantém a sobra em conta

- **Status:** aceita
- **Data:** 2026-08-22
- **Decisor:** Cesar Vieira
- **Regras que gera:** RN-FEC-001, RN-FEC-002

## Contexto

No mockup, o botão de fechamento diz *"Fechar mês e guardar a sobra"* e o aviso de sucesso diz
que o valor foi *"movido para a Reserva"*. Ou seja, fechar o mês era também um movimento
automático de dinheiro.

## Decisão

**Fechar o mês apenas sela a competência.** Apura a sobra e registra o fechamento. **A sobra
permanece na conta corrente.**

Guardar dinheiro continua sendo ato deliberado, feito pela tela de metas.

## Justificativa

Fechar o mês é uma operação de **contabilidade**; guardar é uma operação de **caixa**. Juntar as
duas num botão faz o app mover dinheiro sem que a família tenha pedido — e movimento automático
de dinheiro é exatamente o tipo de comportamento que quebra a confiança num app financeiro.

Há também um efeito colateral positivo, e ele é elegante: como a sobra fica em caixa, ela entra
no **lastro do mês seguinte** (RN-FEC-002). Um mês contido amplia o teto liberado do mês
seguinte — automaticamente, sem que ninguém mexa em teto nenhum, e pelo mesmo mecanismo de
desbloqueio do ADR-002.

Se a sobra fosse para a reserva, ela sairia do lastro (RN-LAS-001) e o efeito seria o oposto:
economizar apertaria o mês seguinte. Contraintuitivo e desmotivador.

## Consequências

- **Duas frases da tela ficam incorretas** e mudam junto com a fatia de fechamento: o botão passa
  a ser *"Fechar mês"* e o aviso de sucesso perde a menção à reserva.
- Fechamento não gera lançamento. `FechamentoMes` registra competência, sobra apurada e data.
- A competência selada não aceita novo lançamento — o que dá ao retroativo (RN-LAN-001) um limite
  claro: pode-se lançar em mês anterior **aberto**, não em mês fechado.
