---
name: negocio-orcamento-por-envelope
tipo: negocio # tipo 3 — conhecimento de NEGÓCIO/domínio
projeto: orcamento
dominio: orçamento por envelope — teto por categoria e competência, disponível, remanejamento
aplica-se-a: [orcamento]
status: ativa
revisao: por-mudanca-de-regra
---

# Negócio — orçamento por envelope

> **Skill de Negócio (tipo 3).** O conhecimento do NEGÓCIO que suporta a **especificação**. É o
> que faz o agente de Requirements/PO escrever specs corretas e o Dev não violar regra de domínio.
> Não é sobre código — é sobre _o que o cliente faz e as regras que o regem_.

## O que é o negócio (em 3 linhas)

O Orçamento Familiar planeja o mês dividindo a renda prevista em **envelopes** — categorias com um
**teto** de gasto — para cada **competência** (mês). A família compara, em tempo real, quanto já
gastou contra o teto de cada categoria (o **disponível**) e pode **remanejar** teto de uma categoria
para outra dentro do mesmo mês quando o plano original não bate com a realidade. Este módulo decide
**quanto cabe** em cada categoria; ele não decide se existe dinheiro de verdade por trás disso — essa
é a fronteira com o lastro (ver `../contas-e-lastro/SKILL.md`).

## Atores / personas

| Ator   | Quem é                           | O que faz no sistema                                                    | Restrições                                                                |
| ------ | -------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Membro | pessoa com login numa família    | cria/edita categorias, define teto por competência, remaneja entre elas | só enxerga e altera dado da própria família                               |
| App    | o leitor da competência corrente | calcula disponível, planejado e não alocado; oferece deixar negativo    | disponível/planejado são **leitura derivada**, nunca coluna materializada |

## Glossário do domínio (a linguagem ubíqua)

> Todo nome de código, tela e evento deve usar estes termos — não sinônimos técnicos.

| Termo           | Definição precisa                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Competência     | o mês de referência do orçamento; junto da categoria, forma a chave de que o teto depende (`OrcamentoMes` = categoria × competência × teto). [EF-03 §1](../../../../docs/especificacoes/EF-03-orcamento.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Teto            | o limite de gasto de uma categoria **numa competência específica**. Pertence ao par categoria × competência, nunca à categoria isolada (RN-09). [EF-03 §1/§2](../../../../docs/especificacoes/EF-03-orcamento.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Disponível      | `teto − gasto do mês` de uma categoria na competência corrente; negativo significa que a categoria **estourou** (RN-10). [EF-03 §2](../../../../docs/especificacoes/EF-03-orcamento.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Planejado       | `Σ tetos` de todas as categorias da competência — quanto do que se prevê receber já foi distribuído em envelopes (RN-11). [EF-03 §2](../../../../docs/especificacoes/EF-03-orcamento.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Recebido        | dinheiro que **entrou** na competência — soma dos lançamentos do tipo `RECEITA` (`Lancamento.tipo`, [EF-04 §1](../../../../docs/especificacoes/EF-04-lancamentos.md)). **Distinto de `renda prevista`**: recebido é caixa, renda prevista é meta. Aparece como campo próprio, ao lado de `previsto`, na tela "Visão do mês" ([EF-04 §3](../../../../docs/especificacoes/EF-04-lancamentos.md)) e na tela "Fechamento" ([EF-08 §3](../../../../docs/especificacoes/EF-08-fechamento.md)); é o minuendo de `não alocado` (RN-11, [EF-03 §2](../../../../docs/especificacoes/EF-03-orcamento.md)). **Depende do módulo de lançamentos (EF-04), ainda não construído** — ver nota após a tabela de RN-09..RN-14. |
| Não alocado     | `recebido − planejado` da competência — o que já entrou e ainda não foi posto em nenhum envelope (RN-11). [EF-03 §2](../../../../docs/especificacoes/EF-03-orcamento.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Renda prevista  | `RendaPrevista`, atributo da **competência** (não da categoria) — referência de planejamento fixada para o mês. **Não entra na fórmula do não alocado**: RN-11 usa `recebido`, não `renda prevista` (ver acima). [EF-03 §1](../../../../docs/especificacoes/EF-03-orcamento.md)                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Remanejamento   | mover teto de uma categoria de origem para uma de destino, **só na competência corrente**; fica registrado com origem, destino, valor, competência e autor (RN-13). [EF-03 §1/§2](../../../../docs/especificacoes/EF-03-orcamento.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Deixar negativo | quando não há categoria com sobra para financiar o remanejamento, o app **oferece** deixar o teto de destino ficar negativo em vez de recusar a operação (RN-14). [EF-03 §2](../../../../docs/especificacoes/EF-03-orcamento.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

## Regras de negócio (as invioláveis)

> Numeradas para rastrear na spec e no teste. Cada regra vira critério de aceite e edge case.

| #     | Regra                                                                  | Onde é imposta                         | Origem (lei/norma/decisão)                                                                                                                                                                                                                                               |
| ----- | ---------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RN-09 | O teto pertence ao par **categoria × competência**, nunca à categoria  | schema + handlers                      | [EF-03 §1/§2](../../../../docs/especificacoes/EF-03-orcamento.md) — mockup, corrigido pela EF (ver "o que não se copia" abaixo)                                                                                                                                          |
| RN-10 | `disponível = teto − gasto do mês`. Negativo significa **estourou**    | leitura da competência                 | [EF-03 §2](../../../../docs/especificacoes/EF-03-orcamento.md) — mockup. É a leitura doméstica do **orçado × realizado** da controladoria: ver RN09 de [`controladoria-orcamento`](../../../../preator/conhecimento/negocio/financeiro/controladoria-orcamento/SKILL.md) |
| RN-11 | `planejado = Σ tetos`; `não alocado = recebido − planejado`            | leitura da competência                 | [EF-03 §2](../../../../docs/especificacoes/EF-03-orcamento.md) — mockup                                                                                                                                                                                                  |
| RN-12 | Renda acima da prevista **não altera teto nenhum**                     | —                                      | [EF-03 §2](../../../../docs/especificacoes/EF-03-orcamento.md), que atribui a origem a [EF-06](../../../../docs/especificacoes/EF-06-lastro.md) (decisão humana). Irmã de RN-31 da lastro (ver abaixo)                                                                   |
| RN-13 | Remanejar altera **só a competência corrente**, e registra quem fez    | `POST /competencias/:c/remanejamentos` | [EF-03 §1/§2](../../../../docs/especificacoes/EF-03-orcamento.md) — mockup                                                                                                                                                                                               |
| RN-14 | Sem categoria com sobra, o app oferece **deixar negativo** — não trava | tela                                   | [EF-03 §2/§3](../../../../docs/especificacoes/EF-03-orcamento.md) — mockup                                                                                                                                                                                               |

**RN-11 depende de um campo que este módulo não possui.** `recebido` é dinheiro que **entrou** —
apurado pelos lançamentos (`Lancamento.tipo = RECEITA`), que são da EF-04, **ainda não construída**
(ver "Estado atual" em `.preator/CONTEXT.md`). Enquanto a EF-04 não existir, a leitura da
competência não tem de onde ler `recebido`, e por isso `não alocado` não fica completo até lá — é
dependência real da tarefa #44 (backend), não lacuna desta skill. Isto **não** é motivo para trocar
a fórmula de volta para `renda prevista`: a fonte ([EF-03 §2](../../../../docs/especificacoes/EF-03-orcamento.md))
diz `recebido`, e essa é a fórmula que fica — trocar de novo para contornar a dependência
reintroduziria o defeito que esta revisão corrigiu.

**RN-12 merece cuidado — não confundir com RN-31 da skill de lastro.** O mockup escreve _"os tetos
se ajustam sozinhos ao que entrou"_, frase que sugere teto subindo sozinho. Não é isso: o **valor do
teto nunca muda sozinho** — quem move teto é sempre um remanejamento humano (RN-13) ou a criação da
`OrcamentoMes` (RN-09). O que se ajusta quando entra mais dinheiro é o **desbloqueio**: mais renda
aumenta o lastro, o déficit cai, e o teto que **já existia** fica liberado para gasto. Essa mecânica
de desbloqueio — o que de fato acontece quando entra dinheiro — é regra da skill irmã
[`contas-e-lastro`](../contas-e-lastro/SKILL.md), RN-31 ("entrada de dinheiro desbloqueia; não
aumenta teto nenhum"). RN-12 aqui só garante o lado do orçamento: o **teto em si** não se mexe;
RN-31 lá garante o lado do lastro: o que se mexe é o **bloqueio**. Não recontar RN-31 aqui — só
apontar. Fonte da correção de linguagem: [EF-03 §2](../../../../docs/especificacoes/EF-03-orcamento.md).

## O que não se copia do protótipo

O mockup guarda o `teto` **dentro da `Categoria`** (um valor só, sem competência). É o atalho que a
[EF-03 §1](../../../../docs/especificacoes/EF-03-orcamento.md) corrige com a entidade
`OrcamentoMes` (categoria × competência × teto), e é **o único ponto do desenho que, copiado,
quebraria o histórico mensal**: se o teto fosse atributo da categoria, remanejar em agosto mudaria
setembro também, e o histórico de agosto seria reescrito toda vez que alguém ajustasse o mês
seguinte. Fonte: [EF-03 §1 e §4](../../../../docs/especificacoes/EF-03-orcamento.md)
("O que não se copia do protótipo").

Ainda na §3 da EF-03: a copy do mockup _"os tetos se ajustam sozinhos ao que entrou"_ deve ser
trocada por _"os tetos se desbloqueiam conforme o dinheiro entra"_ — a frase original é tecnicamente
defensável mas induz ao erro descrito em RN-12 acima.

## Regulação / compliance (o que a lei/norma exige)

- **Dinheiro em centavos** — teto, gasto, disponível, planejado e não alocado são inteiros em
  centavos na pilha toda. Ver [D-06](../../../../docs/decisoes/D-06-dinheiro-em-centavos.md). Este
  módulo não faz divisão de valor (rateio é da skill de lastro); a exigência aqui é apenas nunca
  representar teto/gasto em ponto flutuante.
- **Isolamento entre famílias** — nenhuma `OrcamentoMes`, `Categoria` ou `Remanejamento` expõe dado
  de uma família a outra, em REST e em WebSocket (mesma exigência transversal do produto, ver
  `.preator/CONTEXT.md`).

## Processos / fluxos principais

1. **Definir teto do mês** — membro abre "Orçamento do mês", vê a renda prevista da competência e a
   lista de categorias; para cada categoria informa o teto daquela competência (cria a linha de
   `OrcamentoMes` correspondente). [EF-03 §3](../../../../docs/especificacoes/EF-03-orcamento.md)
2. **Acompanhar o mês** — a cada gasto lançado (módulo de lançamentos, fora de escopo aqui), o app
   recalcula o disponível de cada categoria em leitura (`teto − gasto do mês`, RN-10) e o planejado /
   não alocado da competência (RN-11).
3. **Remanejar** — quando uma categoria estoura e outra tem sobra, o membro abre a folha de
   remanejar, escolhe origem e destino (o app sugere por fonte com sobra); se não há sobra em
   nenhuma, o app oferece deixar o destino negativo (RN-14) em vez de recusar. O sistema grava
   origem, destino, valor, competência e autor (RN-13), e a mudança **não** se propaga para o mês
   seguinte. [EF-03 §1/§2/§3](../../../../docs/especificacoes/EF-03-orcamento.md)
4. **Renda maior que a prevista** — quando entra mais dinheiro do que a `RendaPrevista` da
   competência, nenhum teto muda (RN-12); o que muda, se havia bloqueio por falta de lastro, é
   descrito pela skill `contas-e-lastro` (RN-31).

## Casos de uso principais

| UC    | Ator   | Objetivo                                                           | Regras envolvidas |
| ----- | ------ | ------------------------------------------------------------------ | ----------------- |
| UC-01 | Membro | Definir o teto de uma categoria para o mês corrente                | RN-09             |
| UC-02 | Membro | Ver quanto ainda pode gastar em cada categoria                     | RN-10             |
| UC-03 | Membro | Ver quanto do que já entrou ainda não foi distribuído em envelopes | RN-11             |
| UC-04 | Membro | Remanejar teto de uma categoria com sobra para uma que estourou    | RN-13, RN-14      |
| UC-05 | Membro | Confirmar que remanejar em agosto não mexeu em setembro            | RN-13             |
| UC-06 | Membro | Ver que renda extra não infla teto nenhum                          | RN-12             |

## Edge cases e exceções do domínio

- **Remanejar no fim do mês:** um remanejamento feito no último dia da competência corrente (ex.:
  dia 31) altera **só aquele mês** — nunca a competência seguinte, mesmo que a virada esteja a
  horas de distância. É o próprio critério de aceite da EF: "Remanejar em agosto não altera
  setembro — teste explícito". [EF-03 §5](../../../../docs/especificacoes/EF-03-orcamento.md) (RN-13).
- **Categoria sem sobra para remanejar:** nenhuma categoria da competência tem disponível positivo
  para financiar o destino. O app **não trava** a operação — oferece deixar o teto de destino
  ficar negativo (RN-14). O texto exato da oferta não é desta fonte.
- **Teto menor que o já gasto:** se um remanejamento reduz o teto de uma categoria abaixo do que já
  foi gasto nela na competência corrente, o disponível calculado por RN-10 (`teto − gasto do mês`)
  fica negativo **imediatamente** — é a mesma leitura de "estourou" de RN-10, não uma regra à parte;
  a EF não descreve nenhum bloqueio adicional para esse caso além do que RN-10 já produz.
- **Competência futura ainda sem `OrcamentoMes`:** o que o app mostra para uma categoria numa
  competência para a qual ainda não existe linha de `OrcamentoMes` — teto zero, herança do mês
  anterior, ou categoria ausente da lista — **não tem fonte em EF-03 nem em EF-06**. ⛔ **Lacuna
  registrada, não inventada aqui**: fica como fork para o humano decidir antes da tarefa #44
  (backend) precisar implementar a leitura da competência.

## Fontes do conhecimento

- [docs/especificacoes/EF-03-orcamento.md](../../../../docs/especificacoes/EF-03-orcamento.md) —
  EF fechada (Portão A) que define `Categoria`, `OrcamentoMes`, `Remanejamento` e as regras RN-09 a
  RN-14. Fonte primária desta skill.
- [docs/especificacoes/EF-06-lastro.md](../../../../docs/especificacoes/EF-06-lastro.md) — EF
  fechada para a qual EF-03 §2 aponta como origem de RN-12; é a EF dona de RN-27 a RN-32
  (referenciadas aqui só por link, nunca recontadas — ver [`contas-e-lastro`](../contas-e-lastro/SKILL.md)).
- [docs/especificacoes/EF-04-lancamentos.md](../../../../docs/especificacoes/EF-04-lancamentos.md)
  — fonte do campo `recebido` (§1, `Lancamento.tipo = RECEITA`; §3, tela "Visão do mês", `recebido`
  ao lado de `previsto`). Módulo **fora deste escopo e ainda não construído** — referenciada só para
  fundamentar o termo do glossário e a dependência registrada após a tabela de RN-09..RN-14, nunca
  recontada além disso.
- [docs/especificacoes/EF-08-fechamento.md](../../../../docs/especificacoes/EF-08-fechamento.md) —
  confirma que `recebido` é campo estável em mais de uma tela (§3, tela "Fechamento"), distinto de
  `planejado`. Mesma ressalva: fora de escopo, citada só para esse termo.
- [preator/conhecimento/negocio/financeiro/controladoria-orcamento/SKILL.md](../../../../preator/conhecimento/negocio/financeiro/controladoria-orcamento/SKILL.md)
  — skill agnóstica da fábrica; âncora conceitual de RN-10: `disponível = teto − gasto` é a leitura
  doméstica de RN09 daquela skill ("controle orçamentário = comparar orçado × realizado
  periodicamente"). A soma de tetos em RN-11 (`planejado = Σ tetos`) tem paralelo apenas frouxo com
  RN04/RN07 daquela skill (peças orçamentárias encadeadas) — não é a mesma fonte, só o mesmo
  princípio geral de somar partes planejadas. Este domínio é doméstico (uma família, não uma
  empresa): a skill da fábrica **não cobre** o teto por categoria, o "deixar negativo" nem o
  remanejamento entre categorias — esses são **regra de produto**, com origem no mockup e fechados
  pela EF-03.
- [docs/decisoes/D-06-dinheiro-em-centavos.md](../../../../docs/decisoes/D-06-dinheiro-em-centavos.md)
  — ADR aceita que decide que dinheiro é inteiro em centavos na pilha toda; vale para teto, gasto,
  disponível, planejado e não alocado.
- [`.preator/skills/negocio/contas-e-lastro/SKILL.md`](../contas-e-lastro/SKILL.md) — skill irmã,
  dona de lastro, déficit, rateio pró-rata e RN-27 a RN-32. Referenciada, nunca recontada —
  especialmente RN-31, a irmã de RN-12.
- Protótipo funcional no Claude Design: `Orcamento Familiar.dc.html` e Desktop, tela `config`
  ("Orçamento do mês") + folhas `sheetEditCat` e `sheetRemanejar`. A lógica visual e os casos de
  uso são derivados dali, com as ressalvas de [EF-03 §4](../../../../docs/especificacoes/EF-03-orcamento.md)
  sobre o que não se copia.
