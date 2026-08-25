# `@orcamento/contrato` — o contrato entre a API e o front

**Este pacote é SAÍDA, não fonte.** Nada aqui se edita à mão.

```
api (zod → OpenAPI)  →  packages/contrato (gerado)  →  web (importa)
```

| Arquivo             | O que é                                           |
| ------------------- | ------------------------------------------------- |
| `openapi.json`      | o documento OpenAPI, emitido do registro da API   |
| `src/gerado/api.ts` | a tradução crua do OpenAPI (`openapi-typescript`) |
| `src/index.ts`      | os apelidos por nome de esquema, também gerados   |
| `gerar.mjs`         | o gerador — este sim é código                     |

## Regenerar

```bash
pnpm run contrato:gerar
```

Roda `api → openapi:emitir` e depois a geração. O passo já está dentro de
`pnpm run build`, porque ele **precisa acontecer antes do typecheck do front**.

## Por que existe

Sem um artefato de contrato observável, o front redeclara o shape do back e as
duas declarações divergem em silêncio até alguém receber `.map is not a
function` em produção. É uma das quatro classes de falha que o verde não pega.

O gate `contrato` cobra duas coisas, com a API no ar:

1. nenhum enum sai **inteiro** no OpenAPI;
2. o front **não redeclara** à mão um tipo que o contrato já define.

Quem quiser mudar o contrato muda o **Zod da API** — `api/src/openapi/` — e
regenera. Ver [D-03](../../docs/decisoes/D-03-contrato-gerado.md).
