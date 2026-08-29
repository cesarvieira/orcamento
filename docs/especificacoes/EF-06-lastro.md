# EF-06 — Lastro

> **A decisão que define o produto.** Se o leitor entender só uma EF, que seja esta.
>
> ⛔ **Escalada de Regra #0.** O conceito de lastro **não existe em skill nenhuma da fábrica** —
> `financeiro/` cobre conciliação de gateway e controladoria empresarial; `controladoria-orcamento`
> cobre orçado × realizado; nenhuma cobre finanças pessoais nem lastro. Não é conhecimento de
> domínio: é **regra de produto**, criada no mockup. Foi escalada ao humano e decidida com ele.
> Esta EF é a **única fonte**.

## §0 — Escopo & fronteira

**Pasta:** `api/src/modulos/lastro`.

**É transversal por natureza:** depende de contas, cartões, faturas e orçamento ao mesmo tempo. É
a **costura** entre os módulos — e a doutrina exige que a costura tenha dono explícito, porque
nenhum dono-de-pasta é dono do que fica entre as pastas.

---

## §1 — Dados

**Nenhuma entidade nova.** O lastro é **derivado**, sempre. Materializá-lo criaria uma segunda
verdade que diverge no primeiro lançamento retroativo.

---

## §2 — Regras

```
caixaReal      = Σ max(0, saldo) das contas de DÉBITO        ← reserva fica de fora
limiteLivre    = Σ (limite − fatura em aberto) dos CARTÕES    ← "fatura em aberto" = D1, ver EF-05 §2
lastro         = caixaReal + limiteLivre

restanteTotal  = Σ max(0, teto − gasto) das categorias
déficit        = max(0, restanteTotal − lastro)

por categoria:
  bloqueado    = disponível × déficit / restanteTotal        ← pró-rata
  liberado     = disponível − bloqueado
```

> **`fatura em aberto`, nesta fórmula, é a definição de D1** — [EF-05 §2](EF-05-faturas.md): toda
> fatura com `status` ≠ `PAGA` (a fechada aguardando pagamento **mais** a do ciclo corrente), nunca
> só o ciclo corrente isolado. Esta linha usava a mesma expressão sem qualificar escopo enquanto a
> RN-25 da EF-05 falava em "ciclo corrente" — duas fontes, mesma expressão, dois escopos possíveis;
> **D1** (decisão humana, 2026-08-28) fechou a ambiguidade a favor deste escopo amplo, o que a
> RN-26 da EF-05 já cita como fonte. Ver EF-05 §2 para o texto completo da decisão.

| #     | Regra                                                                                                                                                                                                                                                                                                        | Fonte                                                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| RN-27 | A conta `RESERVA` **não entra** no lastro                                                                                                                                                                                                                                                                    | decisão humana                                                                                |
| RN-28 | O **limite livre do cartão entra** no lastro                                                                                                                                                                                                                                                                 | decisão humana                                                                                |
| RN-29 | O déficit é rateado **pró-rata**; não há categoria privilegiada                                                                                                                                                                                                                                              | decisão humana                                                                                |
| RN-30 | O número em destaque é `restante − déficit`. O app **nunca** mostra o plano cheio como gastável                                                                                                                                                                                                              | mockup                                                                                        |
| RN-31 | Entrada de dinheiro **desbloqueia**; não aumenta teto nenhum                                                                                                                                                                                                                                                 | decisão humana                                                                                |
| RN-32 | O resíduo do rateio vai para a categoria de maior saldo — se ela não tiver folga (disponível − bloqueado) para absorvê-lo inteiro, o excedente cai em **cascata** para a próxima maior, e assim por diante; a soma dos bloqueados é exatamente o déficit, e nenhuma categoria recebe mais que seu disponível | [D-06](../decisoes/D-06-dinheiro-em-centavos.md) + extensão, tarefa #76/#78 (ver nota abaixo) |

**As três sub-decisões, cada uma deliberada:**

**A reserva fica de fora** porque o dinheiro da poupança está comprometido com as metas. Contá-lo
deixaria a família consumir a reserva de emergência sem perceber.

**O limite do cartão entra** porque é dinheiro gastável neste mês, mesmo que a conta chegue
depois. Ignorá-lo tornaria o bloqueio pessimista demais para ser útil.

**O rateio é pró-rata, não por prioridade.** Todas as categorias perdem a mesma fração. Quem
quiser priorizar **remaneja** ([EF-03](EF-03-orcamento.md)) — que é ato consciente e auditável.

**RN-32 — a cascata do resíduo (extensão registrada pela tarefa #76, ratificada em largura pela
#78).** A tabela acima já traz o texto atualizado; esta nota explica a mudança e onde ela é provada.
A letra
original ("o resíduo vai para a categoria de maior saldo") está no **singular** e não previa o caso
em que a maior categoria não tem folga suficiente (`disponível − bloqueado bruto`) para absorver o
resíduo inteiro — jogar o resíduo nela estouraria a invariante "o bloqueado nunca excede o
disponível" (DoD §5, item 4). A revisão de diff da tarefa #76 reproduziu o caso
(`disponíveis=[1,1,1], lastro=1`: déficit=2, cada bloqueado bruto é 0, resíduo=2, e dar os 2 a uma
categoria de disponível 1 já extrapola) e classificou a correção como 🔵 **extensão** da regra, não
uma regra nova: a implementação distribui o resíduo em cascata — maior saldo primeiro, só até a
folga dela, depois a próxima maior, e assim por diante — preservando ao mesmo tempo a LETRA ("maior
saldo primeiro") e o PROPÓSITO ("a soma fecha exatamente o déficit") de RN-32. Prova em código:
`api/src/modulos/lastro/servico.ts:136-160` (a derivação completa) e `:205-233` (o laço). Prova em
largura (empates e categoria de disponível zero no meio do laço), por #78:
`api/testes/lastro-rateio.teste.ts:545-610`. **Pendência declarada:** este texto atualiza a EF; a
skill de negócio `.preator/skills/negocio/contas-e-lastro/SKILL.md` ainda registra a letra
original de RN-32 sem a cascata — está fora do escopo de arquivo da tarefa #79 (docs), que não edita
skill. Fork aberto ao humano com a mesma proposta de texto (ver relato da tarefa #79).

---

## §3 — Telas

**Referência de tela:** tela `home` do mockup — o cartão de aviso de plano bloqueado e a **parte
hachurada** das barras de categoria.

| Elemento           | Onde         | Conteúdo                                          |
| ------------------ | ------------ | ------------------------------------------------- |
| Aviso de déficit   | topo da home | _"R$ X do plano está bloqueado"_ + o motivo       |
| Barra da categoria | lista        | parte cheia (gasto) + parte hachurada (bloqueado) |
| Rótulo             | categoria    | `parcial` quando há bloqueio                      |

---

## §4 — O que não se copia do protótipo

`cenarioSemLastro` força o déficit a 55% para a demonstração. É chave de mockup, não regra.

---

## §5 — Definition of Done

> **As-built (tarefa #79).** Cada item marcado contra a evidência que o prova — arquivo e linha,
> nunca "passou de memória". A matriz completa, por RN, está em
> [MC-06](MC-06-lastro.md#matriz-de-completude); aqui só o veredito e as decisões que a execução
> tomou. Fato duplicado é bug — a fórmula e os números do rateio não são repetidos aqui, só
> apontados.

- [x] Um teste por RN acima — `api/testes/lastro-rateio.teste.ts`, um `describe` por RN-27..RN-32
      (linhas `:200,:220,:235,:280,:310,:352` — ver MC-06)
- [x] **Soma dos bloqueados == déficit**, com valores quebrados — `lastro-rateio.teste.ts:393,447`
- [x] Sem déficit → bloqueado zero em todas — `lastro-rateio.teste.ts:456-481` (quatro categorias)
- [x] O bloqueado de uma categoria **nunca** excede o disponível dela — `lastro-rateio.teste.ts:408-449,545-610`
      e a derivação abaixo ("o cap do déficit")
- [x] Receita lançada reduz o bloqueado e **não altera nenhum teto** — `lastro-rateio.teste.ts:310-350`
- [x] Guardar em meta reduz o lastro (o dinheiro passou a estar comprometido) — provado **sem EF-07**
      (ver nota "a" abaixo) — `lastro-rateio.teste.ts:489-535`
- [x] `PROVA_DE_COMPORTAMENTO=PASS` — carimbado em cada merge (`f2b67aa` #76, `fccec4b` #77,
      `7d9f35d` #78); ver MC-06 para o número de testes por tarefa

### As decisões e derivações que a execução tomou

**(a) "Guardar em meta" provado sem EF-07.** `Meta` não é entidade — `api/src/db/schema.ts` não
declara nenhum `pgTable('metas', ...)` (conferido: a lista completa de tabelas do arquivo não inclui
uma). A tarefa #78 provou o efeito de RN-27 usando o que já existe: uma `TRANSFERENCIA` de `DEBITO`
para `RESERVA` (`schema.ts:67-71`, o enum `tipoLancamento` já tem `TRANSFERENCIA`) reduz o caixa real
exatamente pelo valor guardado — é a mesma regra (RN-27: reserva fora do lastro) expressa com o
vocabulário que já existe, não uma regra nova. Quando a [EF-07](EF-07-metas.md) nascer e formalizar
`Meta` como entidade, RN-35 daquela EF é a mesma RN-27 por outro nome — nenhum recálculo deveria ser
necessário aqui.

**(b) O texto da faixa de bloqueio ficou na variante DESKTOP** — decisão do humano, **2026-08-29**:
_"Conta corrente + limite dos cartões cobrem «lastro». A reserva fica fora do orçamento."_
(`web/app/pages/index.vue:264-265`). Motivo registrado: `lastro` e `reserva` são os termos do
produto (glossário da skill de negócio), e o plural ("cartões") está correto quando a família tem
mais de um cartão. **O mockup MOBILE diz outra coisa** — "limite do cartão" (singular) e "A poupança
está reservada para as metas" — e essa variante **não** foi portada. A divergência é do **desenho**
(o protótipo tem duas variantes de texto para o mesmo aviso, mobile e desktop, e esta tela é um
único template responsivo sem split), não do código: nada foi inventado, uma das duas fontes válidas
foi escolhida e a escolha está registrada aqui para não ser lida como bug depois.

**(c) ⭐ O cap do déficit — derivação, não invenção nova.** A primeira entrega da tarefa #76 (commit
`3aa59b1`) foi **REPROVADA** na revisão de diff: com `déficit = max(0, restanteTotal − lastro)` sem
teto, um `lastroCentavos` negativo (cartão acima do próprio limite — nenhum módulo trava isso hoje,
ver nota "e") produzia `déficit > restanteTotal`, e o rateio pró-rata bloqueava mais que o disponível
de pelo menos uma categoria (`liberadoCentavos` chegava negativo). O conserto (`1b81f1f`):

```
déficit = min(restanteTotal, max(0, restanteTotal − lastro))
```

**Isto não é regra nova.** As duas invariantes que este mesmo §5 já escrevia antes desta tarefa — "a
soma dos bloqueados é exatamente o déficit" e "o bloqueado de uma categoria nunca excede o disponível
dela" — forçam `déficit ≤ restanteTotal` por aritmética pura: se cada `bloqueado_i ≤ disponível_i` e
`Σ bloqueado_i == déficit`, então `déficit ≤ Σ disponível_i == restanteTotal`. Capar o déficit em
`restanteTotal` é a única leitura que preserva as duas invariantes ao mesmo tempo — nunca as duas
violadas, nunca uma delas abandonada. A derivação completa, comentada linha a linha, está em
`api/src/modulos/lastro/servico.ts:110-134`; o caso de regressão que a revisão reproduziu está
provado em `api/testes/lastro.teste.ts:255-292`.

**(d) ⭐ A cascata do resíduo é EXTENSÃO da RN-32, e foi registrada em §2.** A letra original de
RN-32 ("o resíduo do rateio vai para a categoria de maior saldo") está no singular e não previa o
caso em que a maior categoria não tem folga para absorver o resíduo inteiro. A implementação
distribui em cascata — maior saldo primeiro, só até a folga dela, depois a próxima — e a revisão de
diff da tarefa #76 classificou isto como 🔵 **extensão**, não citação literal. O texto atualizado de
RN-32 já está no §2 desta EF (ver acima). **A skill de negócio ainda não foi atualizada** — está
fora do escopo de arquivo da tarefa #79 (docs), que não toca `.preator/skills/`; fica registrado
aqui como pendência com dono ainda não designado, e foi aberto como fork ao humano com a mesma
proposta de texto (ver o relato da tarefa #79 ao condutor). Prova em código:
`api/src/modulos/lastro/servico.ts:136-160,205-233`; prova em largura (empates, categoria de
disponível zero no meio do laço, boundary exato): `api/testes/lastro-rateio.teste.ts:545-610`.

**(e) Follow-ups que a execução levantou — pendências nomeadas, não resolvidas por esta EF:**

- **Falta política para travar `DESPESA` além do `limiteCentavos` do cartão.** Hoje nenhum módulo
  (`lancamentos`, `faturas`) impede uma compra de deixar um cartão acima do próprio limite — é essa
  lacuna, não o rateio do lastro, que decide se `lastroCentavos` chega negativo na prática. O cálculo
  do lastro já é determinístico em qualquer sinal (nota "c" acima); a pergunta "a compra deveria ter
  sido bloqueada antes de chegar aqui?" é de **outra EF**, não desta.
- **Risco teórico de overflow de `Number`** em `disponível × déficit`
  (`api/src/modulos/lastro/servico.ts:199`) no limite de 32 bits — pré-existente ao lastro, o mesmo
  teto que [D-06](../decisoes/D-06-dinheiro-em-centavos.md) já documenta para `integer` no Postgres
  (~R$ 21 milhões em centavos). Nenhum teste desta história exercita esse limite; registrado como
  risco baixo, não como defeito.
- 🟡 `web/app/pages/index.vue:3` cita `.preator/tmp/recorte-desenho-18.md` (com o prefixo `.preator/tmp/`)
  enquanto a linha `:5` do mesmo parágrafo diz que o recorte da EF-06 fica "também na raiz do
  worktree" (sem esse prefixo) — duas convenções de caminho diferentes no mesmo comentário. **Não
  corrigido aqui** — é arquivo de #77, fora do escopo de pasta da tarefa #79 (só `docs/`). Registrado
  por completude (ver MC-06, `EF06-MC-005`).

**(f) Uma restrição de fan-out MEDIDA nesta execução (fora de escopo desta EF e desta MC).**
`preator-perfil.sh:92-99` fixa o projeto compose (`-p orcamento-teste`) e as portas `3010`/`3011`
para o gate; dois gates simultâneos disputando o mesmo projeto e as mesmas portas colidem. Isto
aconteceu **duas vezes** nesta história: um FAIL falso no gate do revisor da tarefa #77 (diagnosticado
por `curl` contra a porta errada) e, mais grave, um FAIL falso no gate do revisor da tarefa #78 que
**sobrescreveu o carimbo de máquina** de uma tarefa correta — sem uma re-execução isolada depois, essa
tarefa não teria mesclado. Isolado (um gate por vez), tudo passa. O conserto real — projeto compose e
portas derivados do worktree, não fixos no perfil — é mudança de perfil/fábrica, não desta história;
não registrado em arquivo por esta tarefa (fora do escopo declarado de `docs/especificacoes` e
`docs/manual`) — proposto como fork ao humano no relato desta tarefa (#79), com sugestão de destino
em `docs/decisoes/` (próximo número livre, `D-08`) ou um ponteiro em `.preator/CONTEXT.md`.
