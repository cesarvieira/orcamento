# D-06 — Dinheiro é inteiro em centavos, em toda a pilha

- **Status:** aceita
- **Data:** 2026-08-22

## Contexto

Este produto divide dinheiro em dois lugares onde a soma das partes **tem** que fechar com o todo:

- o **rateio pró-rata do lastro**, que reparte o déficit entre N categorias;
- o **parcelamento**, que reparte um total entre N parcelas.

O protótipo usa `float` com `Math.round(v * 100) / 100` espalhado. É a origem clássica do centavo
que evapora — e num app cujo propósito é dizer quanto se pode gastar, um centavo perdido a cada
rateio corrói a única coisa que ele vende: confiança no número.

## Decisão

**Inteiro em centavos**, no banco, na API, no contrato e no front.

```ts
valorCentavos: number   // 31240 → R$ 312,40
```

Formatação para exibição acontece **só na borda**, no componente.

Onde houver divisão, **o resíduo tem destino explícito e documentado**:

| Divisão | Destino do resíduo |
|---|---|
| Parcelamento | a **última** parcela — a soma das parcelas é sempre exatamente o total |
| Rateio do lastro | a categoria de maior saldo — a soma dos bloqueados é exatamente o déficit |

## Alternativas consideradas

**`decimal`/`numeric` no Postgres com biblioteca de decimal no app.** Correto e comum. Descartado
por atrito: exige um tipo não-nativo atravessando ORM, JSON, contrato e front, e o ganho sobre
inteiro em centavos é nulo quando a menor unidade do negócio é o centavo.

**Float com arredondamento na borda.** É o que o protótipo faz. Descartado — ver o contexto.

## Consequências

- **`integer` no Postgres é de 32 bits:** teto de ~R$ 21 milhões em centavos. Suficiente para
  orçamento familiar. A escolha entre `integer` e `bigint` fica explícita no schema, comentada, e
  não inferida pelo ORM.
- Todo teste de divisão precisa de um caso com valor quebrado — `100,00` em 3× é o mínimo.
- Nenhum valor monetário trafega como `number` de reais em lugar nenhum, nem em log.
