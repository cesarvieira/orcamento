# Especificações Funcionais

Uma EF por **módulo**, no formato canônico da fábrica: **§1 Dados → §2 Regras → §3 Telas**, nessa
ordem. Modela-se aqui uma vez; migration, contrato, tipos e telas são **gerados** disto.

Cada EF tem uma **história correspondente no GitHub Issues** — a fila é lá, não em disco.

```bash
gh issue list --label historia
```

---

## As EFs

| EF | Módulo | Pasta disjunta | Depende de |
|---|---|---|---|
| [EF-00](EF-00-plataforma.md) | **Plataforma** — monorepo, banco, contrato, socket, shell, seed | raiz · `packages/contrato` | — |
| [EF-01](EF-01-familia-e-acesso.md) | Família e acesso — login, convite, isolamento | `api/src/modulos/familia` | EF-00 |
| [EF-02](EF-02-contas.md) | Contas — débito, cartão, reserva | `api/src/modulos/contas` | EF-01 |
| [EF-03](EF-03-orcamento.md) | Orçamento — categorias, tetos por competência, remanejo | `api/src/modulos/orcamento` | EF-01 |
| [EF-04](EF-04-lancamentos.md) | Lançamentos — despesa, receita, transferência, parcelas | `api/src/modulos/lancamentos` | EF-02, EF-03 |
| [EF-05](EF-05-faturas.md) | Faturas — ciclo real, pagamento | `api/src/modulos/faturas` | EF-04 |
| [EF-06](EF-06-lastro.md) | **Lastro** — o cálculo que define o produto | `api/src/modulos/lastro` | EF-04, EF-05 |
| [EF-07](EF-07-metas.md) | Metas e reservas | `api/src/modulos/metas` | EF-04 |
| [EF-08](EF-08-fechamento.md) | Fechamento do mês | `api/src/modulos/fechamento` | EF-06 |

**A ordem de execução é a da tabela.** EF-00 é gargalo serial: um agente só, e ninguém edita
depois. Da EF-02 em diante há espaço para paralelismo, respeitando as dependências.

---

## Como ler uma EF

- **§0 Escopo & fronteira** — o que é deste módulo e o que é de outro. Define a pasta disjunta.
- **§1 Dados** — entidades, relacionamentos, decisões de modelagem.
- **§2 Regras** — cada regra numerada, com onde é imposta. O back impõe; o front nunca recodifica.
- **§3 Telas** — a superfície, referenciada ao mockup.
- **§4 O que não se copia do protótipo** — armadilhas já mapeadas.
- **§5 Definition of Done** — o que o Portão B exige deste módulo.

Regra com valor legal vem de `preator/conhecimento/negocio/`, citada — nunca inventada. Onde a
fábrica não cobre, a EF diz explicitamente que a regra foi **escalada e decidida com o humano**.
