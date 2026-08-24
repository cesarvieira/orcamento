# AGENTS.md — orcamento

Formato [agents.md](https://agents.md/): um arquivo, qualquer ferramenta de IA.

Este projeto usa a **fábrica** em `preator/` como subrepo. Ela é **lida, nunca escrita**.

## Leia antes de qualquer tarefa
- **As regras:** `preator/doutrina/00-COMECE-POR-AQUI.md`
- **Como se executa:** `preator/doutrina/02-PROCESSO.md`
- **O ciclo de IA:** `preator/doutrina/05-CICLO-DE-IA.md`
- **O contexto do agente-folha:** `preator/esteira/motor/AGENTS.md`
- **⛔ Regra #0:** regra de negócio, fiscal, trabalhista ou legal vem SEMPRE de
  `preator/conhecimento/negocio/<domínio>`, citada. Skill vazia → PARE e escale.

## Deste projeto
- **Stack e contrato com a fábrica:** `preator-perfil.sh`
- **Convenções, negócio específico e playbooks:** `.preator/`
- **O que é verdade deste produto:** `.preator/CONTEXT.md`

## Git — obrigatório
- **NUNCA trabalhe em `main`.** Branch dedicada a partir de `main`, `<tipo>/<slug>` em
  kebab-case ASCII. Ao finalizar: push, PR com base `main`, e **devolva a URL**.
- Commits em Conventional Commits, português (BR), curtos.
- Regras inteiras: `preator/esteira/motor/protocolo/protocolo-git.md`

## Provar
```bash
bash preator/esteira/gates/prova-comportamento.sh .
```
Só o carimbo PROVA_DE_COMPORTAMENTO=PASS fecha uma história. Verde de build não fecha nada.

> Se a sua ferramenta de IA ainda procura um arquivo de nome próprio, crie-o com UMA linha
> apontando para este. Ponteiro, nunca cópia: cópia envelhece e passa a mentir.
