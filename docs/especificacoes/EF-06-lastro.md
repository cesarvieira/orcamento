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
limiteLivre    = Σ (limite − fatura em aberto) dos CARTÕES
lastro         = caixaReal + limiteLivre

restanteTotal  = Σ max(0, teto − gasto) das categorias
déficit        = max(0, restanteTotal − lastro)

por categoria:
  bloqueado    = disponível × déficit / restanteTotal        ← pró-rata
  liberado     = disponível − bloqueado
```

| # | Regra | Fonte |
|---|---|---|
| RN-27 | A conta `RESERVA` **não entra** no lastro | decisão humana |
| RN-28 | O **limite livre do cartão entra** no lastro | decisão humana |
| RN-29 | O déficit é rateado **pró-rata**; não há categoria privilegiada | decisão humana |
| RN-30 | O número em destaque é `restante − déficit`. O app **nunca** mostra o plano cheio como gastável | mockup |
| RN-31 | Entrada de dinheiro **desbloqueia**; não aumenta teto nenhum | decisão humana |
| RN-32 | O resíduo do rateio vai para a categoria de maior saldo; a soma dos bloqueados é exatamente o déficit | [D-06](../decisoes/D-06-dinheiro-em-centavos.md) |

**As três sub-decisões, cada uma deliberada:**

**A reserva fica de fora** porque o dinheiro da poupança está comprometido com as metas. Contá-lo
deixaria a família consumir a reserva de emergência sem perceber.

**O limite do cartão entra** porque é dinheiro gastável neste mês, mesmo que a conta chegue
depois. Ignorá-lo tornaria o bloqueio pessimista demais para ser útil.

**O rateio é pró-rata, não por prioridade.** Todas as categorias perdem a mesma fração. Quem
quiser priorizar **remaneja** ([EF-03](EF-03-orcamento.md)) — que é ato consciente e auditável.

---

## §3 — Telas

**Referência de tela:** tela `home` do mockup — o cartão de aviso de plano bloqueado e a **parte
hachurada** das barras de categoria.

| Elemento | Onde | Conteúdo |
|---|---|---|
| Aviso de déficit | topo da home | *"R$ X do plano está bloqueado"* + o motivo |
| Barra da categoria | lista | parte cheia (gasto) + parte hachurada (bloqueado) |
| Rótulo | categoria | `parcial` quando há bloqueio |

---

## §4 — O que não se copia do protótipo

`cenarioSemLastro` força o déficit a 55% para a demonstração. É chave de mockup, não regra.

---

## §5 — Definition of Done

- [ ] Um teste por RN acima
- [ ] **Soma dos bloqueados == déficit**, com valores quebrados
- [ ] Sem déficit → bloqueado zero em todas
- [ ] O bloqueado de uma categoria **nunca** excede o disponível dela
- [ ] Receita lançada reduz o bloqueado e **não altera nenhum teto**
- [ ] Guardar em meta reduz o lastro (o dinheiro passou a estar comprometido)
- [ ] `PROVA_DE_COMPORTAMENTO=PASS`
