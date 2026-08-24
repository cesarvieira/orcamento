# D-07 — Configuração por ambiente; credencial nunca no perfil

- **Status:** aceita
- **Data:** 2026-08-22

## Contexto

O produto precisa entregar convites por email. Escolher um fornecedor agora prenderia o código a
ele e colocaria uma decisão comercial no caminho crítico da primeira história.

Há também o risco recorrente de credencial vazar para arquivo versionado — e segredo commitado
continua no histórico depois de removido do arquivo.

## Decisão

**O código fala com um adaptador; o ambiente escolhe o fornecedor.**

```bash
# .env.example — versionado, sem um único valor real
MAIL_DRIVER=log              # log | smtp | resend | ses
MAIL_FROM=
MAIL_API_KEY=                # preenchido só no .env local
SMTP_HOST=  SMTP_PORT=  SMTP_USER=  SMTP_PASS=
CONVITE_TTL_HORAS=72         # parâmetro, não regra
```

`.env` e `.env.*` são ignorados pelo Git; `.env.example` é versionado com os **nomes** das chaves
e nenhum valor.

**Credencial nunca entra no `preator-perfil.sh`.** O perfil é o contrato com a fábrica —
comandos, caminhos e portas. O hook de pre-commit roda o scanner de segredos e bloqueia.

## O driver `log` não é detalhe

Sem ele, todo teste de integração de convite mandaria email de verdade. Com ele o teste roda
offline — e vale a distinção: **fingir o envio é legítimo, fingir o convite não é.** O teste tem
de provar que o convite foi persistido, que o token valida, que expira e que email divergente é
recusado. O que se dispensa é só o SMTP.

## Alternativas consideradas

**Fixar um fornecedor agora (Resend/SES/SendGrid).** Descartado: prende o código a uma escolha
comercial que não precisa ser feita ainda, e não melhora nada hoje.

**SMTP direto, sem adaptador.** Descartado: não dá caminho de teste offline, e amarra o produto a
um protocolo quando o mercado usa API.

## Consequências

- Email é **integração de primeira classe**: adaptador em `api/src/modulos/familia/`, config no
  `.env`, credencial no ambiente.
- Trocar de fornecedor é mudar variável, não código.
- `CONVITE_TTL_HORAS` mora aqui porque é **parâmetro**, não regra: muda por ambiente sem tocar na
  especificação.
