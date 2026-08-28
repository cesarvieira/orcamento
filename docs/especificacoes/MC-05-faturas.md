# MC-05 — Matriz de Completude · Faturas

> O que **falta** decidir/construir/validar para EF-05 alcançar padrão implantável. Não repete o
> que a EF já resolveu. Ver [EF-05](EF-05-faturas.md) (o contrato) e
> [MANUAL-05](../manual/MANUAL-05-faturas.md) (o que foi construído).

- **Conteúdo base:** Com conteúdo — toda tarefa mesclada nesta história fechou
  `PROVA_DE_COMPORTAMENTO=PASS` e revisão `APROVADA` (lista viva, na ordem real — não envelhece
  como uma contagem fixa neste texto: `git log --oneline --first-parent
main..historia/19-ef-05-faturas`). O DAG avalizado pelo humano na abertura da #19 listava
  exatamente #69 (skill), #70 (backend), #71 (tela), #72 (os seis casos do DoD) e #73
  (documentação, esta tarefa) — **nenhuma tarefa nasceu fora da decomposição original** nesta
  história (ao contrário da EF-04, que teve quatro tarefas de defeito/costura não planejadas).
  RN-23 a RN-26 estão provadas por teste de integração real, contra Postgres e HTTP reais — nunca
  handler com fake.
- **Confiança:** Alta (arquivos de teste e código lido linha a linha pelo agente `docs`, mais o
  carimbo `Gate PASS + revisão APROVADA` citado no próprio commit de merge de cada tarefa — `cf2268f`
  #69, `1a102bf` #70, `24be46e` #71, `fa741e2` #72 — re-executado pelo condutor).
- **Critério de completude:** igual ao de [MC-00](MC-00-plataforma.md) a [MC-04](MC-04-lancamentos.md)
  — `Concluído` quando o gate prova de forma reproduzível; `Parcial` quando o código existe mas não
  há prova automatizada, ou a prova não alcança o caso; `Pendente` quando nem o código existe.

## Matriz de completude

| Área | Capacidade esperada | Status | O que falta / evidência |
| --- | --- | --- | --- |
| Dados | `Fatura` (cartão × ciclo): `abreEm`/`fechaEm`/`venceEm`/`status`/`pagaEm`/`pagaComContaId`, não soma calculada na hora | Concluído | `api/src/db/schema.ts:612-651`; migration `api/drizzle/0007_unusual_leech.sql`. Identidade do ciclo é `(contaId, fechaEm)` — índice único `faturas_conta_fecha_em_unico`. CHECK `faturas_pagamento_completo_ou_ausente` impede "meio paga" (RN-24 nunca deixa `status='PAGA'` sem `pagaEm`/`pagaComContaId`, nem o contrário) |
| RN-23 · ciclo, não mês civil | A compra entra na fatura cujo ciclo de fechamento contém a data | Concluído | `fechaEmDoCiclo` (`api/src/modulos/faturas/dominio.ts:59-63`) — "menor ou igual ⇒ mesmo mês; maior ⇒ mês seguinte". Testado: `faturas.teste.ts:163-206` (RN-23, mesmo cenário no arquivo de #70) e `faturas-ciclo.teste.ts:267-320` (Caso 1/2, tarefa #72 — mesmo mês civil, duas faturas diferentes, a prova de que não é o mês civil que decide) |
| Parcela atravessa ciclos | Cada parcela é resolvida independentemente pela mesma regra, sem tratamento especial | Concluído | `faturas.teste.ts:213-254` (#70) e `faturas-ciclo.teste.ts:333-377` (Caso 3, #72 — inclui virada de ano novembro/2025→janeiro/2026, caso que #70 não cobria) |
| RN-24 · pagar é transferência | `POST /faturas/:id/pagar` gera uma `TRANSFERENCIA`; os lançamentos originais mantêm `contaId` | Concluído | `api/src/modulos/faturas/servico.ts:381-413` (`pagarFatura`, transação: só um INSERT de `TRANSFERENCIA`, nenhum UPDATE em `lancamentos.contaId`). Testado: `faturas.teste.ts:261-394` (RN-24, incl. D3 — conta pagadora do corpo, 400 se igual ao cartão, 404 fatura inexistente) e `faturas-ciclo.teste.ts:387-463` (Caso 4, #72 — extrato por cartão continua correto após pagar UMA fatura, com OUTRA ainda aberta no mesmo cartão) |
| RN-25/D1 · saldo exibido do cartão | Soma de TODA fatura não paga (`ABERTA` + `FECHADA`), não só o ciclo corrente | Concluído | `api/src/modulos/faturas/servico.ts:293-303` (`ne(faturas.status, 'PAGA')`, nunca `eq(status,'ABERTA')`); `api/src/modulos/contas/servico.ts#expressaoSaldoDerivado` (saldo de uma `CREDITO` = `−Σ(fatura em aberto, D1)`, sem exceção para `CREDITO` desde esta EF). Testado: `faturas.teste.ts:401-463` (RN-25/RN-26 — desconta a FECHADA aguardando pagamento, não só a corrente) e `faturas-ciclo.teste.ts:473-537` (Caso 5, #72 — compara explicitamente o valor certo com a leitura estreita rejeitada por D1, depois prova que só o PAGAMENTO recompõe o limite, nunca o fechamento) |
| RN-26 · limite livre | `limite − Σ(fatura em aberto, D1)` | Concluído | `servico.ts:330` (`limiteLivreCentavos = limite + saldoCentavos`, seguro porque `saldoCentavos` de uma `CREDITO` já é negativo). Testado: mesmos `faturas.teste.ts:452-467` ("sem nenhuma compra, limiteLivreCentavos é o limite inteiro") e Caso 5 acima |
| D1 · a decisão em si | "Fatura em aberto" = toda fatura não paga, registrada como fonte primária, superando a leitura estreita de RN-25/EF-06 §2 | Concluído (esta tarefa) | `.preator/skills/negocio/faturas-e-ciclo-do-cartao/SKILL.md` (registro original, tarefa #69); `EF-05-faturas.md` §2 e `EF-06-lastro.md` §2 corrigidos por esta tarefa (#73) — ver MANUAL-05, seção "As mudanças exatas em EF-05 §2 e EF-06 §2" |
| RN-24/D3 · conta pagadora escolhida | `pagaComContaId` vem do corpo do POST, nunca inferida como "primeira conta de débito" (armadilha do protótipo) | Concluído | `api/src/modulos/faturas/esquemas.ts:91-98` (`EsquemaPagarFatura`, campo obrigatório); `rotas.ts:135-150`. Testado: `faturas.teste.ts:340-368` ("D3 — a conta pagadora vem do REQUEST") |
| Tempo real — invalidação | Pagamento invalida `faturas`, `contas` E `lancamentos` (as três leituras que uma transferência real afeta) | Concluído | `api/src/modulos/faturas/rotas.ts:39-52` (`invalidarPagamento`, três chamadas). Testado com socket real, um único POST HTTP observado por três conexões simultâneas: `faturas-ciclo.teste.ts:576-650` (Caso 6, parte 2 — dois clientes da MESMA família de A recebem `faturas` e `contas`; B, outra família, não recebe nada) |
| Isolamento entre famílias | Família B não lê nem paga fatura de A | Concluído | `faturas.teste.ts:498-529` e `faturas-ciclo.teste.ts:546-574` (Caso 6, parte 1 — 404 em `GET`/`POST`, nunca 200/403) |
| Tela — cabeçalho, aviso, itens, botão de pagar | `faturaDatas` ("fecha dia X · vence dia Y · limite livre Z"), aviso literal do mockup, itens reaproveitando `mapLanc`, botão de pagar | Concluído (código), **sem exercício por máquina dedicado** | `web/app/pages/faturas.vue` (553 linhas). O gate de navegação abre a rota `/faturas` (`web/app/config/navegacao.ts:89-92`), mas — mesma limitação de MC-04 EF04-MC-004 — não há harness que clique no botão de pagar nem abra os seletores; layout real, dropdown D3/D4 e o vazio por bloco foram lidos, não vistos rodando |
| D2 · dois blocos | Fatura fechada aguardando pagamento (cada uma com botão próprio, se houver mais de uma) + ciclo corrente acumulando (sem botão) | Concluído (código), sem teste dedicado de tela | `faturas.vue:176-210` (`blocos`, `faturaParaBotaoNoCabecalho`, `mostrarBotaoDesktopNoBloco` — o fork ratificado: 2+ fechadas, cada bloco ganha botão próprio, o cabeçalho não escolhe). O backend já devolve corretamente múltiplas `FECHADA`s no array (ver RN-25/D1 acima); a tela consome, mas nenhum teste de front verifica o layout com 2+ blocos fechados |
| D3 · seletor de conta pagadora (tela) | Dropdown entre contas `DEBITO`, default na primeira, rótulo nomeia a conta escolhida | Concluído (código) | `faturas.vue:291-352`. O lado do backend (campo obrigatório, nunca inferido) está testado (ver RN-24/D3 acima); o dropdown em si não |
| D4 · seletor de cartão (tela) | Aparece só com 2+ contas `CREDITO`; `?contaId=` da URL com fallback pro primeiro | Concluído (código), **nunca exercitado** | `faturas.vue:264-289,388-421`. A família de teste (seed) tem no máximo um cartão em qualquer cenário observado — o seletor nunca aparece nem no gate nem em teste, mesma classe de limitação de MC-04 (seed sem dado para o caso "2+") |
| Estado vazio — zero cartões | "Nenhum cartão de crédito cadastrado ainda." | Concluído (código), sem teste dedicado | `faturas.vue:117,382` (`semCartoes`). String inventada pela tela, sem fonte no desenho — ver Lacuna `EF05-MC-004` |
| Estado vazio — ciclo sem compra | "Nenhum lançamento neste ciclo ainda." (V5 do recorte) | Concluído | `faturas.vue:493`. É o único vazio de tela que o recorte de desenho de fato antecipa (V5) |

## Lacunas

| Código | Lacuna | Impacto | Prioridade |
| --- | --- | --- | --- |
| EF05-MC-001 | **Navegação entre ciclos (fatura anterior/próxima) não existe.** Não está no DoD (EF-05 §5) e não tem desenho — o recorte do condutor já registrava isto como V2 ("não há navegação entre ciclos. Um cartão, um ciclo, o corrente"). A tela mostra a(s) fatura(s) `FECHADA(S)` mais o ciclo `ABERTA`, nunca faturas `PAGA`s antigas. | Quem quiser consultar o histórico de faturas já pagas não tem como, hoje | Baixa — fora de escopo desta história; nenhuma fonte pede isto ainda |
| EF05-MC-002 | **`POST /lancamentos` não invalida `contas` nem `faturas`.** Uma compra no cartão feita em outra aba não atualiza `/faturas` nem `/contas` ao vivo — só `/extrato` recebe a invalidação (`api/src/modulos/lancamentos/rotas.ts:44-50`, só emite `recurso:'lancamentos'`). **Não é defeito desta história**: `contas.vue` tem exatamente a mesma lacuna, e ela é anterior, da EF-04 — o DoD da EF-05 exige a invalidação **do pagamento** (RN-24), que existe e está provada (`faturas-ciclo.teste.ts:576-650`, Caso 6). Uma compra nova não é o que o DoD pede. | Um segundo membro da família vendo `/faturas` não vê uma compra nova no cartão até recarregar a página | Média — herdada da EF-04; se corrigida, deveria ser uma tarefa própria que cubra os dois módulos de uma vez, não remendo local |
| EF05-MC-003 | **Sinal negativo sai como hífen-menos (`-`), não o `−` tipográfico do mockup.** `formatarCentavos` (`web/app/utils/dinheiro.ts:29`) usa `toLocaleString('pt-BR', {style:'currency'})`, que produz `-R$ 150,00`, não `−R$ 150,00`. | Cosmético — divergência tipográfica sem efeito funcional | Baixa — o utilitário é compartilhado por toda a pilha; corrigir aqui corrigiria em todo lugar, não é ponto isolado de faturas |
| EF05-MC-004 | **Um sexto vazio de tela que o recorte do condutor não enumerou: "nenhum cartão de crédito cadastrado".** O §6 do recorte (`.motor/recorte-desenho-19.md`, não versionado) lista V1 a V5 e nunca cobre o caso de **zero cartões** — o V4 só trata "um cartão" e "dois ou mais". A tela (#71) resolveu com uma string própria (`faturas.vue:117,382`), declarada no cabeçalho do `.vue` como invenção sem fonte. | Comportamento correto (a tela não quebra sem cartão), mas sem desenho que o valide | Baixa — registrado como lacuna **da fonte** (o recorte), não da implementação da tela |
| EF05-MC-005 | **Tautologia pontual em `faturas-ciclo.teste.ts:118`**: `const FECHA_EM_CORRENTE = fechaEmDoCiclo(DIA_FECHAMENTO, HOJE);` chama a própria função de produção que a suíte deveria estar testando, em vez de calcular a data à mão. Inofensiva porque os Casos 1 e 2 (a comparação central de RN-23) calculam `FECHA_EM_FECHADA`/`FECHA_EM_DIA_SEGUINTE` manualmente (`:136-138`) — só o ciclo CORRENTE (usado como "control group" vazio nos Casos 1, 4 e 5) usa a função de produção para achá-lo. Um defeito em `fechaEmDoCiclo` que afetasse igualmente a produção e este cálculo não seria pego por essas asserções específicas. | Nenhuma regressão de RN-23 escaparia (os casos manuais cobrem isso); uma regressão que mudasse a definição de "ciclo corrente" de forma consistente entre produção e teste não seria detectada por essas asserções pontuais | Baixa — cosmética de teste; não bloqueante |
| EF05-MC-006 | **Da skill de negócio (#69), já registradas como lacuna lá, repetidas aqui por completude:** (a) primeiro ciclo de um cartão recém-cadastrado — nenhuma fonte define o corte inicial de `abreEm`, resolvido com uma fórmula uniforme e um fork declarado (`dominio.ts:71-79`); (b) pagamento parcial de fatura — nenhuma fonte descreve, o fluxo assume quitação integral; (c) exclusão/edição de parcela cuja fatura já fechou ou foi paga — nenhuma fonte relaciona exclusão de série com o estado da fatura (mesma lacuna já registrada do lado de `lancamentos-e-parcelamento`). | Três cenários reais de uso sem regra escrita; nenhum tem teste porque nenhum tem especificação | Média — (a) e (c) podem produzir estado surpreendente se algum destes fluxos for exercitado em produção antes de uma decisão explícita |

## Riscos de implantação

| Risco | Severidade | Mitigação |
| --- | --- | --- |
| Um caminho novo chamar `encontrarFatura`/o SELECT de `listarFaturasDoCartao` sem validar o cartão primeiro, vazando fatura entre famílias | Baixa | `familiaId` já está no WHERE das duas consultas, como defesa em profundidade — não depende de disciplina do chamador (`servico.ts:168-186,293-303`, comentário explícito) |
| A EF-06 implementar `limiteLivre` filtrando só `status = 'ABERTA'` — a leitura estreita que D1 rejeitou, por colisão de nome entre o enum e o termo de negócio | Alta | D1 está registrado em três lugares agora: a skill (#69), `EF-05-faturas.md` §2 e `EF-06-lastro.md` §2 (ambos corrigidos por esta tarefa) — e o `saldoCentavos`/`limiteLivreCentavos` que a EF-06 vai consumir **já implementam** D1 no backend, então a EF-06 nem precisa recalcular, só ler |
| `EF05-MC-002` (lançamento não invalida `contas`/`faturas`) ser corrigido só localmente em faturas, divergindo de como a EF-04 fizer em `contas.vue` | Baixa | Registrado explicitamente como herdada da EF-04, não desta história — quem corrigir deveria tratar os dois de uma vez |

## Validações obrigatórias para implantação

| Validação (EF-05 §5) | Resultado esperado | Status |
| --- | --- | --- |
| Compra no dia do fechamento | Cai na fatura que fecha hoje, não na seguinte | Provado — `faturas-ciclo.teste.ts:267-306` (Caso 1) |
| Compra no dia seguinte ao fechamento | Cai na fatura seguinte, mesmo mês civil da primeira | Provado — `faturas-ciclo.teste.ts:308-313` (Caso 2) |
| Parcela que atravessa ciclos | Cada parcela na fatura do seu próprio ciclo, sem tratamento especial | Provado — `faturas-ciclo.teste.ts:333-377` (Caso 3, inclui virada de ano) |
| Após o pagamento, o extrato filtrado por cartão continua correto | Nenhum lançamento original muda de `contaId` | Provado — `faturas-ciclo.teste.ts:387-463` (Caso 4) |
| O limite livre reflete a fatura em aberto (D1: toda fatura não paga) | Desconta FECHADA + ABERTA; só recompõe no pagamento | Provado — `faturas-ciclo.teste.ts:473-537` (Caso 5) — texto do DoD corrigido nesta tarefa para não repetir a ambiguidade de "ciclo corrente" que D1 resolveu (ver EF-05 §5) |
| Isolamento entre famílias · dois clientes veem o pagamento sem refresh | 404 para B; os dois clientes de A recebem `faturas`+`contas` sem refresh | Provado — `faturas-ciclo.teste.ts:546-650` (Caso 6, as duas partes) |
| `PROVA_DE_COMPORTAMENTO=PASS` | 8/8 gates, `fails=0`, `skips_bloqueantes=0` | Provado em toda tarefa mesclada desta história — carimbo citado no próprio commit de merge: `cf2268f` (#69), `1a102bf` (#70), `24be46e` (#71), `fa741e2` (#72). A suíte roda **207 testes** em **15 arquivos** (`faturas.teste.ts`: 16; `faturas-ciclo.teste.ts`: 6) — contagem conferida por esta tarefa contando literalmente `it(` em `api/testes/*.teste.ts` |

## Pendências de decisão

Nenhuma em aberto. **D1** ("fatura em aberto" = toda fatura não paga) foi decidida pelo humano em
2026-08-27/2026-08-28, **antes de qualquer código desta história** — não é co-evolução de regra e
código, é o fork que foi escalado e decidido primeiro. **D2** (dois blocos), **D3** (seletor de
conta pagadora) e **D4** (seletor de cartão) foram autorizadas pelo humano durante a tarefa #71,
como superfície de tela que o desenho não cobre — ver MANUAL-05 para o detalhe de cada uma. As
lacunas registradas acima (`EF05-MC-001` a `-006`) são de **fora de escopo declarado** (navegação
entre ciclos), **dependência de módulo irmão anterior** (EF-04, invalidação de `lancamentos`),
**cobertura de teste/tela sem exercício por máquina**, ou **lacuna de fonte já registrada pela
skill de negócio** — nenhuma é decisão em aberto que bloqueie a EF-06.

## Próximo passo

A **EF-06** (Lastro, #20) é a consumidora direta desta EF — ela lê `saldoCentavos` e
`limiteLivreCentavos` das contas `CREDITO`, ambos já implementando D1 (ver `contas/servico.ts` e
`faturas/servico.ts` acima), e não deveria precisar recalcular nada; RN-27/RN-28/RN-29 (EF-06 §2)
ficam livres para focar na agregação entre cartões e a combinação com o caixa real. `EF05-MC-002`
(invalidação de `lancamentos` sobre `contas`/`faturas`) fecha junto com a mesma lacuna herdada da
EF-04 em `contas.vue`, se e quando alguém tratar as duas de uma vez. `EF05-MC-001` (navegação entre
ciclos) fica para uma tarefa nova, com desenho próprio, se o produto precisar.

## Status final do ciclo

- [x] EF atualizada (`EF-05-faturas.md` §2 registra D1 com fonte "decisão humana"; §5 marca o DoD
      contra o teste que prova cada item; `EF-06-lastro.md` §2 corrigida para não herdar a
      ambiguidade — ver MANUAL-05)
- [x] MC criada
- [x] MANUAL as-built criado
- [x] Toda tarefa de construção desta história (#69 a #72) já estava carimbada `PROVA_DE_COMPORTAMENTO=PASS`
      com revisão `APROVADA`, citada no próprio commit de merge (conferido, não recarimbado por esta
      tarefa — fora do escopo de `docs`)
- [ ] PR aberto — a devolver pelo condutor após o merge desta tarefa (#73: fecha a tríade EF/MC/MANUAL
      desta história, a última tarefa do DAG da #19)
