---
name: negocio-orcamento-familiar
tipo: negocio
projeto: orcamento
dominio: finanças pessoais e familiares — orçamento por envelope
aplica-se-a: [orcamento]
referencia-skills:
  - negocio/financeiro/controladoria-orcamento   # orçado × realizado, análise de variação
  - negocio/financeiro/credito                   # parcelamento
status: ativa
revisao: por-mudanca-de-regra
---

# Negócio — Orçamento familiar por envelope

> **Skill de Negócio (tipo 3).** O conhecimento que sustenta a **especificação**. Carregada pelo
> Especialista de Negócio e pelo Requirements antes de escrever spec.
>
> ⛔ **Regra #0.** As regras numeradas aqui são a fonte. Responder de memória é violação.
> A regra completa, com origem, vive em [`docs/REGRAS-DE-NEGOCIO.md`](../../../docs/REGRAS-DE-NEGOCIO.md)
> — esta skill **aponta**, não duplica.

## Fronteira com as skills da fábrica

| Se a tarefa é sobre… | vai para… |
|---|---|
| ciclo orçado × realizado, análise de variação | `negocio/financeiro/controladoria-orcamento` — o **mecanismo** é de lá |
| cálculo de parcela, CET, amortização | `negocio/financeiro/credito` |
| **lastro, bloqueio pró-rata, envelope familiar** | **aqui** — não existe na fábrica |

A fábrica cobre o domínio financeiro em recorte **corporativo** (conciliação de gateway, MDR,
controladoria empresarial, tesouraria, cobrança). O recorte de finanças **pessoais** não existe
lá. O que se aproveita é o mecanismo universal, não o recorte.

## O que é o negócio

Uma família distribui a renda do mês em categorias com teto — envelopes. Cada gasto consome o
teto da sua categoria. Sobre isso, o app calcula quanto do plano tem **respaldo real em dinheiro**
e bloqueia o resto, para que ninguém planeje o que não pode pagar.

## Atores

| Ator | Quem é | O que faz | Restrições |
|---|---|---|---|
| Membro | pessoa com login numa família | lança, orça, remaneja, fecha o mês | vê só a própria família |
| Primeiro membro | quem criou a família | convida os demais por email | — |

Não há hierarquia: todo membro tem o mesmo poder sobre os dados. O que existe é **autoria** —
cada lançamento registra quem o criou, de forma imutável.

## Glossário

A linguagem ubíqua completa está em [`docs/DOMINIO.md`](../../../docs/DOMINIO.md#glossário-linguagem-ubíqua).
Os termos que mais geram erro de interpretação:

| Termo | O que **não** é |
|---|---|
| **Teto** | não é atributo da categoria — é do par categoria × competência |
| **Competência** | não é a data do lançamento; é o mês do orçamento a que ele pertence |
| **Previsto** | não move teto; é referência de planejamento |
| **Lastro** | não inclui a reserva; inclui o limite livre do cartão |
| **Disponível** | é `teto − gasto`; o que a família pode gastar é o **liberado** |
| **Fechar o mês** | não move dinheiro |

## Regras de negócio

**24 regras numeradas** em [`docs/REGRAS-DE-NEGOCIO.md`](../../../docs/REGRAS-DE-NEGOCIO.md),
agrupadas em: orçamento (`RN-ORC`), lastro (`RN-LAS`), cartão (`RN-CAR`), lançamento (`RN-LAN`),
parcelamento (`RN-PAR`), metas e fechamento (`RN-MET`/`RN-FEC`), contas (`RN-CON`), acesso
(`RN-FAM`/`RN-CVT`).

**Cada RN vira critério de aceite e caso de teste de integração.** Regra sem teste não está
implementada — está escrita.

## Edge cases do domínio

Os casos que quebram, e que precisam existir como teste:

- **Transferência entre contas não é despesa.** Pagar fatura e guardar em meta são transferências.
- **Competência ≠ caixa.** Compra no crédito consome a categoria hoje; o saldo da conta só muda
  quando a fatura é paga.
- **Virada de ciclo do cartão.** Compra no dia do fechamento, compra no dia seguinte, fechamento
  em dia que não existe no mês (30 em fevereiro).
- **Parcela final.** A soma das parcelas tem que fechar exatamente com o total; o resíduo vai
  para a última.
- **Retroativo.** Data em mês anterior não consome o teto do mês corrente — mas mês **fechado**
  não aceita lançamento.
- **Estouro sem fonte para remanejar.** Nenhuma categoria tem sobra: o app oferece deixar
  negativo, não trava.
- **Déficit maior que o plano.** O bloqueado não pode exceder o disponível de nenhuma categoria.
- **Convite com email divergente.** Aceitar com Google cujo email verificado difere do convidado
  → recusa.

## Regulação

Dado financeiro familiar é **dado pessoal**. A LGPD entra no escopo antes de qualquer exposição
pública do produto. Ainda **não há decisão** sobre retenção, exportação e exclusão de conta —
quando o assunto surgir, é decisão humana, não inferência.

## Fontes

- Mockup funcional no Claude Design (`b7d13c37-0d57-4a92-9df6-c50357cb587d`) — a lógica de
  domínio está no JavaScript dos arquivos `.dc.html`.
- ADRs em [`docs/decisoes/`](../../../docs/decisoes/) — cada regra rastreia até a decisão que a
  gerou.
- Skills da fábrica citadas acima, para o mecanismo universal.
