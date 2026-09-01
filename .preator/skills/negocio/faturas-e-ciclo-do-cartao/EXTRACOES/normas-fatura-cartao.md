# Extração — Ciclo de fatura de cartão de crédito

> Rastreabilidade das fontes pesquisadas para o `SKILL.md` desta pasta. **Zero cópia literal** —
> todo texto abaixo é paráfrase/estrutura. Pesquisado e conferido em 2026-08-28.
>
> **Resultado central desta extração, que o `SKILL.md` cita:** a mecânica de "em qual fatura uma
> compra entra" (RN-23) **não tem norma do Banco Central/CMN que a defina**. É prática de mercado
> — cada emissor decide seu próprio ciclo — universalmente descrita da mesma forma pelas fontes de
> educação financeira consultadas, mas nenhuma fonte normativa (BCB/CMN) a impõe. Isto é dito às
> claras no SKILL, como manda a tarefa: "se não houver fonte citável, diga isso em vez de inventar".

## Fonte 1 — Resolução BCB nº 96/2021, art. 6º-A (incluído pela Resolução BCB nº 365/2023) — [NORMA]

Texto localizado via busca (conteúdo destilado de resumos de escritórios de advocacia e imprensa
oficial — Agência Gov, Mattos Filho —, não o PDF do artigo isolado; **[REQUER VALIDAÇÃO]** o número
exato do parágrafo se algum dia isto for auditado contra o texto consolidado no site do BCB).

- A instituição emissora deve oferecer ao titular **pelo menos três datas de vencimento** de
  fatura, com **diferença mínima de sete dias** entre elas — exceto contratos com pagamento por
  consignação em folha.
- Vigência a partir de 1º/7/2024 (regulamenta parte da Lei do Desenrola, Lei nº 14.690/2023).
- **O que isto NÃO cobre:** a norma trata da **escolha do vencimento**, não de **qual ciclo de
  fechamento recebe uma compra**. Não define "ciclo", não define "fatura", não diz quando uma
  compra "entra" numa fatura em vez de outra. É a única norma citável encontrada que toca o tema
  de faturas de cartão neste ponto específico (multiplicidade de datas de vencimento) — e é
  **tangencial** a RN-23, não sua fonte. Serve apenas para confirmar que `diaVencimento` ser um
  campo configurável por cartão ([EF-02](../../../../../docs/especificacoes/EF-02-contas.md), RN-08)
  está alinhado com uma prática que o próprio regulador já reconhece como direito do cliente
  (escolher entre datas), embora a norma regule o mínimo de opções oferecidas, não o campo único
  que este produto guarda por cartão.

## Fonte 2 — Normas verificadas e descartadas por não tratarem do ciclo de fechamento

Cada uma foi buscada e o texto (quando acessível) foi lido por inteiro antes de descartar:

- **Resolução CMN nº 4.549/2017** — texto completo obtido em PDF direto do BCB
  (`normativos.bcb.gov.br`). Trata do **financiamento do saldo devedor via crédito rotativo**
  (prazo de uso do rotativo até o vencimento da fatura subsequente, migração para parcelamento).
  **Não define ciclo nem fatura** — apenas usa "fatura" como termo já conhecido, sem conceituá-lo.
- **Resolução CMN nº 4.655/2018** — texto completo obtido em PDF direto do BCB. Trata de aviso
  prévio de 30 dias para redução de limite de crédito e para alteração do percentual de pagamento
  mínimo. **Nada sobre ciclo de fechamento ou fatura**.
- **Resolução CMN nº 5.112/2023** — checada via busca e leitura de resumo de página que analisou
  o texto integral (LegisWeb). Trata de portabilidade de saldo devedor de cartão e de divulgação de
  informações na fatura (Lei do Desenrola). **Confirmado explicitamente, na consulta: não define
  fatura, não define ciclo de faturamento, não regra em qual fatura uma compra entra.**

Nenhuma das três — nem nenhuma outra encontrada na busca — normatiza a regra central desta skill
(RN-23: compra entra na fatura cujo ciclo de fechamento contém a data).

## Fonte 3 — Consenso de mercado (educação financeira) — [PRÁTICA DE MERCADO, não norma]

Fontes consultadas (todas de blogs/conteúdo educativo de instituições financeiras ou fintechs —
Serasa, Mercado Pago, 99Pay, Foregon, Mobills, Meutudo, Cora, Creditas, SPC Brasil, Antecipa Fácil):
descrevem, de forma consistente entre si, que:

- O cartão de crédito **não opera pelo mês civil**; opera por um **ciclo próprio**, de duração
  aproximada de 30 dias, delimitado pela data de fechamento.
- Compra feita **até** a data de fechamento entra na fatura que fecha naquele ciclo; compra feita
  **após** o fechamento entra na fatura seguinte.
- O vencimento normalmente ocorre de 7 a 10 dias após o fechamento — mas cada fonte registra que
  **isso varia por instituição**, sem um número fixo por regra: "cada banco possui suas políticas
  internas", "não existe uma regra".

**Isto é prática de mercado universal, não norma.** É consistente o bastante entre concorrentes
para ser tratado como fato de domínio confiável (nenhuma fonte descreve mecânica diferente), mas
nenhuma delas é fonte normativa, e nenhuma é o BCB regulando o mecanismo em si — são explicações
de como bancos e fintechs, cada um por decisão própria, operam o produto "cartão de crédito".

## O que ficou como lacuna / validação

- **RN-23 (qual fatura recebe a compra) não tem fonte normativa** — apenas prática de mercado
  consistente. Registrado assim no `SKILL.md`, sem apresentar como norma o que não é.
- **RN-24 (pagar é transferência, lançamento mantém a conta de origem)** não é prática de mercado
  nem norma — é decisão de modelagem contábil **deste produto**, com fonte própria em
  [EF-05 §2/§4](../../../../../docs/especificacoes/EF-05-faturas.md). Não pesquisado como norma
  porque a EF já é fonte primária suficiente e o motivo (não corromper o extrato por cartão) é
  descrito pela própria EF, não por regulação externa.
- **RN-25/RN-26 ("fatura em aberto")** — nenhuma das fontes de mercado consultadas usa a expressão
  com escopo único e consistente: alguns textos tratam "fatura em aberto" como só o ciclo corrente
  (ainda fechando), outros como qualquer fatura não paga. Essa mesma ambiguidade é a que gerou a
  decisão humana D1, registrada no `SKILL.md` — não há fonte de mercado que a resolva; foi
  resolvida pelo humano do projeto, não por pesquisa externa.
- Se o número exato do artigo da Resolução BCB nº 96/2021 (art. 6º-A) precisar ser citado em
  contexto formal/auditável, o texto consolidado deveria ser confirmado direto em
  `normativos.bcb.gov.br`, não nos resumos usados aqui.
