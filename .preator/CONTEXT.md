# CONTEXT — a verdade deste produto

> O que a IA lê para saber **onde está** e **o que não pode violar**. Aqui só entra o que **não
> se deriva** do código. Estrutura de pastas e versão de biblioteca a IA lê no repositório.
>
> Decisões e especificações completas em [`docs/`](../docs/). Este arquivo aponta; não repete.

---

## O produto

**Nome:** Orçamento Familiar
**Cliente:** produto próprio
**O que faz, em uma frase:** orçamento familiar **por envelope com lastro** — a família planeja o
mês em categorias com teto, e o app se recusa a liberar plano que não tem dinheiro por trás.
**Quem usa:** membros de uma família, todos com o mesmo poder sobre os dados compartilhados.
Cada lançamento registra quem o criou.

> **A pergunta que o produto responde não é _"quanto gastei?"_, é _"quanto posso gastar de
> verdade?"_.** Quem não entendeu o **lastro** não entendeu o produto — está em
> [EF-06](../docs/especificacoes/EF-06-lastro.md).

---

## A stack real

> Os _comandos_ vivem em `preator-perfil.sh`. Decisões e o porquê em
> [`docs/decisoes/`](../docs/decisoes/).

| Camada     | Tecnologia                          | Observação                                           |
| ---------- | ----------------------------------- | ---------------------------------------------------- |
| Backend    | TypeScript · API REST · Drizzle ORM | porta `3000`                                         |
| Frontend   | TypeScript · Nuxt sobre Vite        | porta `3001` · **SSR** — sessão em cookie `httpOnly` |
| Banco      | PostgreSQL                          | migrations geradas de `db/schema.ts`, nunca à mão    |
| Tempo real | WebSocket · Socket.IO               | mesma porta da API, path `/realtime`                 |
| Infra      | Docker Compose                      | **dois** composes; o de produção é o alvo dos gates  |
| Auth       | Google OAuth + email/senha          | convite por email validado por identidade            |

**Integrações externas:**

| Integração           | O que faz                                 | Onde está o adaptador                                                                                                                                        |
| -------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Email                | entrega o convite de família              | `api/src/modulos/familia/` · driver do `.env` · credencial no ambiente                                                                                       |
| Sentry (self-hosted) | recebe erro da API, do SSR e do navegador | `api/src/instrumentacao.ts` · `web/sentry.*.config.ts` · DSN no ambiente ([D-08](../docs/decisoes/D-08-observabilidade.md), [playbook](playbooks/sentry.md)) |

---

## O design é fonte, não ilustração

As telas **não se improvisam**. O mockup foi feito no Claude Design e carrega a lógica de domínio
inteira em JavaScript — é protótipo funcional, não wireframe.

> https://claude.ai/design/p/b7d13c37-0d57-4a92-9df6-c50357cb587d

| Arquivo                              | O que é                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------- |
| `Orcamento Familiar.dc.html`         | mobile — sete telas, tab bar, folhas e modais                           |
| `Orcamento Familiar Desktop.dc.html` | as **mesmas** sete telas: sidebar no lugar da tab bar                   |
| `support.js`                         | runtime gerado do dc-runtime — zero conteúdo de produto, **não portar** |

**Como abrir:** tools `mcp__claude-design__*`. Exigem consentimento **por sessão** — erro de
permissão vira pedido ao humano (`/design consent`), **nunca improviso**.

⚠️ O protótipo tem armadilhas já corrigidas nas EFs — ver a seção _"o que não se copia"_ de cada
uma. Quem segue o mockup cegamente as reintroduz.

---

## As regras invioláveis deste projeto

1. **O `familiaId` deriva do token, nunca do request** — e isso vale também no **WebSocket**: a
   room é resolvida no handshake. Endpoint ou socket que aceite `familiaId` do cliente vaza dado
   financeiro entre famílias. É bug de segurança, não conveniência.
2. **Dinheiro é inteiro em centavos, em toda a pilha.** O rateio pró-rata do lastro e o
   parcelamento dividem valores; com float, a soma das partes deixa de fechar com o todo.
3. **Transferência não é despesa.** Pagar fatura e guardar em meta são movimento entre contas.
   Contá-los como gasto corrompe teto, gasto e lastro de uma vez.
4. **O front importa o contrato gerado; não redeclara o modelo do back.** Vale também para o
   tempo real: o socket manda **invalidação**, e o cliente refaz a leitura — reproduzir o cálculo
   do lastro no front criaria duas fontes da verdade para a regra que define o produto.
5. **Não criar rota de servidor no Nuxt (`web/server/`).** A API é o `api/`. Um segundo backend
   em paralelo é o caminho paralelo que a doutrina proíbe.

---

## Os domínios de negócio que este produto toca

> **Regra #0:** nada de financeiro sai de memória.

| Domínio                       | Skill agnóstica (fábrica)                                         | Overlay específico (aqui)       |
| ----------------------------- | ----------------------------------------------------------------- | ------------------------------- |
| Orçado × realizado, variação  | `preator/conhecimento/negocio/financeiro/controladoria-orcamento` | `skills/negocio/`               |
| Parcelamento                  | `preator/conhecimento/negocio/financeiro/credito`                 | `skills/negocio/`               |
| Finanças pessoais, **lastro** | **não existe na fábrica**                                         | `skills/negocio/` ← única fonte |

O **lastro** não é conhecimento de domínio: é regra de produto, criada no mockup e decidida com o
humano. ⛔ **Se encontrar outra regra financeira sem skill que a cubra: pare e escale.**

---

## As especificações

Uma EF por módulo, no formato canônico (dados → regras → telas):
[`docs/especificacoes/`](../docs/especificacoes/). Cada EF tem uma história correspondente no
GitHub Issues — a fila é lá, não em disco.

---

## O que está fora de escopo

- **Foto do recibo / OCR** e **importar extrato** — botões no mockup que respondem com aviso.
- **Open Finance / integração bancária** — fora do horizonte do MVP.
- **Multi-moeda** — o produto é BRL.
- **App nativo** — o front responsivo cobre mobile e desktop.

---

## Estado atual

**Nenhuma linha de produto escrita.** Existem: as decisões, as EFs e a fila em Issues.

`preator-perfil.sh` está comentado de propósito — o gate reporta `PARCIAL` com SKIPs bloqueantes,
e isso é o veredito honesto enquanto não há stack. Ele é preenchido pela EF-00 (Plataforma),
quando `api/` e `web/` existirem.
