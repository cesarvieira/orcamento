# ADR-006 — Fatias no GitHub Issues

- **Status:** aceita
- **Data:** 2026-08-22
- **Decisor:** Cesar Vieira

## Contexto

A doutrina da fábrica define que uma fatia vive como arquivo em
`preator/esteira/motor/config/.sdd/backlog/open/`, e o `bernstein.yaml` deste projeto instrui o
motor a *"implementar as FATIAS em `.sdd/backlog/open/` por prioridade"*.

Um backlog em arquivos versionados é rastreável, mas é ruim para o que um humano precisa fazer
com um backlog: olhar de fora do editor, comentar, reordenar, marcar bloqueio, ver o que está
em andamento.

## Decisão

**As fatias deste projeto vivem no GitHub Issues** (`cesarvieira/orcamento`), não em
`.sdd/backlog/open/`.

Convenção:

| Elemento | Uso |
|---|---|
| Label `fatia` | Marca a issue como unidade de trabalho da esteira |
| Label `p0` `p1` `p2` | Prioridade |
| Título | `F<n> · <o usuário faz X na tela Y>` |
| Corpo | Escopo, RN envolvidas, DoD da fatia, ponteiro para os docs |
| Fechamento | Só com `PROVA_DE_COMPORTAMENTO=PASS` referenciado |

```bash
gh issue list --label fatia
```

O ticket continua **fino**: título, escopo, ponteiro para a regra e para a especificação. O
conteúdo profundo mora em [DOMINIO.md](../DOMINIO.md), [REGRAS-DE-NEGOCIO.md](../REGRAS-DE-NEGOCIO.md)
e nos ADRs — nunca no corpo da issue. Isso preserva a regra da doutrina de que o ticket aponta,
não duplica.

## Consequências

- Comentário, bloqueio e reordenação passam a ser operação de um clique, e o histórico de decisão
  fica junto do trabalho.
- Issue fechada é registro permanente com link para o commit e o PR.

### Divergência conhecida com o motor

O `bernstein.yaml` **continua apontando para `.sdd/backlog/open/`**. Ele é gerado por
`preator/esteira/motor/config/ativar.sh` e traz o aviso *"GERADO — regenere em vez de editar"*,
então não foi editado à mão.

**Enquanto essa divergência existir, o motor autônomo não encontrará fatia nenhuma** — o backlog
em disco está vazio. Duas saídas, nesta ordem de preferência:

1. Regenerar o `bernstein.yaml` via `ativar.sh` com o goal apontando para as issues.
2. Operar as fatias manualmente a partir das issues, sem o loop autônomo.

Até isso ser resolvido, vale a opção 2. Registrado aqui para que ninguém interprete o backlog
vazio como "não há trabalho".
