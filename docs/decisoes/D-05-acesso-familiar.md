# D-05 — Família com vários logins, convite validado por identidade

- **Status:** aceita
- **Data:** 2026-08-22

## Contexto

O mockup mostra "Ana e Bruno", um chip `A + B` no cabeçalho e o campo *quem* em cada lançamento —
o produto é claramente multiusuário. Faltava decidir o modelo de identidade e como uma segunda
pessoa entra na família.

## Decisão

**Cada membro tem login próprio; os dados são compartilhados por família.**

- Autenticação por **Google OAuth** ou **email + senha**.
- O primeiro usuário cria a família e **convida os demais por email**.
- O convite só pode ser aceito **pelo mesmo email** que o recebeu.
- Sessão em cookie `httpOnly` — exigência do SSR ([D-01](D-01-stack.md)).

**O provedor de email é escolha de ambiente, não de código** — ver
[D-07](D-07-ambiente-e-segredos.md).

## As regras que isto impõe

- **O `familiaId` deriva do token, nunca do request.** Um endpoint que o aceite do cliente vaza
  dado financeiro entre famílias.
- **O email que aceita o convite deve ser o convidado.** Com Google, vale o email *verificado* do
  provedor, não o que o usuário digitar.
- **Convite expira e é de uso único.** O prazo é parâmetro de ambiente, não regra.
- **Mesmo email via Google e via senha é a mesma pessoa.** Sem vinculação de identidade, quem foi
  convidado como `ana@x.com` cria uma conta de senha com o mesmo email e existe duas vezes — e o
  convite se burla.

## Alternativas consideradas

**Login único do casal.** Muito mais simples, sem isolamento por tenant. Descartado: perde *quem
lançou o quê*, que o mockup exibe e que a auditoria familiar precisa.

**Local-first sem login.** Elimina metade dos gates e a superfície LGPD, mas inviabiliza duas
pessoas em dispositivos diferentes — que é o caso de uso central.

## Consequências

- Todo teste de leitura precisa de um caso provando que a família B **não** vê o dado da A.
- Vale no socket também: a família B não recebe evento da A.
- O seed cria a família de teste com um membro já convidado e aceito — sem isso o gate de
  navegação não alcança a área logada, que neste produto é o app inteiro.
- Dado financeiro familiar é dado pessoal. A LGPD entra no escopo antes de qualquer exposição
  pública; **ainda não há decisão** sobre retenção, exportação e exclusão de conta.
