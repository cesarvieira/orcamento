# ADR-007 — Tempo real por WebSocket

- **Status:** aceita
- **Data:** 2026-08-22
- **Decisor:** Cesar Vieira
- **Regras que gera:** RN-RT-001, RN-RT-002, RN-RT-003

## Contexto

O produto é usado por **várias pessoas da mesma família ao mesmo tempo**. Ana lança a feira no
mercado enquanto Bruno está com o app aberto decidindo se cabe um jantar fora.

Sem sincronização, Bruno vê o número de antes. E aqui isso é pior do que numa lista comum: **quase
tudo na tela é estado derivado**. Um único lançamento muda o gasto da categoria, o disponível, o
`restanteTotal`, o lastro, o déficit e — por rateio pró-rata — o **bloqueado de todas as outras
categorias** (ADR-002). Um lançamento em qualquer canto reescreve a tela inteira.

Um app de orçamento cuja resposta a *"quanto posso gastar?"* está desatualizada não erra por pouco:
ele erra exatamente na pergunta que existe para responder.

## Decisão

**WebSocket entre a API e o front**, na mesma porta `3000`, no path `/realtime`.

**Socket.IO** no servidor e no cliente — reconexão automática, heartbeat e *rooms* prontos. Room
por família é o mapeamento direto do isolamento que a REST já garante.

### O servidor emite invalidação, não estado

```jsonc
// canal (room): familia:<familiaId>   ← derivado do token no handshake
// evento: recurso.alterado
{
  "recurso": "lancamentos",       // | orcamento | contas | faturas | metas | fechamento
  "competencia": "2026-08",       // null quando não é escopado por mês
  "origemClienteId": "<uuid>",    // quem causou
  "em": "2026-08-22T13:00:00Z"
}
```

O cliente que recebe **refaz a leitura pela API**. Ele não aplica diff, não patcheia estado local
e não recalcula nada.

### Quem agiu não espera o socket

A mutação HTTP já responde com o estado recomputado da competência. O ator vê a verdade pela
resposta; o socket serve aos **outros**. O cliente descarta eventos cujo `origemClienteId` é o seu
— sem isso, toda ação dispara um refetch redundante.

### Reconectar obriga a ressincronizar

Evento perdido durante uma queda não pode deixar número velho na tela. Ao reconectar, o cliente
refaz a leitura da competência ativa **incondicionalmente**.

## Alternativas consideradas

**Enviar o estado novo no evento (diff/patch).** Descartada, e é a alternativa mais tentadora.
Para aplicar um diff útil o cliente precisaria conhecer a fórmula do lastro e do rateio — ou seja,
**reimplementar a regra de negócio no front**. Isso viola frontalmente a regra de que o front
importa o contrato e não redeclara o modelo do back, e criaria duas fontes da verdade para o
cálculo que define o produto. O custo do refetch é irrelevante perto disso.

**Server-Sent Events.** Tecnicamente suficiente para invalidação — é unidirecional, roda em HTTP
puro e traz reconexão nativa. Descartada por dois motivos: presença (*"Ana está lançando agora"*)
e qualquer interação colaborativa futura exigem o caminho de volta; e manter um único transporte
bidirecional evita ter SSE mais WebSocket convivendo depois.

**Polling.** Descartada: ou é lento demais para o problema, ou frequente demais para o custo.

**Nuxt `server/` como camada de WebSocket.** Descartada por ADR-001 — seria um segundo backend
em paralelo ao `api/`.

## Consequências

**Boas**

- Nenhuma variável de ambiente nova: o WebSocket vive na porta da API, então `API_BASE` já
  descreve o endpoint.
- A sessão em cookie `httpOnly` (ADR-005) é enviada no handshake do upgrade. A autenticação do
  socket é a mesma da REST, sem token secundário.
- Room por família torna o isolamento estrutural, não uma verificação a cada mensagem.

**Custos e cuidados**

- **O socket é uma nova superfície de tenant.** RN-FAM-001 vale nele: a room deriva do token no
  handshake, e o servidor **nunca** aceita o cliente pedir para assinar uma família. Um
  `subscribe(familiaId)` vindo do cliente seria um bypass do isolamento que a REST enforça.
- **O gate de navegação não cobre isto.** Ele prova que a tela abre; um socket que falha em
  reconectar deixa a página perfeita, o console limpo e o número velho. É o "verde que não é
  verde" na forma mais pura. Por isso o tempo real ganha **prova própria**: um teste de dois
  clientes, no artefato de deploy. Defeito que escapa vira gate.
- O front conecta **só no cliente**, após a hidratação — SSR não abre socket.
- Cada fatia passa a ter uma responsabilidade a mais: **emitir a invalidação do que ela altera**.
  Entra no DoD.
- Escalar para mais de uma instância da API exigiria um adaptador (Redis) para propagar eventos
  entre elas. Fora do horizonte de um app familiar; registrado para não surpreender.
