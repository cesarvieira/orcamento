# AGENTS.md — orcamento

Formato [agents.md](https://agents.md/): um arquivo, qualquer ferramenta de IA.

## Leia antes de qualquer tarefa

**`preator/AGENTS.md`** — as quatro regras, o processo, o ciclo e a ⛔ Regra #0.

Ele é a fonte. Este arquivo não repete nenhum fato dele: fato duplicado é bug.
A fábrica em `preator/` é subrepo — **lida, nunca escrita**.

## Deste projeto

- **Stack e contrato com a fábrica:** `preator-perfil.sh`
- **Convenções, negócio específico e playbooks:** `.preator/`
- **O que é verdade deste produto:** `.preator/CONTEXT.md`

## Entregar uma história

`/entregar <n>` — ou, sem o comando salvo:

> Entregue a história #<n> seguindo `preator/esteira/motor/CONDUTOR.md`

## Revisar antes de mesclar

`/revisar <worktree|branch|#PR>` — o portão do merge, em sessão separada.

> Revise <alvo> seguindo `preator/esteira/motor/REVISOR.md`
