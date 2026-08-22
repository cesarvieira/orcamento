# Padrões — como se constrói aqui

> O conhecimento universal vem das skills da fábrica (`preator/conhecimento/tecnico/`). Aqui ficam
> só as **decisões deste projeto** e os *overrides*. Domínio e linguagem em
> [DOMINIO.md](DOMINIO.md); ambiente e gates em [AMBIENTE.md](AMBIENTE.md).

---

## Dinheiro

**Inteiro em centavos, em toda a pilha.** Banco, API, contrato, front. Nunca `float`, nunca
`number` representando reais, nunca `Math.round(v * 100) / 100`.

```ts
valorCentavos: number   // 31240  → R$ 312,40
```

O protótipo usa float com arredondamento espalhado. É a origem clássica do centavo que evapora:
o rateio pró-rata do lastro divide um valor entre N categorias, e o parcelamento divide entre
N parcelas. Nos dois casos a soma das partes **tem** que fechar com o todo.

Onde houver divisão, o resíduo tem destino explícito — na última parcela (RN-PAR-002), na maior
categoria no rateio. Formatação para exibição acontece **só na borda**, no componente.

## Datas e competência

`data` e `competencia` são campos **distintos** e nunca derivados um do outro na hora da leitura.

- `data` — quando o fato aconteceu (`DATE`)
- `competencia` — a qual mês do orçamento ele pertence (`CHAR(7)`, `AAAA-MM`)

A competência é calculada **na escrita**, a partir da data, e persistida. Isso é o que faz
RN-LAN-001 (retroativo) funcionar sem recalcular o mês inteiro a cada consulta.

Datas em UTC no banco; conversão para o fuso da família na borda.

## Camadas e módulos

```
api/src/modulos/<modulo>/
  <modulo>.rotas.ts        HTTP: valida entrada, autoriza, delega. Sem regra.
  <modulo>.servico.ts      A regra de negócio. Sem HTTP, sem Prisma cru.
  <modulo>.repositorio.ts  Prisma. Sem regra.
  <modulo>.schema.ts       Zod: entrada e saída
  <modulo>.spec.ts         Testes de integração
```

Um módulo é uma pasta é um dono. No fan-out, **um worker por módulo** — a doutrina proíbe dois
workers no mesmo módulo, porque isso já produziu implementações divergentes e migrations
incompatíveis.

Módulo não importa de módulo irmão: a costura entre eles é explícita e tem dono.

## Nomenclatura

Português no domínio, sem exceção — é a mesma linguagem da tela e do glossário.

| Coisa | Padrão | Exemplo |
|---|---|---|
| Tabela | plural, snake_case | `orcamento_mes`, `lancamentos` |
| Coluna | snake_case | `valor_centavos`, `familia_id` |
| Entidade / tipo | PascalCase | `OrcamentoMes` |
| Arquivo | kebab-case | `orcamento-mes.servico.ts` |
| Endpoint | plural, kebab-case | `GET /competencias/2026-08/categorias` |
| Componente Vue | PascalCase | `CategoriaCard.vue` |
| Branch | `fatia/<n>-<slug>` | `fatia/3-lancamento` |

Nada de `TransactionService` ou `budget_limit`. É `LancamentoServico` e `teto_centavos`.

## Isolamento por família

**O `familiaId` vem do token. Sempre.** Nunca de parâmetro de rota, query string ou corpo.

Toda query passa por um escopo que injeta a família. Um endpoint que aceite `familiaId` do
cliente é um vazamento entre famílias — trate como bug de segurança, não como conveniência.

Todo teste de integração de leitura precisa ter um caso que prova que a família B **não** vê
o dado da família A.

## Contrato front ↔ back

O back publica OpenAPI. O front **importa o tipo gerado** de `packages/contrato` e nunca
redeclara o modelo.

```
api (zod → OpenAPI)  →  packages/contrato (gerado)  →  web (importa)
```

`packages/contrato` é **saída**, não fonte: não se edita à mão. Migration é gerada do
`schema.prisma`, nunca escrita à mão. Modela-se uma vez, gera-se o resto.

## Frontend (Nuxt)

- SSR ligado. O artefato de deploy é servidor Node (`.output/server/index.mjs`), não HTML estático.
- **Sessão em cookie `httpOnly`.** O render de servidor não enxerga `localStorage`.
- **Não usar `web/server/`.** A API é o `api/`. Criar rota de servidor no Nuxt cria um segundo
  backend em paralelo — exatamente o "caminho paralelo" que a doutrina proíbe.
- Estado de servidor via `useFetch`/`useAsyncData` tipados pelo contrato.
- Mobile-first. O desktop é o mesmo app com shell diferente — sidebar no lugar da tab bar,
  nunca um segundo conjunto de telas.

## Tempo real

WebSocket na porta da API, path `/realtime`, Socket.IO dos dois lados. Room por família,
**derivada do token no handshake** — o cliente nunca pede para assinar uma família (RN-RT-001).

O servidor emite **invalidação**, jamais estado derivado:

```jsonc
// evento: recurso.alterado   →   room familia:<familiaId>
{
  "recurso": "lancamentos",       // | orcamento | contas | faturas | metas | fechamento
  "competencia": "2026-08",       // null quando não é escopado por mês
  "origemClienteId": "<uuid>",
  "em": "2026-08-22T13:00:00Z"
}
```

Do lado do cliente:

- **Recebeu → refetch.** Nada de patch local, nada de recálculo. Um lançamento muda o disponível
  de todas as categorias por rateio do lastro; reproduzir isso no front seria reimplementar a
  regra de negócio (RN-RT-002).
- **Ignore o próprio eco.** Se `origemClienteId` é o seu, descarte — a resposta da mutação já
  trouxe o estado recomputado.
- **Reconectou → ressincronize.** Refaça a leitura da competência ativa, sempre (RN-RT-003).
- **Só no cliente.** SSR não abre socket; conecta após a hidratação.

**Toda fatia emite a invalidação do que altera.** É item de DoD, não detalhe de implementação —
uma tela que grava e não avisa deixa as outras pessoas da família com número velho.

## Testes

O gate exige **N > 0 testes de integração realmente executados**. Unitário com fake não conta
como prova de fiação — foi o que deixou controller sem dispatch passar verde na fábrica anterior.

Um teste de integração aqui: HTTP → serviço → **Postgres de verdade** → resposta.

Obrigatório por fatia:
1. O caminho feliz, ponta a ponta.
2. Cada RN que a fatia toca, uma por uma.
3. O isolamento entre famílias — **inclusive no socket**: a família B não recebe evento da A.
4. Os edge cases do domínio — virada de ciclo do cartão, retroativo, estouro, parcela final.
5. **Dois clientes.** A mudança feita num aparece no outro sem refresh.

O item 5 existe porque o gate de navegação não o cobre: ele prova que a tela abre. Um socket que
falha em reconectar deixa a página perfeita, o console limpo e o número velho — verde que não é
verde. Ver [ADR-007](decisoes/ADR-007-tempo-real-por-websocket.md).

Fingir o **envio de email** é legítimo (driver `log`). Fingir o **convite** não é: o teste tem
que provar que o convite foi persistido, que o token valida e que expira.

## Git

- Branch por fatia, PR para `main`.
- Commit descritivo por tarefa concluída, referenciando a issue: `#7`.
- Push por checkpoint. Trabalho que só existe local é trabalho que ainda não existe.
- O hook `pre-commit` bloqueia segredo vazado. Não contorne — conserte.
