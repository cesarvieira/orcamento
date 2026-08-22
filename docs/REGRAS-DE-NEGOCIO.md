# Regras de negócio

> Numeradas para rastrear da especificação até o teste. **Cada regra vira critério de aceite e
> caso de teste de integração.** Se uma regra não tem teste, ela não está implementada — está
> apenas escrita.
>
> Origem: extraídas do mockup `Orcamento Familiar.dc.html` e das decisões em [decisoes/](decisoes/).
> O mecanismo universal de orçado × realizado vem de
> `preator/conhecimento/negocio/financeiro/controladoria-orcamento`; o de parcelamento, de
> `preator/conhecimento/negocio/financeiro/credito`.

---

## Orçamento

| # | Regra | Origem |
|---|---|---|
| **RN-ORC-001** | O teto pertence ao par **categoria × competência**, nunca à categoria. Remanejar altera só o mês corrente. | mockup: *"o teto muda só neste mês"* |
| **RN-ORC-002** | `disponível = teto − gasto`. Negativo significa que a categoria **estourou** e é exibido como tal. | mockup |
| **RN-ORC-003** | `planejado = Σ tetos`. `não alocado = recebido − planejado`; quando negativo, o rótulo passa a *falta cobrir*. | mockup |
| **RN-ORC-004** | Renda acima da prevista **não altera teto nenhum**. O único ajuste automático é o desbloqueio: mais lastro reduz o bloqueado e libera teto que já existia. O valor do teto permanece intacto. | [ADR-002](decisoes/ADR-002-orcamento-por-envelope-com-lastro.md) |

## Lastro

| # | Regra | Origem |
|---|---|---|
| **RN-LAS-001** | `lastro = caixa das contas de débito + limite livre dos cartões`. Conta de reserva **não entra** — está comprometida com as metas. | [ADR-002](decisoes/ADR-002-orcamento-por-envelope-com-lastro.md) |
| **RN-LAS-002** | O déficit é rateado **pró-rata** entre as categorias com saldo e vira valor bloqueado por categoria. Não há categoria privilegiada. | ADR-002 |
| **RN-LAS-003** | O número em destaque na tela é `restante − déficit`. O app **nunca** mostra o plano cheio como se fosse gastável. | ADR-002 |

## Cartão de crédito

| # | Regra | Origem |
|---|---|---|
| **RN-CAR-001** | Compra no crédito consome a categoria **na data da compra** e não altera o saldo da conta. | mockup |
| **RN-CAR-002** | O saldo da conta só se move quando a fatura é paga. | mockup |
| **RN-CAR-003** | A compra entra na fatura cujo **ciclo de fechamento** contém a data — fechamento e vencimento reais, não mês civil. | [ADR-003](decisoes/ADR-003-ciclo-real-de-fatura.md) |
| **RN-CAR-004** | Pagar a fatura é uma **transferência** entre a conta pagadora e o cartão. Os lançamentos originais **mantêm** sua conta de origem. | ADR-003 |

## Lançamento

| # | Regra | Origem |
|---|---|---|
| **RN-LAN-001** | Lançamento com data em mês anterior não consome o teto do mês corrente. A competência segue a data. | mockup |
| **RN-LAN-002** | Todo lançamento registra o membro que o criou, de forma **imutável**. | mockup |
| **RN-LAN-003** | Transferência entre contas **não é despesa** e não consome teto de categoria. | [ADR-002](decisoes/ADR-002-orcamento-por-envelope-com-lastro.md) |

## Parcelamento

| # | Regra | Origem |
|---|---|---|
| **RN-PAR-001** | Parcelamento até 48×. Gera N lançamentos, um por competência. Só a 1ª parcela pesa no mês corrente. | mockup |
| **RN-PAR-002** | O resíduo de arredondamento vai **para a última parcela**. A soma das parcelas é sempre exatamente igual ao total. | [ADR-001](decisoes/ADR-001-stack-e-infraestrutura.md) |

## Metas e fechamento

| # | Regra | Origem |
|---|---|---|
| **RN-MET-001** | Guardar em meta sai do não alocado do mês. | mockup |
| **RN-MET-002** | Conta de reserva fica fora do orçamento e fora do lastro. | ADR-002 |
| **RN-FEC-001** | Fechar o mês **sela a competência**. A sobra **permanece na conta corrente** — não é movida para a reserva. Guardar continua sendo ato deliberado, via meta. | [ADR-004](decisoes/ADR-004-fechamento-mantem-a-sobra.md) |
| **RN-FEC-002** | Como a sobra fica em conta corrente, ela entra no **lastro do mês seguinte**. | ADR-004 |

## Contas

| # | Regra | Origem |
|---|---|---|
| **RN-CON-001** | Conta com lançamentos não pode ser excluída. | mockup |

## Tempo real

| # | Regra | Origem |
|---|---|---|
| **RN-RT-001** | O canal do WebSocket deriva do **token, no handshake**. O servidor nunca aceita o cliente declarar qual família quer assinar. É RN-FAM-001 aplicada à nova superfície. | [ADR-007](decisoes/ADR-007-tempo-real-por-websocket.md) |
| **RN-RT-002** | O servidor emite **invalidação, não estado derivado**. Quem recebe refaz a leitura pela API. O front nunca recalcula lastro, disponível, bloqueado ou fatura — senão existiriam duas fontes da verdade para a regra que define o produto. | ADR-007 |
| **RN-RT-003** | Ao **reconectar**, o cliente refaz a leitura da competência ativa incondicionalmente. Evento perdido durante a queda não pode deixar número velho na tela. | ADR-007 |

## Acesso e isolamento

| # | Regra | Origem |
|---|---|---|
| **RN-FAM-001** | O `familiaId` deriva **sempre** do token, nunca do request. | [ADR-005](decisoes/ADR-005-acesso-familiar-e-convite.md) |
| **RN-CVT-001** | O email que aceita o convite deve ser idêntico ao convidado. Com Google, vale o email **verificado** do provedor. | ADR-005 |
| **RN-CVT-002** | Convite **expira** e é de **uso único**. O prazo é parâmetro de ambiente (`CONVITE_TTL_HORAS`), não regra. | ADR-005 |
| **RN-CVT-003** | Mesmo email via Google e via senha é a **mesma pessoa**. Sem isso o convite se burla criando conta paralela. | ADR-005 |

---

## O que ainda não é regra

Estes comportamentos aparecem no mockup mas **não** são regra deste produto:

- **Foto do recibo** e **importar extrato** — botões que respondem com aviso. Fora do escopo do MVP.
- `cenarioSemLastro`, `cartaoAbateSaldoNaHora` — props de demonstração do protótipo, não configuração.
- `mostrarQuemLancou` — candidata a preferência da família, ainda não decidida.
