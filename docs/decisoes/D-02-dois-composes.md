# D-02 — Dois composes, e o de produção é o alvo dos gates

- **Status:** aceita
- **Data:** 2026-08-22

## Contexto

A doutrina exige que a tela abra **no artefato de deploy, não no dev-build**. Ao mesmo tempo,
subir a stack inteira em container a cada alteração destrói o ciclo de desenvolvimento.

Se os gates rodassem contra `pnpm run dev`, eles provariam um artefato que ninguém publica: o selo
pareceria verde e não significaria nada.

## Decisão

| Arquivo                  | Sobe                       | Para quê                                             |
| ------------------------ | -------------------------- | ---------------------------------------------------- |
| `docker-compose.dev.yml` | só PostgreSQL              | loop de desenvolvimento; `api` e `web` rodam nativos |
| `docker-compose.yml`     | PostgreSQL + `api` + `web` | **o artefato de deploy**, nas imagens de produção    |

`COMPOSE` no `preator-perfil.sh` aponta para o segundo. O primeiro nunca é alvo de gate.

## Alternativas consideradas

**Um compose só, completo.** Descartado: rebuild de imagem a cada alteração torna o
desenvolvimento inviável.

**Um compose só, com o banco, provando o dev-build.** Descartado por conflito direto com o
Portão B — é exatamente o "verde stale" que a estrutura de portões existe para impedir.

**Postgres gerenciado na nuvem, sem compose.** Descartado: o selo _"migrations aplicam do zero em
banco limpo"_ fica frágil quando o banco é acumulado e compartilhado.

## Consequências

- O `web` de produção é um servidor Node (SSR — ver [D-01](D-01-stack.md)), não um nginx servindo
  estáticos.
- O gate `deploy-fresh` sobe do zero: banco limpo, todas as migrations, sistema de pé. É onde o
  drift de schema é pego.
- Quem desenvolve nunca precisa esperar build de imagem; quem prova nunca aceita menos que a
  imagem real.
