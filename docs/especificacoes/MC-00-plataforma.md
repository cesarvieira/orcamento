# MC-00 — Matriz de Completude · Plataforma

> O que **falta** decidir/construir/validar para EF-00 alcançar padrão implantável. Não repete o
> que a EF já resolveu. Ver [EF-00](EF-00-plataforma.md) (o contrato) e
> [MANUAL-00](../manual/MANUAL-00-plataforma.md) (o que foi construído).

- **Conteúdo base:** Com conteúdo — a EF-00 fechou uma implementação completa e provada.
- **Confiança:** Alta (código + gate re-executado pelo condutor)
- **Critério de completude:** a régua deste produto é o MVP descrito em `.preator/CONTEXT.md` —
  não "padrão implantável internacional". Uma capacidade conta como `Concluído` quando o gate a
  prova de forma reproduzível; `Parcial` quando o código existe mas não há prova automatizada;
  `Pendente` quando nem o código existe.

## Matriz de completude

| Área | Capacidade esperada | Status | O que falta |
|---|---|---|---|
| Monorepo | `api`+`web`+`packages/contrato` de pé via compose | Concluído | — |
| Migrations | Aplicam do zero em banco limpo | Concluído | — |
| Contrato | Gerado do OpenAPI, front importa | Concluído | — |
| Tenant | `familiaId` só do token, 3 vias de vazamento fechadas | Concluído | — |
| Tempo real — isolamento | Família B não recebe evento de A | Concluído | — |
| Tempo real — reconexão | Cliente resincroniza a competência ativa ao reconectar | Parcial | Código existe (`useRealtime.ts`), sem teste automatizado que force desconexão/reconexão real (WebSocket via browser, não só o servidor) |
| Shell responsivo | Tab bar mobile / sidebar desktop, 7 rotas | Concluído | — |
| Seed | Família de teste + membro aceito | Concluído | — |
| Seed | 1–3 registros por módulo de domínio | Pendente | Tabelas de módulo não existem (EF-01..EF-08). Arnês `SEMEADORES_DE_MODULO` em `api/src/db/semear.ts` pronto para cada EF registrar o seu |
| Login | Tela abre, zero erro de console/rede | Concluído | — |
| Auth completa | Google OAuth + convite/aceite | Pendente | Escopo da EF-01, não da EF-00. `/entrar` hoje só faz email/senha |
| Ferramenta — deploy-fresh | `deploy-fresh.sh` prova banco-limpo→migrate→seed automatizado | Parcial | Roda `docker compose up -d --build &` em background; no Git Bash do Windows os containers ficam em `Created` e nunca sobem. Reproduzido 3×; em primeiro plano funciona. Não é bloqueante — `gate-motor.sh` não passa `--deploy` — mas é defeito da fábrica (`preator/`), fora do escopo de escrita desta tarefa |

## Lacunas

| Código | Lacuna | Impacto | Prioridade |
|---|---|---|---|
| EF00-MC-001 | Reconexão de socket sem teste automatizado (browser real) | Regressão em R4 não seria pega pelo gate | Média |
| EF00-MC-002 | Seed sem registros de módulo | Gate de navegação cobre telas vazias; próxima EF que popular seu módulo precisa lembrar de registrar o semeador | Média |
| EF00-MC-003 | `deploy-fresh.sh` trava no Git Bash/Windows (bug da fábrica, não do projeto) | Quem rodar `--deploy` nesta plataforma vê timeout, não FAIL claro | Baixa |

## Riscos de implantação

| Risco | Severidade | Mitigação |
|---|---|---|
| Próxima EF esquecer de registrar seu semeador em `SEMEADORES_DE_MODULO` | Baixa | O arquivo já está documentado; o próprio DoD de cada EF de módulo deveria listar isso |
| Middleware de tenant reintroduzir o bug do `req.query` preguiçoso ao ser refatorado | Média | `api/testes/tenant.teste.ts` trava contra a versão antiga — falha se alguém voltar a usar `delete` direto |

## Validações obrigatórias para implantação

| Validação | Resultado esperado | Status |
|---|---|---|
| Família B não recebe evento de A | Bloqueado no servidor | Provado (teste automatizado) |
| `familiaId` do request é ignorado em query, corpo e path | Descartado antes do handler | Provado (teste automatizado) |
| Socket derrubado e reconectado resincroniza | Competência ativa correta após reconexão | **Não provado** — validar manualmente ou escrever teste e2e antes de construir EFs que dependem de tempo real em tela |
| Migrations aplicam do zero, duas vezes seguidas | Sem drift, sem "já apliquei" falso-negativo | Provado (gate rodado 2× seguidas na tarefa + 1× do zero na história) |

## Pendências de decisão

_(nenhuma — as decisões desta história estavam todas fechadas na EF antes de codar; os itens acima
são lacunas técnicas, não decisões de negócio em aberto)_

## Próximo passo

EF-01 (Família e Acesso) é a próxima história natural: substitui `/entrar` pelo fluxo completo
(Google OAuth, convite por email via `MAIL_DRIVER`, aceite), e é a primeira a registrar um
semeador em `SEMEADORES_DE_MODULO`.

## Status final do ciclo

- [x] EF atualizada (DoD marcado, decisões incorporadas)
- [x] MC criada
- [x] MANUAL as-built criado
- [x] Memória do condutor (`.motor/condutor-14.md`) atualizada
- [x] Issues #14 e #24 carimbadas `provado`, com evidência comentada
- [x] PR aberto: [#25](https://github.com/cesarvieira/orcamento/pull/25)
