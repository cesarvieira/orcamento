---
name: negocio-acesso-familiar
tipo: negocio # tipo 3 — conhecimento de NEGÓCIO/domínio
projeto: orcamento
dominio: acesso familiar — identidade, sessão e convite
aplica-se-a: [orcamento]
status: ativa
revisao: por-mudanca-de-regra
---

# Negócio — acesso familiar

> **Skill de Negócio (tipo 3).** O conhecimento do NEGÓCIO que suporta a **especificação**. É o
> que faz o agente de Requirements/PO escrever specs corretas e o Dev não violar regra de domínio.
> Não é sobre código — é sobre _o que o cliente faz e as regras que o regem_.

## O que é o negócio (em 3 linhas)

O Orçamento Familiar é usado por uma família inteira, não por um indivíduo: cada pessoa tem login
próprio, mas os dados financeiros são compartilhados por todos os membros da mesma família. A
segunda pessoa em diante entra por **convite validado por email** — nunca por autocadastro livre —
para que a família continue sendo o único limite de quem vê o quê.

## Atores / personas

| Ator      | Quem é                                                           | O que faz no sistema                                      | Restrições                                                        |
| --------- | ---------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------- |
| Membro    | pessoa com login numa família (criador ou convidado que aceitou) | entra, convida novos membros, lança e vê dados da família | só enxerga dado da própria família — REST e socket                |
| Convidado | email convidado, ainda sem conta ativa                           | recebe o convite, aceita usando o mesmo email             | só aceita com o email exato convidado (ou o verificado do Google) |

## Glossário do domínio (a linguagem ubíqua)

> Todo nome de código, tela e evento deve usar estes termos — não sinônimos técnicos.

| Termo      | Definição precisa                                                                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Família    | tenant; raiz de todo isolamento de dados do produto                                                                                                                                              |
| Membro     | pessoa com login em uma família; autor imutável de cada lançamento que criar                                                                                                                     |
| Identidade | credencial de um membro — `provedor` (`google` \| `senha`) + `emailVerificado`; separada de `Membro` porque o mesmo email pode chegar por dois provedores e precisa resolver para a mesma pessoa |
| Convite    | convite pendente de uma família para um email — token, expiração, uso único                                                                                                                      |

## Regras de negócio (as invioláveis)

> Numeradas para rastrear na spec e no teste. Cada regra vira critério de aceite e edge case.

| #     | Regra                                                                                                                                                                                                                  | Origem (lei/norma/decisão)                             |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| RN-01 | O `familiaId` deriva **sempre** do token, nunca do request (vale também no WebSocket: a room é resolvida no handshake)                                                                                                 | [D-05](../../../docs/decisoes/D-05-acesso-familiar.md) |
| RN-02 | O email que aceita o convite é idêntico ao convidado; com Google vale o email **verificado** pelo provedor, não o digitado                                                                                             | D-05                                                   |
| RN-03 | Convite **expira** (TTL em `CONVITE_TTL_HORAS`) e é de **uso único**                                                                                                                                                   | D-05                                                   |
| RN-04 | Mesmo email via Google e via senha resolve para a **mesma pessoa** — sem isso, quem foi convidado como `ana@x.com` cria conta de senha com o mesmo email, existe duas vezes, e o convite se burla sem nunca ser aceito | D-05                                                   |
| RN-05 | Todo membro da família tem o mesmo poder sobre os dados — não há hierarquia de papéis                                                                                                                                  | mockup + D-05                                          |

## Regulação / compliance (o que a lei/norma exige)

- **LGPD** — dado financeiro familiar é dado pessoal. Entra no escopo antes de qualquer exposição
  pública. **Ainda não há decisão** sobre retenção, exportação e exclusão de conta — registrado
  como consequência aberta em D-05; não inventar prazo ou fluxo de exclusão sem essa decisão.
- **Sessão em cookie `httpOnly`** — exigência do SSR (D-01), não opcional para este módulo.

## Processos / fluxos principais

1. **Entrar** — Google OAuth ou email+senha → cookie `httpOnly` → tela do mês.
2. **Convidar** — de dentro de _Mais_, o membro informa um email → convite é enviado e persistido
   como pendente, listado na família.
3. **Aceitar** — `/convite/:token` → valida o email (RN-02) → cria ou resolve o `Membro` (RN-04) →
   entra logado.

## Casos de uso principais

| UC    | Ator      | Objetivo                                         | Regras envolvidas   |
| ----- | --------- | ------------------------------------------------ | ------------------- |
| UC-01 | Membro    | Autenticar e acessar os dados da própria família | RN-01, RN-05        |
| UC-02 | Membro    | Convidar uma nova pessoa para a família          | RN-03               |
| UC-03 | Convidado | Aceitar o convite e virar membro da família      | RN-02, RN-03, RN-04 |

## Edge cases e exceções do domínio

- Convite expirado: recusa com erro claro; tentativa registrada (driver `log` em ambiente de teste).
- Email do convite diferente do email que tenta aceitar: recusa (RN-02).
- Token já usado (aceito antes): recusa — uso único (RN-03).
- Mesmo email chega por Google depois de já existir conta por senha, ou vice-versa: resolve para o
  mesmo `Membro`, nunca duplica a pessoa (RN-04).
- Família B tentando enxergar ou receber evento de dado da família A, via REST **ou** via socket:
  isolamento tem que segurar nos dois canais (RN-01).

## Fontes do conhecimento

- [docs/decisoes/D-05-acesso-familiar.md](../../../docs/decisoes/D-05-acesso-familiar.md) — ADR
  aceita em 2026-08-22, decisão do humano. Fonte primária de todas as RN acima.
- [docs/especificacoes/EF-01-familia-e-acesso.md](../../../docs/especificacoes/EF-01-familia-e-acesso.md)
  — EF fechada (Portão A) que consome estas regras.
