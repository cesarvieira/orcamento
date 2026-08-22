# ADR-005 — Acesso familiar, convite e provedor de email

- **Status:** aceita
- **Data:** 2026-08-22
- **Decisor:** Cesar Vieira
- **Regras que gera:** RN-FAM-001, RN-CVT-001..003

## Contexto

O mockup mostra "Ana e Bruno", um chip `A + B` no cabeçalho e o campo `quem` em cada lançamento —
o produto é claramente multiusuário. Faltava decidir o modelo de identidade e como uma segunda
pessoa entra na família.

## Decisão

**Cada membro tem login próprio; os dados são compartilhados por família.**

- Autenticação por **Google OAuth** ou **email + senha**.
- O primeiro usuário cria a família e **convida os demais por email**.
- O convite só pode ser aceito **pelo mesmo email** que o recebeu.
- Sessão em cookie `httpOnly` (exigência do SSR — ver ADR-001).

**O provedor de email é escolha de ambiente, não de código.** O `api/` fala com um adaptador; o
driver vem do `.env` (`MAIL_DRIVER=log | smtp | resend | ses`). Nenhum fornecedor é fixado aqui.

## Regras que isto impõe

**RN-FAM-001 — o `familiaId` deriva do token, nunca do request.** Um endpoint que aceite
`familiaId` do cliente é vazamento entre famílias.

**RN-CVT-001 — o email que aceita deve ser o email convidado.** Com Google, vale o email
*verificado* do provedor, não o que o usuário digitar.

**RN-CVT-002 — convite expira e é de uso único.** O prazo é parâmetro (`CONVITE_TTL_HORAS=72`),
não regra: muda por ambiente sem tocar em código.

**RN-CVT-003 — mesmo email via Google e via senha é a mesma pessoa.** Sem vinculação de
identidade, alguém convidado como `ana@x.com` cria uma conta de senha com o mesmo email e passa
a existir duas vezes — e o convite se burla.

## Consequências

- Email é **integração externa de primeira classe**: adaptador em `api/src/modulos/familia/`,
  config no `.env`, credencial no ambiente. Nunca no `preator-perfil.sh`.
- O driver `log` é o que torna o gate viável: sem ele, todo teste de integração de convite
  mandaria email de verdade.
- **Fingir o envio é legítimo; fingir o convite não é.** O teste precisa provar que o convite
  foi persistido, que o token valida, que expira e que RN-CVT-001 recusa email divergente. O que
  se dispensa é só o SMTP.
- O seed cria a família de teste com um membro já convidado e aceito — sem isso o gate de
  navegação não alcança a área logada, que neste produto é o app inteiro.
- Dado financeiro familiar é dado pessoal. A LGPD entra no escopo antes de qualquer exposição
  pública do produto; ainda não há decisão de retenção nem de exclusão de conta.
