# EQUIPE — {NOME DO PROJETO}

> O **elenco** deste projeto: quais preator/equipe/esteira/especialistas atuam e **quais skills cada um carrega**.
> É o que transforma a fábrica genérica na célula deste projeto. Cada linha = um worker pronto.
> O **diretor humano** de cada célula confere e libera.

## Célula técnica

| Papel | Agente base | Skills que carrega | Diretor (humano) |
|---|---|---|---|
| Arquiteto | Architect | Conhecimento: arquitetura/* + dados/* · skills/formato-{projeto} | {nome} |
| Dev Backend | Dev | Conhecimento: linguagens/{stack} + backend-web/* + qualidade/* · formato-{projeto} | {nome} |
| Dev Frontend | Dev | Conhecimento: frontend/* + linguagens/javascript-typescript · formato-{projeto} | {nome} |
| QA | QA | Conhecimento: qualidade/tdd + test-plan · edge cases dos domínios | {nome} |
| Code Review | Code Review | Conhecimento: qualidade/code-review + refatoracao + codigo-limpo | {nome} |
| Ops | Ops | Conhecimento: devops-infra/* | {nome} |
| Security | Security | Conhecimento: seguranca/* + regulação do projeto | {nome} |

## Célula de produto/negócio

| Papel | Agente base | Skills que carrega | Diretor (humano) |
|---|---|---|---|
| PO/Requirements | Requirements | Conhecimento: produto-negocio/gestao-produto + user-stories | {nome} |
| Especialista {domínio 1} | Especialista de Negócio | preator/conhecimento/negocio/{dominio} + skills/negocio-{cliente} | {nome} |
| Especialista {domínio 2} | Especialista de Negócio | preator/conhecimento/negocio/{dominio} | {nome} |
| UX | UX | Conhecimento: frontend/ux-design + acessibilidade do projeto | {nome} |

## Como funciona (o multiplicador)

Cada **diretor humano** comanda uma ou mais células. Ele especifica a tarefa, o agente executa
(carregando as skills acima), o agente **auto-valida** pelo checklist da skill, o Code Review
pré-aprova, e o diretor **só confere e libera**. É assim que 1 vira vários.

> Para instanciar um worker na sua plataforma de IA: perfil = o agente base + as skills desta linha.
> Setup e uso: `preator/adocao/USO-DIARIO.md`. Quem faz o quê: `preator/doutrina/04-ORGANOGRAMA.md`.
