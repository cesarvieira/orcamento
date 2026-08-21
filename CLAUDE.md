# CLAUDE.md — orcamento

Este projeto usa a **fábrica** em `preator/` como subrepo. Ela é **lida, nunca escrita**.

## Leia antes de qualquer tarefa
- **As regras:** `preator/doutrina/00-COMECE-POR-AQUI.md`
- **Como se executa:** `preator/doutrina/02-PROCESSO.md`
- **⛔ Regra #0:** regra de negócio, fiscal, trabalhista ou legal vem SEMPRE de
  `preator/conhecimento/negocio/<domínio>`, citada. Skill vazia → PARE e escale.

## Deste projeto
- **Stack e contrato com a fábrica:** `preator-perfil.sh`
- **Convenções, negócio específico e playbooks:** `.preator/`
- **O que é verdade deste produto:** `.preator/CONTEXT.md`

## Provar
```bash
bash preator/esteira/gates/prova-comportamento.sh .
```
Só o carimbo PROVA_DE_COMPORTAMENTO=PASS fecha uma fatia. Verde de build não fecha nada.
