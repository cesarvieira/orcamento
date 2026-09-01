# Decisões

Registro do **porquê**. Cada arquivo captura uma decisão, as alternativas descartadas e as
consequências que ela impôs.

> A alternativa descartada **com o motivo** vale tanto quanto a escolhida — é o que impede a
> discussão de voltar em seis meses. Um registro sem a seção de alternativas é um comunicado, não
> uma decisão.

---

## Infraestrutura

| #                                    | Assunto                                                           | Status   |
| ------------------------------------ | ----------------------------------------------------------------- | -------- |
| [D-01](D-01-stack.md)                | TypeScript full-stack: API + Drizzle + PostgreSQL, front Nuxt SSR | aceita   |
| [D-02](D-02-dois-composes.md)        | Dois composes — o de produção é o alvo dos gates                  | aceita   |
| [D-03](D-03-contrato-gerado.md)      | OpenAPI gerado; o front importa o contrato, não redeclara         | aceita   |
| [D-04](D-04-tempo-real.md)           | WebSocket que empurra invalidação, não estado                     | aceita   |
| [D-05](D-05-acesso-familiar.md)      | Família com vários logins; convite validado por identidade        | aceita   |
| [D-06](D-06-dinheiro-em-centavos.md) | Dinheiro é inteiro em centavos em toda a pilha                    | aceita   |
| [D-07](D-07-ambiente-e-segredos.md)  | Provedor de email por `.env`; credencial nunca no perfil          | aceita   |
| [D-08](D-08-observabilidade.md)      | Observabilidade por Sentry self-hosted, dirigida por DSN          | aceita   |
| [D-09](D-09-deploy-em-producao.md)   | Deploy: uma imagem no GHCR, dois subdomínios, release do build    | proposta |

## Produto

Decisão de produto mora na EF do módulo que ela governa, não aqui. A mais importante — **o
lastro** — está em [EF-06](../especificacoes/EF-06-lastro.md), com o registro de que foi escalada
ao humano por não existir em skill nenhuma da fábrica.

---

## Escrevendo uma decisão nova

Arquivo `D-NN-titulo-em-kebab-case.md`. Numeração sequencial, **nunca reaproveitada** — decisão
substituída continua no diretório com status atualizado, porque o histórico é o produto.

```markdown
# D-NN — Título

- **Status:** proposta | aceita | substituída por D-XX | descartada
- **Data:** AAAA-MM-DD

## Contexto

O que forçou a decisão. Restrições reais, não justificativa retroativa.

## Decisão

O que foi decidido, no presente do indicativo.

## Alternativas consideradas

Cada uma com **o motivo do descarte**. Seção obrigatória.

## Consequências

O que passa a ser verdade — inclusive o que ficou pior ou mais caro.
```
