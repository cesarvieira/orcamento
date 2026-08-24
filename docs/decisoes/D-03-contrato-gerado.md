# D-03 — O contrato é gerado, e o front o importa

- **Status:** aceita
- **Data:** 2026-08-22

## Contexto

O princípio *"modela-se uma vez, gera-se o resto"* só é verificável se existir um artefato de
contrato observável entre back e front. Sem ele, o front redeclara o shape do back — e as duas
declarações divergem em silêncio até alguém receber `.map is not a function` em produção.

Essa é uma das quatro classes de falha que o verde não pega: **contrato front↔back divergente**.

## Decisão

O back publica **OpenAPI**. Um passo de geração produz os tipos em `packages/contrato`, e o front
os **importa**.

```
api (zod → OpenAPI)  →  packages/contrato (gerado)  →  web (importa)
```

`packages/contrato` é **saída, não fonte**: não se edita à mão, e o que está lá é descartável e
regenerável.

O gate `contrato` cobra exatamente isso, com `OPENAPI_URL` apontando para o endpoint vivo.

## Alternativas consideradas

**tRPC.** Dá tipos fim-a-fim sem passo de geração. Descartado: o contrato deixa de ser artefato
inspecionável, e o gate perde o que verificar. O acoplamento de tipos vira acoplamento de build.

**Escrever os tipos do front à mão.** Descartado: é literalmente a falha que o gate existe para
pegar.

**GraphQL.** Descartado por peso desproporcional ao produto, e porque o schema viraria uma
terceira declaração do modelo.

## Consequências

- Existe um passo de geração no build, e ele precisa rodar antes do typecheck do front.
- Mudança de shape no back quebra o front **na compilação**, não em runtime — que é o objetivo.
- Vale também para o tempo real: o socket transporta **invalidação**, não estado derivado, para
  não criar uma segunda fonte da verdade. Ver [D-04](D-04-tempo-real.md).
