# MANUAL as-built — EF-05 Faturas

> O que foi **construído**, não o que a EF previu. Nasce na implantação; é a base para entender o
> módulo sem ler o código. Ver [EF-05](../especificacoes/EF-05-faturas.md) (o contrato) e
> [MC-05](../especificacoes/MC-05-faturas.md) (o que falta).

- **Identificação:** Faturas · EF-05 · história [#19](https://github.com/cesarvieira/orcamento/issues/19)
  · tarefas: [#69](https://github.com/cesarvieira/orcamento/issues/69) (skill de negócio),
  [#70](https://github.com/cesarvieira/orcamento/issues/70) (módulo de faturas: entidade, ciclo,
  pagamento), [#71](https://github.com/cesarvieira/orcamento/issues/71) (tela `/faturas`),
  [#72](https://github.com/cesarvieira/orcamento/issues/72) (os seis casos do DoD, contra Postgres
  e HTTP reais), [#73](https://github.com/cesarvieira/orcamento/issues/73) (documentação, esta
  tarefa). **Nenhuma tarefa nasceu fora do DAG avalizado pelo humano na abertura da #19** — ao
  contrário da EF-04, esta história não teve tarefa de defeito/costura não planejada.
  **Lista viva de toda tarefa mesclada, na ordem real — a fonte que não envelhece:**
  `git log --oneline --first-parent main..historia/19-ef-05-faturas`
- **Construído por:** agente `docs` (#69, #73); agente `backend`, esforço alto (#70); agente
  `frontend`, esforço alto (#71); agente `qa` (#72) — todos `claude-sonnet-5`
- **Data:** 2026-08-28 (todas as tarefas)
- **Commits e merges (na ordem do DAG real):**
  - #69 — `1bcb592` (skill) + `94d797e`/`5f5c410` (correções de cabeçalho/links em EXTRACOES)
    mesclados em `cf2268f`
  - #70 — `557eb4a` (módulo: entidade, ciclo, pagamento, leitura) + `fc1964c` (costura sem dono:
    atualiza RN-18 em `lancamentos.teste.ts`, EF-05 chegou) + `b52b45f` (`familiaId` explícito nas
    queries internas, defesa em profundidade) mesclados em `1a102bf`
  - #71 — `0c689a3` (tela `/faturas`) + `283685f` (cabeçalho declara as duas strings de vazio
    inventadas) mesclados em `24be46e`
  - #72 — `a8fab42` (os seis casos do DoD, fixture derivada do relógio) mesclado em `fa741e2`
  - #73 — esta tarefa (docs — MC-05/MANUAL-05, correção de EF-05 §2/§5 e EF-06 §2): commit ainda
    sem hash no momento em que este texto foi escrito — confira com `git log --oneline
--first-parent main..historia/19-ef-05-faturas`
- **Confiança:** Alta (arquivos de teste e código lido linha a linha pelo agente `docs`, mais o
  carimbo `Gate PASS + revisão APROVADA` citado no próprio commit de merge de cada tarefa).

---

## O que o módulo faz, para quem usa

Todo cartão de crédito tem um **ciclo** próprio — abre, acumula compras, fecha numa data fixa
(`diaFechamento`) e vira uma **fatura** que vence dias depois (`diaVencimento`). O app decide em
qual fatura uma compra cai pela **data da compra comparada ao ciclo**, nunca pelo mês civil: uma
compra no dia 28 de agosto com fechamento no dia 25 cai na fatura que fecha em 25 de setembro, não
na de agosto.

A família vê a fatura de um cartão — o ciclo que já fechou e ainda não foi pago, **mais** o ciclo
corrente acumulando — e paga escolhendo de qual conta o dinheiro sai. Pagar **não** move as compras
de conta: o extrato filtrado por cartão continua mostrando exatamente onde cada compra aconteceu,
para sempre. O que muda é o saldo: a conta pagadora perde o dinheiro, o cartão "recebe" (a dívida
diminui), e a fatura fica marcada como paga, com a data e a conta registradas.

O **saldo exibido do cartão** — e o **limite livre** que ele empresta para o lastro (EF-06) — não
é só o que está acumulando no ciclo corrente: é **tudo que ainda não foi pago**, incluindo uma
fatura já fechada esperando pagamento. Essa é a decisão **D1**, tomada pelo humano antes de
qualquer código desta história, porque ela desempatava uma ambiguidade real entre dois textos da
própria especificação (ver a seção própria abaixo).

## Skill de negócio — `.preator/skills/negocio/faturas-e-ciclo-do-cartao/` (#69)

Registra o glossário do domínio (Fatura, Ciclo, `abreEm`/`fechaEm`/`venceEm`, status, "fatura em
aberto") e as regras RN-23 a RN-26, com a derivação lógica completa de como os três campos de ciclo
produzem uma data concreta a partir de `diaFechamento`/`diaVencimento` (1–28, EF-02 RN-08). Verifica
e descarta três resoluções CMN como fonte para RN-23 — **é prática de mercado, sem norma que a
imponha** — e cita a Resolução BCB nº 96/2021, art. 6º-A, como a única norma real encontrada sobre
o tema, marcada explicitamente como **tangencial** (regula a multiplicidade de datas de vencimento
ofertadas pelo emissor, não a mecânica de qual fatura recebe a compra). Registra também D1 por
completo — texto, motivo e as duas fontes que colidiam — e as lacunas de negócio que nenhuma fonte
resolve: primeiro ciclo de um cartão novo, pagamento parcial, exclusão de parcela em fatura já
fechada ou paga (ver MC-05, `EF05-MC-006`).

## D1 · "fatura em aberto" (decisão humana, 2026-08-28)

> **"Fatura em aberto" = TODA fatura não paga** — a fechada aguardando pagamento **mais** a do
> ciclo corrente. O limite livre só se recompõe **no pagamento** (RN-24), nunca no fechamento.

Esta é a decisão mais delicada desta história, e ela foi tomada **antes de qualquer código** —
não é co-evolução de regra e implementação. O problema de texto que ela resolve: a EF-05 §2, na
RN-25, dizia _"a fatura em aberto do **ciclo corrente**"_ — leitura estreita. A EF-06 §2, na
fórmula `limiteLivre = Σ(limite − fatura em aberto)`, usava a mesma expressão sem qualificar
escopo. **A mesma expressão, dois escopos possíveis** — e enquanto o texto ficasse assim, a EF-06
seria construída contra a leitura errada, e errar o ciclo erra o lastro (o risco máximo que a
própria EF-05 anuncia em sua abertura).

D1 resolveu a favor do escopo amplo, com o cuidado de nomenclatura registrado na skill: o valor de
enum `status = 'ABERTA'` **não é sinônimo** do termo de negócio "fatura em aberto" — uma fatura
`FECHADA` também está "em aberto" nesse sentido. Uma implementação que filtrasse só `status =
'ABERTA'` estaria implementando a leitura estreita que D1 rejeitou.

**Esta tarefa (#73) corrigiu os dois lados do texto** — ver a seção "As mudanças exatas em EF-05
§2/§5 e EF-06 §2" abaixo. A implementação (#70) já estava correta desde o início — quem construiu o
módulo já tinha D1 disponível como decisão fechada, não precisou adivinhar:

- `api/src/modulos/faturas/servico.ts:293-303` — a query de leitura usa `ne(faturas.status,
'PAGA')`, nunca `eq(faturas.status, 'ABERTA')`.
- `api/src/modulos/contas/servico.ts#expressaoSaldoDerivado` — o somatório com sinal que forma
  `saldoCentavos` é aplicado **sem exceção** a `CREDITO` (antes da EF-05, um `case when tipo =
'CREDITO' then 0` travava o saldo em zero); o resultado é `saldoCentavos = −Σ(fatura em aberto,
D1)` — negativo, a dívida real.

## Backend — `api/src/modulos/faturas/` (#70)

### Dados

- **`faturas`** (`api/src/db/schema.ts:612-651`, migration `api/drizzle/0007_unusual_leech.sql`):
  `abreEm`/`fechaEm`/`venceEm` (datas do ciclo), `status` (`ABERTA`/`FECHADA`/`PAGA`), `pagaEm` +
  `pagaComContaId` (só preenchidos com `status='PAGA'`). Identidade do ciclo é `(contaId, fechaEm)`
  — índice único `faturas_conta_fecha_em_unico`, base do find-or-create sob concorrência. CHECK
  `faturas_pagamento_completo_ou_ausente` impede o estado "meio paga" no próprio banco (mesmo
  padrão de defesa em profundidade de `contas_campos_de_credito_apenas_em_credito`, EF-02).
- **`totalCentavos` nunca é persistido** — é somado na leitura, a partir dos lançamentos `DESPESA`
  do cartão com `data` no intervalo `[abreEm, fechaEm]` (`servico.ts:374`, `esquemas.ts:56`).

### Domínio puro — `api/src/modulos/faturas/dominio.ts` (128 linhas)

Funções sem banco, só matemática de calendário:

- `fechaEmDoCiclo(diaFechamento, data)` (RN-23, `:59-63`): dia-do-mês da compra **menor ou igual**
  a `diaFechamento` ⇒ fecha no **mesmo mês**; **maior** ⇒ fecha no **mês seguinte**. É esta
  comparação — nunca o mês civil da compra — que decide a fatura.
- `abreEmDoCiclo(fechaEm)` (`:81-85`): dia seguinte ao `fechaEm` do ciclo anterior. **Fork
  declarado ao humano**: para o primeiro ciclo de um cartão novo, a mesma fórmula uniforme é usada
  mesmo sem um "ciclo anterior" de verdade — produz uma data bem-definida, inofensiva porque não há
  lançamento legítimo ali. Se o produto precisar de um corte diferente, é decisão nova.
- `venceEmDoCiclo(diaFechamento, diaVencimento, fechaEm)` (`:93-101`): primeira ocorrência de
  `diaVencimento` **estritamente depois** de `fechaEm` — `diaVencimento > diaFechamento` cai no
  mesmo mês; senão (inclusive iguais), no mês seguinte.
- `statusDoCiclo(fechaEm, hoje, pagaEm)` (`:116-123`): `PAGA` só por pagamento explícito; sem
  pagamento, `ABERTA` enquanto `hoje < fechaEm`, `FECHADA` a partir de `hoje >= fechaEm` — o ciclo
  fecha **sozinho**, pela passagem do tempo, sem job — é a própria leitura (`comStatusEmDia`,
  `servico.ts:231-242`) que corrige o status persistido, de forma idempotente.

### Leitura — `GET /faturas?contaId=` (`servico.ts:248-333`)

`listarFaturasDoCartao` garante (find-or-create) o ciclo **corrente** sempre, mesmo sem compra
nenhuma — a tela precisa de "a fatura de agora" para mostrar datas/limite livre — e também
qualquer ciclo **já fechado** que tenha despesa e ainda não tenha linha de `Fatura`, cobrindo a
família que passou meses sem abrir a tela (D1 soma toda fatura não paga, não só a mais recente).
Devolve todas as faturas com `status ≠ 'PAGA'`, mais antiga primeiro, cada uma com seus itens
(`ItemDeFatura` — forma reduzida do `Lancamento`, só os campos que a tela precisa) e o total somado
na leitura. `limiteLivreCentavos = limite + saldoCentavos` (soma, não subtração, porque
`saldoCentavos` de uma `CREDITO` já é negativo).

### Pagamento — `POST /faturas/:id/pagar` (`servico.ts:354-430`, RN-24/D3)

`pagarFatura` valida, nesta ordem: fatura existe nesta família (404) → não está paga (409
`ja_paga`) → conta pagadora não é o próprio cartão (400 `conta_pagadora_igual_ao_cartao`) → conta
pagadora existe nesta família (404) → há valor a pagar (409 `sem_valor`, mesma frase do toast do
protótipo, "Não há fatura em aberto nesse cartão."). Passando por tudo, numa única transação: um
INSERT de `TRANSFERENCIA` (conta pagadora → cartão, o valor do ciclo) e um UPDATE marcando a
`Fatura` como `PAGA` com `pagaEm`/`pagaComContaId`. **Nenhum UPDATE em `lancamentos.contaId`** —
a armadilha 1 do protótipo (EF-05 §4) não existe neste código; os lançamentos originais nunca
mudam de conta.

**D3** — a conta pagadora vem do corpo do POST (`pagaComContaId`), sempre escolhida pelo usuário,
nunca inferida como "a primeira conta de débito" (a armadilha exata do protótipo,
`.preator/tmp/recorte-desenho-19.md` §5, linha `contaPagadora = (s.contas.find(a => a.tipo ===
'debito') || {}).id`).

### Rotas e contrato — `api/src/modulos/faturas/rotas.ts`, `esquemas.ts`

`GET /faturas` (query `contaId` obrigatória) e `POST /faturas/:id/pagar` (corpo `PagarFatura`),
ambas atrás de `exigirSessao` + `familiaDaRequisicao(req)`; autor do pagamento vem de
`membroDaRequisicao(req)`, nunca do corpo (R1/D-05). Esquemas Zod (`esquemas.ts`) são a mesma
validação que a rota usa em runtime e a fonte do contrato OpenAPI (D-03) — `FaturasDoCartao`,
`Fatura`, `ItemDeFatura`, `PagarFatura` exportados por `@orcamento/contrato`, consumidos pelo front
sem redeclaração (regra inviolável nº 4).

### Tempo real

Uma mutação de fatura invalida **três** leituras (`rotas.ts:39-52`, `invalidarPagamento`):
`faturas` (o pagamento em si), `contas` (o saldo da pagadora **e** do cartão mudaram — RN-24 é
transferência real) e `lancamentos` (o novo lançamento de pagamento aparece no extrato). Provado
com um único POST HTTP real, observado por três sockets simultâneos: dois clientes da MESMA família
(duas sessões, mesmo membro) recebem `faturas`+`contas` sem refresh; um cliente de outra família
não recebe nada (`api/testes/faturas-ciclo.teste.ts:576-650`).

### Isolamento entre famílias

Família B não lê a fatura de A pelo cartão de A (404, `faturas.teste.ts:498-503`) nem paga (404,
mesmo sabendo o id da fatura, `:505-528`; confirmado de novo, isolado, em
`faturas-ciclo.teste.ts:547-574`).

### Costura com `contas`/`lancamentos` (não é pasta desta tarefa, reportada)

`api/src/modulos/contas/servico.ts#expressaoSaldoDerivado` foi **estendido**, não recriado: antes
da EF-05, um `case when tipo = 'CREDITO' then 0` travava o saldo de um cartão em zero, com um
comentário apontando para esta EF. A tarefa #70 removeu essa exceção — o mesmo somatório com sinal
que já existia (RECEITA soma, DESPESA subtrai, TRANSFERENCIA move as duas pontas) agora se aplica
também a `CREDITO`, e o resultado passa a ser exatamente `−Σ(fatura em aberto, D1)`. Consequência
de costura, resolvida pelo condutor na própria issue #70 (sem dono de história dividido): o teste
de RN-18 em `api/testes/lancamentos.teste.ts` esperava `saldoCentavos === 0` numa `CREDITO` "até a
EF-05 existir" — foi atualizado (commit `fc1964c`) para esperar o valor negativo real.

### Testes — `api/testes/faturas.teste.ts` (#70, 16 casos) + `api/testes/faturas-ciclo.teste.ts` (#72, 6 casos)

`faturas.teste.ts` cobre RN-23 (ciclo vs. mês civil), parcela atravessando ciclo, RN-24 (pagamento,
D3, 400/404), RN-25/RN-26 (D1 — desconta FECHADA + ABERTA, limite inteiro sem compra), validações
de corpo/sessão, isolamento entre famílias e tempo real com socket real — construído durante o
próprio módulo.

`faturas-ciclo.teste.ts` (#72) prova os **seis casos obrigatórios do DoD (EF-05 §5)**, com fixtures
próprias e deliberadamente disjuntas das de #70:

1. **Compra no dia do fechamento** (`:267-306`) — cai na fatura que fecha hoje.
2. **Compra no dia seguinte** (`:308-313`) — mesmo mês civil da compra 1, cai na fatura seguinte;
   as duas faturas são comprovadamente diferentes.
3. **Parcela que atravessa ciclos, com virada de ano** (`:333-377`) — 3 parcelas, cada uma na
   fatura do seu próprio ciclo, novembro/2025 → dezembro/2025 → janeiro/2026.
4. **Extrato por cartão continua correto após o pagamento** (`:387-463`) — uma fatura paga, outra
   ainda aberta no mesmo cartão; as duas compras originais mantêm `contaId = cartão`; a
   transferência aparece como lançamento novo na conta pagadora.
5. **Limite livre = D1** (`:473-537`) — antes de pagar, desconta FECHADA + ABERTA (explicitamente
   comparado e diferente da leitura estreita que D1 rejeitou); depois de pagar a FECHADA, o limite
   livre sobe exatamente pelo valor pago, e a ABERTA continua intacta.
6. **Isolamento + tempo real** (`:546-651`) — B nunca lê nem paga fatura de A (404); um único POST
   real de pagamento invalida os DOIS clientes de A sem refresh, e B não recebe nada.

A fixture deriva `diaFechamento` do relógio real por um deslocamento de 14 no grupo cíclico Z/28
(`diaFechamentoSemColisao`, `:109-111`) — nenhuma constante fixa sobreviveria a todo dia-do-mês
possível, porque `diaFechamento` é restrito a 1–28 (RN-08) e "hoje" pode cair em qualquer um deles;
com uma constante fixa, a suíte ficaria vermelha exatamente um dia por mês, um vermelho que não é
regressão. **Achado de teste, reportado, não corrigido nesta tarefa** (fora de escopo de `docs`):
`:118`, `const FECHA_EM_CORRENTE = fechaEmDoCiclo(DIA_FECHAMENTO, HOJE)` chama a própria função de
produção — tautológico para o ciclo corrente vazio usado como controle nos Casos 1, 4 e 5;
inofensivo porque os Casos 1/2 calculam `FECHA_EM_FECHADA`/`FECHA_EM_DIA_SEGUINTE` à mão. Ver
MC-05, `EF05-MC-005`.

**207 testes em 15 arquivos** (`api/testes/*.teste.ts`) — contagem conferida por esta tarefa
contando literalmente `it(` em todo o diretório; `faturas.teste.ts` contribui 16, `faturas-ciclo.teste.ts`
contribui 6.

## Frontend — `web/app/pages/faturas.vue` (#71, 553 linhas)

Tela contra o recorte de desenho **e** contra quatro decisões humanas (2026-08-28) que acrescentam
superfície que o desenho não tem — `D1` a `D4`, declaradas no cabeçalho do próprio arquivo.

### O que vem do desenho (recorte §2/§3/§4)

Cabeçalho azul (nome do cartão, total, `faturaDatas` — "fecha dia X · vence dia Y · limite livre
Z", onde X/Y são os dias **fixos** do cartão, não datas de uma fatura específica); o aviso, palavra
por palavra ("Cada compra no crédito já saiu da categoria. O saldo da conta só muda quando a
fatura é paga."); a lista de itens reaproveitando o mesmo `mapLanc` do extrato; o botão de pagar; a
diferença desktop (botão sobe para o cabeçalho, fundo branco/texto azul, rótulo curto, lista vira
tabela num card só); breadcrumb `‹ Contas` só no mobile.

**Duas divergências declaradas do `sub` do item**: o mockup inclui `· crédito` (porque o desenho
original mistura contas numa lista só); aqui todo item já é do cartão em foco — repetir seria
ruído, omitido de propósito. Também não há `quem` no sub: `ItemDeFatura` (contrato) é a forma
reduzida do lançamento e não carrega `criadoPorMembroId`.

### D1 aplicada na tela

O total do cabeçalho é `conta.saldoCentavos`, já derivado pelo servidor com D1 embutida (regra
inviolável nº 4 — a tela nunca recalcula). `faturaDatas` lê `limiteLivreCentavos` de
`FaturasDoCartao`, também com D1 já aplicada no backend.

### D2 · Dois blocos (decisão humana, não está no desenho)

A fatura fechada aguardando pagamento **e** o ciclo corrente acumulando — implementado como uma
lista de `blocos` (`faturas.vue:194-210`) que **não assume** exatamente um bloco fechado: se a
família pulou mais de um pagamento (cenário real que a skill de negócio já registra para D1), cada
`FECHADA` vira seu próprio bloco, com seu próprio botão. **O fork ratificado pelo condutor**: o
botão do cabeçalho (desktop) só aparece quando há **exatamente uma** fatura fechada
(`faturaParaBotaoNoCabecalho`, `:170-172`); com duas ou mais, cada bloco ganha seu próprio botão
também no desktop (`mostrarBotaoDesktopNoBloco`, `:174`), em vez de um botão do cabeçalho ambíguo
sobre qual fatura pagaria.

### D3 · Seletor de conta pagadora

Dropdown entre as contas `DEBITO` (`:291-352`, mesmo padrão de interação do filtro de conta do
extrato — reaproveitado, não uma UI nova), default na primeira (`carregarContasInicial`, `:141`), e
o rótulo do botão nomeia a conta escolhida (`rotuloBotao`, `:349-352`) — nunca "conta corrente"
fixo como no protótipo.

### D4 · Seletor de cartão

Aparece só com 2+ contas `CREDITO` (`v-if="cartoes.length > 1"`, `:389`). Ausente com um cartão só
— a família de teste tem hoje um cartão, então este seletor nunca aparece nem no gate nem em
teste, mas o código já o cobre. O `contaId` da URL (query) é a porta 1 do recorte de desenho ("Ver
fatura" no cartão de `contas.vue`, EF-02 — fora de escopo desta tarefa, só consumido aqui); sem
ele, cai no fallback "primeiro cartão" (`cartaoInicial`, `:128-135`).

### Duas strings de vazio, inventadas por esta tela (nenhuma do desenho)

1. **"Nenhum cartão de crédito cadastrado ainda."** (`:117,382`) — família sem nenhuma conta
   `CREDITO`. Não é o V5 nem nenhum V-número do recorte de desenho — aquela seção só discute "zero
   cartão" dentro do V4 ("tela de faturas no plural"), nunca o caso de não haver cartão nenhum pra
   abrir. Ver MC-05, `EF05-MC-004`.
2. **"Nenhum lançamento neste ciclo ainda."** (`:493`) — esta sim é o V5 do recorte: "como fica a
   tela de um cartão sem compras no ciclo: sem desenho." O único vazio que o desenho de fato
   antecipa é outro — o toast "Não há fatura em aberto nesse cartão." (409 `fatura_sem_valor`), que
   chega via `erroPagamento`/`mensagemDoErro` sem texto inventado.

### Composable — `web/app/composables/useFaturas.ts` (53 linhas)

`listarFaturas(contaId)` e `pagarFatura(faturaId, {pagaComContaId})`, únicos pontos de acesso HTTP
a `faturas`. Tipos de `@orcamento/contrato` — zero redeclaração. Nunca soma nada (nem total, nem
limite livre): os dois chegam derivados na resposta.

### Tempo real na tela

Assina `faturas` e `contas` (não `lancamentos` — a tela não lê extrato). Ao invalidar, refaz
`atualizarContas()` + `carregarFatura()` em paralelo, sem tocar na seleção do usuário (cartão ou
conta pagadora escolhidos permanecem).

## Costura reportada, não implementada nesta história (fora de escopo de pasta)

- ~~`faturaAviso` (card "EM CONTA HOJE" da tela `contas`, EF-02) e os botões "Ver fatura"/"Pagar
  fatura" direto da lista de contas~~ — **fechado pela história #74** (tarefa #110, mesclada em
  `e3c7c4a`). Ambos viviam em `contas.vue`, fora do escopo de arquivo desta história; viraram
  história própria, com as duas ambiguidades do desenho (conta pagadora e qual fatura pagar)
  escaladas como fork e decididas pelo humano antes do código. Detalhe as-built em
  [MANUAL-02](MANUAL-02-contas.md), seção "As duas portas da fatura".
- "Contas" acender como aba ativa enquanto a tela `fatura` está aberta — é do layout
  (`navegacao.ts`/shell), não desta pasta.
- `EF05-MC-002` (MC-05) — `POST /lancamentos` não invalida `contas`/`faturas`; lacuna herdada da
  EF-04, não desta história.

## O que não foi portado do mockup

As duas armadilhas que a EF-05 §4 nomeia explicitamente, confirmadas linha a linha no protótipo
(`.preator/tmp/recorte-desenho-19.md` §5, não versionado):

1. **Pagar reatribuía os lançamentos** (`lancs: s.lancs.map(l => l.conta === id ? {...l, conta:
contaPagadora} : l)`) — não portado; RN-24 garante que nenhum `UPDATE` toca `lancamentos.contaId`.
2. **O ciclo era ignorado** (`faturaDe = id => s.lancs.filter(l => l.conta === id && l.v > 0 &&
!l.mesRel)` — soma pelo mês civil, `fechamento` nunca entra na conta) — não portado; RN-23
   agrupa por `fechaEmDoCiclo`, nunca pelo mês da compra.

Também não portado: `contaPagadora` fixa como "a primeira conta de débito que aparecer" (vira D3,
escolha explícita do usuário); o `Math.max(0, ...)` que o protótipo aplicava ao limite livre como
piso (a EF-06 não fala em piso — se o backend puder devolver negativo, é decisão do humano, não
inventada aqui: hoje `limiteLivreCentavos` não tem piso nenhum aplicado, `servico.ts:330`).

## Prova rodada (evidência)

Re-executada pelo condutor, independente do relato dos agentes, em toda tarefa desta história —
carimbo citado no próprio commit de merge:

1. **#69** (skill): `cf2268f`. "Gate PASS + revisão APROVADA".
2. **#70** (backend, módulo): `1a102bf`. "Gate PASS + revisão APROVADA em `b52b45f`" — inclui a
   correção de defesa em profundidade (`familiaId` explícito nas duas queries internas) e a
   costura de RN-18 em `lancamentos.teste.ts`, resolvida pelo condutor como sem dono de tarefa
   única.
3. **#71** (tela): `24be46e`. "Gate PASS + revisão APROVADA em `283685f`" — inclui o fork
   ratificado (2+ faturas fechadas, um bloco cada) e a correção de cabeçalho que declara as duas
   strings de vazio inventadas.
4. **#72** (qa — os seis casos do DoD): `fa741e2`. "Gate PASS + revisão APROVADA em `a8fab42`".
5. **#73** (docs — esta tarefa): commit ainda sem hash no momento em que este texto foi escrito —
   nenhuma tarefa consegue citar o hash do próprio merge antes de ele existir. Confira com
   `git log --oneline --first-parent main..historia/19-ef-05-faturas`.

```
build        PASS  (bloqueante)
test(N>0)    PASS  (bloqueante) — 207 testes executados em 15 arquivos, faturas.teste.ts (16) +
                                  faturas-ciclo.teste.ts (6) entre eles
front        PASS  (bloqueante)
typecheck    PASS
lint         PASS
deadcode     PASS
contrato     PASS  (bloqueante)
navegacao    PASS  (bloqueante) — inclui a rota /faturas
PROVA_DE_COMPORTAMENTO=PASS
```

Bloco acima citado a partir do carimbo de cada merge (#69 a #72) — esta tarefa (#73), de
documentação, não toca `api/`/`web/`/`.preator/skills/` e portanto não altera nenhum destes oito
números — estas oito linhas são evidência POR TAREFA. O carimbo de NÍVEL-HISTÓRIA que fecha
o DoD da #19 de fato é aplicado por `carimbar-issue.sh 19` (`preator/esteira/motor/issues/carimbar-issue.sh`),
na branch da história, depois da revisão de costura sobre a árvore integrada inteira — não
executado ainda no momento em que este texto foi escrito.

**O que o `PASS` NÃO cobriu, medido — não afirmado:** o botão de pagar, os dois dropdowns (D3/D4)
e o layout dos blocos (D2) ficam atrás de interação de tela que o crawler do gate de navegação não
exercita — ele abre a rota `/faturas`, não clica no botão nem abre os seletores. O seletor de
cartão (D4) nunca renderizou nem em teste nem no gate, porque a família semeada tem no máximo um
cartão. Ver MC-05, itens de tela.

## O que ainda não é desta EF

A **navegação entre ciclos** (fatura anterior/próxima) não tem desenho nem está no DoD — fica para
uma tarefa futura, se o produto precisar (MC-05, `EF05-MC-001`). A **agregação do lastro entre
todos os cartões e a combinação com o caixa real** é da [EF-06](../especificacoes/EF-06-lastro.md)
(#20) — esta EF só fornece `saldoCentavos`/`limiteLivreCentavos` **por cartão**, já com D1 aplicada.
