# D-04 — Tempo real: o servidor empurra invalidação, não estado

- **Status:** aceita
- **Data:** 2026-08-22

## Contexto

Várias pessoas da mesma família usam o app ao mesmo tempo. Ana lança a feira no mercado enquanto
Bruno decide se cabe um jantar fora.

E aqui a atualização importa mais do que numa lista comum: **quase tudo na tela é estado
derivado**. Um único lançamento muda o gasto da categoria, o disponível, o restante do plano, o
lastro, o déficit e — por rateio pró-rata — o **bloqueado de todas as outras categorias**. Um
lançamento em qualquer canto reescreve a tela inteira.

Um app de orçamento cuja resposta a *"quanto posso gastar?"* está velha erra exatamente na
pergunta que existe para responder.

## Decisão

**WebSocket (Socket.IO)** na mesma porta da API, path `/realtime`. Room por família, resolvida no
**handshake** a partir do cookie de sessão.

O servidor emite **invalidação**:

```jsonc
// evento: recurso.alterado  →  room familia:<familiaId>
{ "recurso": "lancamentos", "competencia": "2026-08", "origemClienteId": "<uuid>" }
```

Quem recebe **refaz a leitura pela API**. Não aplica diff, não patcheia estado local, não
recalcula nada.

Quem agiu não espera o socket: a mutação HTTP já responde com o estado recomputado, e o cliente
descarta eventos cujo `origemClienteId` é o seu. Ao **reconectar**, o cliente refaz a leitura da
competência ativa incondicionalmente.

## Alternativas consideradas

**Enviar o estado novo no evento (diff/patch).** A mais tentadora, e descartada com convicção:
para aplicar um diff útil o cliente precisaria conhecer a fórmula do lastro — ou seja,
reimplementar a regra de negócio no front. Viola [D-03](D-03-contrato-gerado.md) e cria duas
fontes da verdade para o cálculo que **define** o produto. O custo do refetch é irrelevante perto
disso.

**Server-Sent Events.** Tecnicamente suficiente para invalidação: unidirecional, HTTP puro,
reconexão nativa. Descartado porque presença (*"Ana está lançando agora"*) e qualquer interação
colaborativa futura exigem o caminho de volta — e manter um transporte só evita SSE e WebSocket
convivendo depois.

**Polling.** Ou lento demais para o problema, ou frequente demais para o custo.

## Consequências

- **Nenhuma variável de ambiente nova:** o socket vive na porta da API, então `API_BASE` já
  descreve o endpoint.
- **O socket é uma nova superfície de tenant.** A room deriva do token; o servidor **nunca** aceita
  um `subscribe(familiaId)` vindo do cliente — seria um bypass do isolamento que a REST garante.
- **Nenhum gate da fábrica cobre WebSocket.** O de navegação prova que a tela abre; um socket que
  falha em reconectar deixa a página perfeita, o console limpo e o número velho. Por isso o tempo
  real ganha prova própria: **dois clientes**, no artefato de deploy, incluindo o passo de
  derrubar e reconectar.
- O front conecta **só no cliente**, após a hidratação — SSR não abre socket.
- Cada módulo passa a ter uma responsabilidade a mais: **emitir a invalidação do que altera**.
