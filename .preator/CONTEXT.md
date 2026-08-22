# CONTEXT — a verdade deste produto

> O que a IA lê para saber **onde está** e **o que não pode violar**. Aqui só entra o que **não
> se deriva** do código. Estrutura de pastas, nome de classe e versão de biblioteca a IA lê no
> repositório — não se duplica aqui.
>
> **Documentação completa em [`docs/`](../docs/).** Este arquivo aponta; ele não repete.

---

## O produto

**Nome:** Orçamento Familiar
**Cliente:** produto próprio
**O que faz, em uma frase:** orçamento familiar **por envelope com lastro** — a família planeja o
mês em categorias com teto, e o app se recusa a liberar plano que não tem dinheiro por trás.
**Quem usa:** membros de uma família, todos com o mesmo poder sobre os dados compartilhados.
Cada lançamento registra quem o criou.

> **A pergunta que o produto responde não é *"quanto gastei?"*, é *"quanto posso gastar de
> verdade?"*.** Quem não entendeu o lastro não entendeu o produto:
> [docs/DOMINIO.md](../docs/DOMINIO.md#o-lastro).

---

## A stack real

> Os *comandos* vivem em `preator-perfil.sh`. Portas, composes e `.env` em
> [docs/AMBIENTE.md](../docs/AMBIENTE.md).

| Camada | Tecnologia | Observação |
|---|---|---|
| Backend | TypeScript · API REST · Drizzle ORM | porta `3000` |
| Frontend | TypeScript · Nuxt sobre Vite | porta `3001` · **SSR** — sessão em cookie `httpOnly` |
| Banco | PostgreSQL | migrations geradas de `db/schema.ts` por drizzle-kit, nunca à mão |
| Tempo real | WebSocket · Socket.IO | mesma porta da API, path `/realtime` · room por família |
| Infra | Docker Compose | **dois** composes; o de produção é o alvo dos gates |
| Auth | Google OAuth + email/senha | convite por email validado por identidade |

**Integrações externas:**

| Integração | O que faz | Onde está o adaptador |
|---|---|---|
| Email | entrega o convite de família | `api/src/modulos/familia/` · driver do `.env` · credencial no ambiente |

---

## O design é fonte, não ilustração

As telas **não se improvisam**. O mockup foi feito no Claude Design e carrega a lógica de domínio
inteira em JavaScript — é protótipo funcional, não wireframe. Toda fatia com tela constrói contra
ele.

> https://claude.ai/design/p/b7d13c37-0d57-4a92-9df6-c50357cb587d

| Arquivo | O que é |
|---|---|
| `Orcamento Familiar.dc.html` | mobile — sete telas, tab bar, folhas e modais |
| `Orcamento Familiar Desktop.dc.html` | as **mesmas** sete telas: sidebar no lugar da tab bar |
| `support.js` | runtime gerado do dc-runtime — zero conteúdo de produto, **não portar** |

**Como abrir:** pelos tools `mcp__claude-design__*`. Eles exigem consentimento **por sessão** — se
derem erro de permissão, peça ao humano rodar `/design consent`. Não dá para aprovar
automaticamente, e **improvisar a tela em vez de escalar é violação de processo**.

⚠️ O protótipo tem seis armadilhas já corrigidas nos ADRs. Quem "segue o mockup" sem ler
[docs/APRENDIZADOS.md](../docs/APRENDIZADOS.md) reintroduz todas.

---

## As regras invioláveis deste projeto

1. **O `familiaId` deriva do token, nunca do request** — e isso vale também no **WebSocket**: a
   room é resolvida no handshake, e o servidor jamais aceita o cliente pedir para assinar uma
   família. Endpoint ou socket que aceite `familiaId` do cliente vaza dado financeiro entre
   famílias. É bug de segurança, não conveniência.
2. **Dinheiro é inteiro em centavos, em toda a pilha.** O rateio pró-rata do lastro e o
   parcelamento dividem valores; com float, a soma das partes deixa de fechar com o todo.
3. **Transferência não é despesa.** Pagar fatura e guardar em meta são movimento entre contas.
   Contá-los como gasto corrompe teto, gasto e lastro de uma vez — e destrói a confiança da
   família no app.
4. **O front importa o contrato gerado; não redeclara o modelo do back.** É o que o gate
   `contrato` cobra. Vale também para o tempo real: o socket manda **invalidação**, e o cliente
   refaz a leitura — reproduzir o cálculo do lastro no front criaria duas fontes da verdade para
   a regra que define o produto.
5. **Não criar rota de servidor no Nuxt (`web/server/`).** A API é o `api/`. Um segundo backend
   em paralelo é exatamente o caminho paralelo que a doutrina proíbe.

---

## Os domínios de negócio que este produto toca

> **Regra #0:** nada de financeiro sai de memória.

| Domínio | Skill agnóstica (fábrica) | Overlay específico (aqui) |
|---|---|---|
| Orçado × realizado, variação | `preator/conhecimento/negocio/financeiro/controladoria-orcamento` | `skills/negocio/` |
| Parcelamento | `preator/conhecimento/negocio/financeiro/credito` | `skills/negocio/` |
| Finanças pessoais, lastro | **não existe na fábrica** | `skills/negocio/` ← única fonte |

**O que este produto faz diferente do padrão do setor:**

O **lastro**. Nenhuma skill da fábrica cobre esse conceito — ele é regra de produto, não
conhecimento de domínio. Foi escalado ao humano e decidido em
[ADR-002](../docs/decisoes/ADR-002-orcamento-por-envelope-com-lastro.md).

⛔ **Se encontrar outra regra financeira sem skill que a cubra: pare e escale.** Não infira.

---

## O que já decidimos (e não vamos rediscutir)

| Decisão | ADR |
|---|---|
| Stack TypeScript, Nuxt, dois composes, dinheiro em centavos | [001](../docs/decisoes/ADR-001-stack-e-infraestrutura.md) |
| Orçamento por envelope com lastro; rateio pró-rata; reserva fora do lastro | [002](../docs/decisoes/ADR-002-orcamento-por-envelope-com-lastro.md) |
| Ciclo real de fatura no MVP; fatura é entidade; pagamento preserva a origem | [003](../docs/decisoes/ADR-003-ciclo-real-de-fatura.md) |
| Fechar o mês sela a competência; a sobra fica em conta | [004](../docs/decisoes/ADR-004-fechamento-mantem-a-sobra.md) |
| Família com vários logins; convite validado por identidade; email por `.env` | [005](../docs/decisoes/ADR-005-acesso-familiar-e-convite.md) |
| Fatias no GitHub Issues | [006](../docs/decisoes/ADR-006-fatias-no-github-issues.md) |
| Tempo real por WebSocket; servidor emite invalidação, não estado | [007](../docs/decisoes/ADR-007-tempo-real-por-websocket.md) |
| Drizzle no lugar do Prisma; o schema é TypeScript e a migration é SQL versionado | [009](../docs/decisoes/ADR-009-drizzle-no-lugar-do-prisma.md) |

---

## O que está fora de escopo

- **Foto do recibo / OCR** — botão no mockup, responde com aviso. Não é MVP.
- **Importar extrato bancário** — idem.
- **Open Finance / integração bancária** — não está no horizonte do MVP.
- **Multi-moeda** — o produto é BRL.
- **App nativo** — o front responsivo cobre mobile e desktop.

---

## Estado atual

**Onde estamos:** documentação e decisões fechadas; **nenhuma linha de produto escrita**.

**O que está em construção:** F0 (gargalo serial) e F1 (fatia molde). Ver
`gh issue list --label fatia`.

**O que está quebrado e conhecido:**

- `preator-perfil.sh` todo comentado → veredito `PARCIAL` com 5 SKIPs bloqueantes. **É esperado.**
  Preenchido na F0, quando `api/` e `web/` existirem.
- `bernstein.yaml` ainda aponta para `.sdd/backlog/open/`, que está vazio porque as fatias foram
  para o Issues. **Backlog vazio não significa "não há trabalho"** — ver ADR-006.

> Antes de codar, leia [docs/APRENDIZADOS.md](../docs/APRENDIZADOS.md). Ele lista seis armadilhas
> do protótipo que voltam a morder em quem "segue o mockup" sem saber o que já foi corrigido.
