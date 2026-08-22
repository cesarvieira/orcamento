# Aprendizados

> **Para quem chega agora — humano ou IA.** Este documento existe para que ninguém repita
> trabalho já feito nem erro já mapeado. Leia depois de [CLAUDE.md](../CLAUDE.md) e antes de
> tocar em qualquer código.
>
> Regra deste arquivo: só entra o que **não se deriva** do código nem dos ADRs. Se é decisão,
> mora em [decisoes/](decisoes/). Se é regra, em [REGRAS-DE-NEGOCIO.md](REGRAS-DE-NEGOCIO.md).
> Aqui ficam as **descobertas** e as **armadilhas**.

---

## 1 · O mockup é a especificação, e ele engana

O produto foi desenhado no Claude Design e o desenho carrega a lógica de domínio inteira em
JavaScript — não é wireframe, é protótipo funcional. **É a fonte mais rica de especificação
que este projeto tem.**

- Projeto: `b7d13c37-0d57-4a92-9df6-c50357cb587d` no Claude Design
- Arquivos: `Orcamento Familiar.dc.html` (mobile), `Orcamento Familiar Desktop.dc.html`
- Acesso por MCP exige consentimento: `/design consent`

**O desktop não acrescenta capacidade nenhuma.** Mesmas sete telas, mesma lógica; troca a tab bar
por sidebar. Isso significa **um front responsivo, não dois produtos** — verificado lendo os dois
arquivos, não presumido.

**`support.js` é runtime gerado** (`// GENERATED from dc-runtime`). Zero conteúdo de produto.
Não portar.

### A leitura errada que quase aconteceu

Antes de ler o mockup, a hipótese natural era "app de categorizar gastos" e a primeira fatia
proposta foi *"registrar uma despesa"*. **Ambas estavam erradas.** O produto é orçamento por
envelope com lastro, e a fatia molde certa é o orçamento do mês, que é o vertical completo mais
simples.

Lição: neste projeto, **ler o mockup antes de propor escopo** não é opcional.

---

## 2 · Seis armadilhas do protótipo

O protótipo prova a experiência, não o modelo. Estes atalhos funcionam na tela e quebram em
produção — todos já corrigidos nos ADRs, listados aqui para que ninguém os reintroduza ao
"seguir o mockup":

| # | O protótipo faz | Por que quebra | Corrigido em |
|---|---|---|---|
| 1 | Pagar fatura **reatribui** os lançamentos do cartão para a conta corrente | apaga a origem; o extrato por cartão passa a mentir | [ADR-003](decisoes/ADR-003-ciclo-real-de-fatura.md) |
| 2 | Captura fechamento e vencimento do cartão e **ignora os dois** | a fatura não bate com a do banco | ADR-003 |
| 3 | Receita é despesa com **valor negativo** e categoria nula | falha para relatar, filtrar e validar | [ADR-002](decisoes/ADR-002-orcamento-por-envelope-com-lastro.md) |
| 4 | **Transferência não existe** — mas pagar fatura e guardar em meta são transferências | vira despesa; corrompe gasto, teto e lastro | ADR-002 |
| 5 | Fechar o mês **move a sobra** para a reserva | movimento automático de dinheiro; e tiraria a sobra do lastro | [ADR-004](decisoes/ADR-004-fechamento-mantem-a-sobra.md) |
| 6 | Dinheiro em `float` com `Math.round(v*100)/100` espalhado | centavo evapora no rateio e no parcelamento | [PADROES.md](PADROES.md#dinheiro) |

**Props de demonstração não são configuração.** `cenarioSemLastro` força o déficit para a demo;
`cartaoAbateSaldoNaHora` inverte RN-CAR-002. Nenhum dos dois é feature.

### Copy que precisa mudar

Duas frases do mockup estão erradas ou ambíguas:

- *"Fechar mês e guardar a sobra"* e *"movidos para a Reserva"* → **incorretas** após ADR-004.
- *"Os tetos se ajustam sozinhos ao que entrou"* → **correta mas ambígua**. Nenhum teto muda de
  valor; o que muda é o desbloqueio. Melhor: *"os tetos se desbloqueiam conforme o dinheiro entra"*.

---

## 3 · A Regra #0 tinha uma lacuna, e ela foi escalada

A fábrica exige que regra financeira venha de `preator/conhecimento/negocio/<domínio>`, citada.
Ao verificar: o domínio `financeiro` está povoado, mas **todo o recorte é corporativo** —
conciliação de gateway, MDR, controladoria empresarial, tesouraria, cobrança.

Aproveitável: `controladoria-orcamento` (orçado × realizado) e `credito` (parcelamento).
Não coberto: finanças pessoais.
**Inexistente em qualquer skill: o lastro.**

O lastro não é conhecimento de domínio — é regra de produto, criada no mockup. Pela doutrina,
"skill vazia → para e escala, nunca inventa". Foi escalado e decidido com o humano em
[ADR-002](decisoes/ADR-002-orcamento-por-envelope-com-lastro.md).

**Se você encontrar outra regra financeira sem skill que a cubra, faça o mesmo: pare e escale.**
Não infira.

---

## 4 · Dois conflitos entre as decisões e os gates

Descobertos ao cruzar as escolhas de infra com o Portão B. Ambos resolvidos, registrados porque
voltam a morder se alguém desfizer a solução:

**A escolha de compose colidia com o artefato de deploy.** Com só o Postgres em compose e
`npm run dev` por cima, os gates `front` e `navegacao` provariam o dev-build — o selo que a
doutrina recusa. Resolvido com **dois composes** ([AMBIENTE.md](AMBIENTE.md#os-dois-composes)).

**O gate de navegação não alcança app 100% logado.** `navegacao.sh` lê `PREATOR_TEST_USER` e
`PREATOR_TEST_PASS` do ambiente; sem isso cobre a tela de login e nada mais. Neste produto
*tudo* é área logada. Resolvido com seed de família de teste na F0 + as variáveis no ambiente.

**Nenhum gate da fábrica cobre o WebSocket.** `navegacao` prova que a tela abre — e um socket que
falha em reconectar deixa a página perfeita, o console limpo e o número velho. Resolvido com a
prova de dois clientes dentro do `TEST_CMD`
([AMBIENTE.md](AMBIENTE.md#a-prova-de-tempo-real)). O passo que pega o bug real é o quarto:
derrubar o socket, gravar, reconectar. Sem ressincronização na reconexão, os três primeiros
passos passam e a tela mente na primeira oscilação de rede.

---

## 5 · Estado que o repositório não conta

- **`preator-perfil.sh` está todo comentado de propósito.** O veredito `PARCIAL` com 5 SKIPs
  bloqueantes é o gate reportando corretamente que não há stack declarada. Ele será preenchido
  na F0, quando `api/` e `web/` existirem — antes disso, um perfil preenchido faria os gates
  falharem apontando para diretórios inexistentes, o que é pior que o SKIP honesto. Os valores
  já decididos estão em [AMBIENTE.md](AMBIENTE.md#estado-atual-do-perfil).

- **As fatias estão no GitHub Issues, não em `.sdd/backlog/open/`**
  ([ADR-006](decisoes/ADR-006-fatias-no-github-issues.md)). O `bernstein.yaml` ainda aponta para
  o backlog em disco e é arquivo gerado — **backlog vazio não significa "não há trabalho"**.
  Rode `gh issue list --label fatia`.

- **`.gitignore` já está preparado para `.env`**: ignora `.env` e `.env.*`, com exceção para
  `.env.example`. A convenção existia antes da decisão de email.

---

## 6 · Como este projeto trabalha

- **Planejar antes de criar.** Apresentar o planejamento, iterar até aprovação, só então tocar
  arquivos. Foi assim que este documento e os ADRs nasceram.
- **Verde não é a prova.** Só `PROVA_DE_COMPORTAMENTO=PASS` fecha fatia. Auto-relato de agente
  é entrada, nunca prova.
- **Um módulo, um worker.** No fan-out, a partição nunca divide um módulo.
- **A costura precisa de dono.** Nenhum agente dono-de-pasta é dono do que fica entre as pastas,
  e é ali que mora a maior parte do defeito. O **lastro** é justamente transversal — depende de
  contas, cartões, faturas e orçamento ao mesmo tempo. Por isso é fatia própria, não detalhe
  espalhado.
- **Defeito que escapa vira gate.** Lição que não produziu portão é lição que vai se repetir.
