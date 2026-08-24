# CONTEXT — a verdade deste produto

> Preencha este arquivo antes de qualquer tarefa. Ele é o que a IA lê para saber **onde está** e
> **o que não pode violar** neste projeto. O que é universal vem da fábrica; o que é deste produto
> mora aqui.
>
> Regra: aqui só entra o que **não se deriva do código**. Estrutura de pastas, nome de classe e
> versão de biblioteca a IA lê no repositório — não duplique.

---

## O produto

**Nome:**
**Cliente:**
**O que faz, em uma frase:**
**Quem usa:** (perfis, e o que cada um faz no sistema)

---

## A stack real

> Os *comandos* de build, teste e deploy vivem em `preator-perfil.sh`, não aqui. Esta seção é para
> o que um humano precisa saber e a máquina não infere.

| Camada | Tecnologia | Observação |
|---|---|---|
| Backend | | |
| Frontend | | |
| Banco | | |
| Fila / eventos | | |
| Infra | | |

**Integrações externas** (adaptador, config, credencial — cada uma é cidadã de primeira classe):

| Integração | O que faz | Onde está o adaptador |
|---|---|---|
| | | |

---

## O design deste produto

> **Se existe mockup, ele é FONTE — não ilustração.** Toda história com tela constrói contra ele.
> Improvisar a tela em vez de abrir o design é fork ao humano, igual a regra de negócio sem skill.
>
> Preencher isto não é burocracia: num projeto real o protótipo carregava a lógica de domínio
> inteira, e foi lendo-o que se descobriu que o produto era outro. Ver
> `preator/doutrina/LICOES.md`, §9.
>
> **Não tem design?** Escreva "não há" abaixo. Em branco parece esquecimento; "não há" é decisão.

**Onde está:** <URL ou caminho>

| Arquivo | O que é |
|---|---|
| | |

**Como se abre:** <ferramenta, e o que fazer se pedir permissão — ex.: "MCP de design da sua
plataforma; exige consentimento por sessão; erro de permissão vira pedido ao humano, nunca
improviso">

**O que no design NÃO se copia:** <atalhos de protótipo já corrigidos em decisão — cada um com
o ADR que o corrigiu>

---

## As regras invioláveis deste projeto

> O que quebra o produto se for violado. Seja específico e diga **por quê** — uma regra sem motivo
> é ignorada na primeira pressa.

1.
2.
3.

---

## Os domínios de negócio que este produto toca

> A **Regra #0** vale aqui: nada de fiscal, trabalhista, financeiro ou legal sai de memória.
> Liste os domínios e a skill correspondente da fábrica.

| Domínio | Skill agnóstica (fábrica) | Overlay específico (aqui) |
|---|---|---|
| ex.: fiscal | `preator/conhecimento/negocio/fiscal/` | `skills/negocio/` |

**Regra que este cliente faz diferente do padrão do setor:**
> Documente aqui, com o porquê. É o tipo de coisa que ninguém lembra em seis meses.

---

## O que já decidimos (e não vamos rediscutir)

| Decisão | Quando | Por quê | ADR |
|---|---|---|---|
| | | | `decisoes/` |

---

## O que está fora de escopo

> Tão importante quanto o escopo. Sem isto, todo refinamento vira negociação.

-

---

## Estado atual

**Onde estamos:**
**O que está em construção:**
**O que está quebrado e conhecido:**

> Se este bloco envelhecer, ele passa a mentir — e um CONTEXT que mente é pior que um vazio.
> Prefira apontar para o board do projeto a manter números aqui.
