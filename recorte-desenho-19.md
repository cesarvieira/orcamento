# Recorte do desenho — história #19 (EF-05 Faturas)

> Extraído pelo condutor do Claude Design, projeto `b7d13c37-0d57-4a92-9df6-c50357cb587d`,
> em 2026-08-28, de **`Orcamento Familiar.dc.html`** (1480 linhas) e
> **`Orcamento Familiar Desktop.dc.html`** (1557 linhas) — os DOIS, desta vez.
>
> **Como foi obtido:** as tools `mcp__claude-design__*` não existem nesta sessão e o
> `/design-consent` respondeu 403 três vezes. O humano forneceu a URL do arquivo; o condutor leu
> os dois arquivos pela sessão logada do Chrome (RPC `OmeletteService/GetFile`) e os gravou em
> disco. Isto é **fonte de verdade**, não leitura de tela renderizada.
>
> **Como ler este arquivo.** Duas marcas, e a diferença importa:
>
> - 🟦 **FONTE** — está no desenho. Você pode citar como desenho.
> - 🟨 **ANOTAÇÃO DO CONDUTOR** — leitura minha. **Não é desenho.** Se construir contra isto,
>   diga no seu relato que construiu contra anotação.
>
> ⚠️ A EF-05 §4 lista o que **não se copia**. As duas armadilhas estão confirmadas no fonte, com
> o código exato, na seção 5.

---

## 1 · De onde a tela `fatura` ABRE — são QUATRO portas, e uma delas não abre nada

🟦 **FONTE — porta 1 (mobile e desktop): "Ver fatura", no cartão da tela `contas`.**
Só aparece quando a conta é cartão (`sc-if value="{{ a.ehCartao }}"`), lado a lado com "Pagar
fatura" (mobile L287-290; desktop L366-369):

```html
<sc-if value="{{ a.ehCartao }}">
  <div style="display:flex; gap:8px; margin-top:12px">
    <button onClick="{{ a.verFatura }}" ...>Ver fatura</button>
    <button onClick="{{ a.pagarFatura }}" ...>Pagar fatura</button>
  </div></sc-if
>
```

```js
verFatura:   () => this.setState({ tela:'fatura', faturaContaId:a.id, sheet:null }),   // L1041
pagarFatura: () => pagar(a.id),                                                        // L1042
```

⚠️ **A segunda é a porta que NÃO abre a tela: ela paga direto, da lista de contas.** Perder isso
faz o produto exigir dois passos onde o desenho pede um. Note que ela mora na tela `contas`, que
é da **EF-02** — é costura, não escopo desta tarefa. Declare, não implemente por conta própria.

🟦 **FONTE — porta 2 (mobile): o item "Fatura do cartão" na tela _Mais_** (L1180):

```js
{ titulo:'Fatura do cartão', sub:this.m(faturaTotalGeral) + ' em aberto', t:'fatura' },
// ...  .map(x => ({ ...x, ir: () => this.ir(x.t) }));
```

O `sub` é o total **de todos os cartões** (`faturaTotalGeral`, L1121), não o do cartão em foco.

🟦 **FONTE — porta 3 (desktop): o item "Faturas" na sidebar** (`navDesktop`, L1243):

```js
{ id:'fatura', label:'Faturas', icone:'ti-credit-card', badge:'' },
```

Sem badge — de propósito: os vizinhos têm (`contas` traz o nº de contas, `extrato` o nº de
lançamentos), e este não.

🟦 **FONTE — a aba ativa.** Estando em `fatura`, quem acende no mobile é **Contas**, não um
destino próprio (L1158):

```js
const ativoNav = id => s.tela === id || (id === 'contas' && s.tela === 'fatura') || ...
```

🟨 **ANOTAÇÃO — o app já resolveu isto e diverge do mobile.** `web/app/config/navegacao.ts` já
tem o destino `faturas` (rota `/faturas`, ícone `ti-credit-card`, `abaNoMobile:false`,
`especificacao:'EF-05'`), o que bate com a sidebar do desktop e com a tela _Mais_ do mobile.
O que o app **não** tem é a regra de "Contas fica aceso quando estou na fatura". Isso é
`navegacao.ts`/layout — fora do escopo de T2. Declare como costura.

**Para onde a tela SAI:**

- 🟦 mobile (L358): breadcrumb `‹ Contas` → `voltarContas: () => this.ir('contas')` (L1461);
- 🟦 desktop: **não há breadcrumb** — a sidebar sempre está lá;
- 🟦 ambos: `pagarFaturaFoco: () => { if (cartaoFoco) pagar(cartaoFoco.id); }` (L1462 / L1539).

**Que estado a torna visível:** `isFatura: s.tela === 'fatura'` (L1188). O cartão em foco sai de
`s.faturaContaId`, com fallback para o primeiro cartão (L1119):

```js
const cartaoFoco =
  contas.find((a) => a.id === s.faturaContaId && a.ehCartao) || contas.find((a) => a.ehCartao);
```

Estado inicial: `faturaContaId: 'cred'` (L860).

---

## 2 · 🟦 FONTE — a tela `fatura` no mobile (L356-381)

Cinco blocos, nesta ordem:

1. **Breadcrumb** `‹ Contas`, cinza (#8b94a3), 12px/700.
2. **Cabeçalho azul** (`#14325a`, raio 16, padding 18):
   - `{{ faturaNomeCartao }}` — 11px/700, `letter-spacing:0.07em`, `opacity:0.62`
   - `{{ faturaTotal }}` — **34px/800**, `letter-spacing:-0.02em`
   - `{{ faturaDatas }}` — 11.5px, `opacity:0.72`
3. **O aviso** — card branco, 11.5px, `#5b6675`, texto **literal**:

   > Cada compra no crédito já saiu da categoria. O saldo da conta só muda quando a fatura é paga.

   (A EF-05 §3 manda mantê-lo. É este, palavra por palavra.)

4. **Lista de itens** — `<sc-for list="{{ itensFatura }}" as="e">`, cards brancos com
   ícone 28px colorido, `{{ e.desc }}` (13.5px/700), `{{ e.sub }}` (11px, #8b94a3) e
   `{{ e.valorStr }}` (14px/800).
5. **Botão** full-width, 46px, azul, raio 9999: **"Pagar fatura pela conta corrente"**.

## 3 · 🟦 FONTE — a mesma tela no desktop (L433-456)

Mesmo conteúdo, `max-width:820px`, e **duas diferenças reais**:

- o **botão de pagar sobe para dentro do cabeçalho azul**, à direita, fundo branco/texto azul,
  altura 46, e o rótulo encurta para **"Pagar pela conta corrente"**;
- a lista deixa de ser cards soltos e vira **uma tabela**: um card branco só, linhas separadas
  por `border-top`, padding 13/16.

Tipografia sobe um degrau: total 36px, `desc` 14px, valor 15px. Não há breadcrumb.

## 4 · 🟦 FONTE — o que alimenta a tela

```js
faturaTotal:      this.m(faturaFoco),                                    // L1202
faturaNomeCartao: cartaoFoco ? cartaoFoco.nome : 'Cartão',               // L1203
faturaDatas: cartaoFoco                                                  // L1204-1206
  ? 'Fecha dia ' + (cartaoFoco.fechamento || 30)
  + ' · vence dia ' + (cartaoFoco.vencimento || 8)
  + ' · limite livre ' + this.m(cartaoFoco.limiteLivreConta)
  : '',
itensFatura: s.lancs.filter(l => cartaoFoco && l.conta === cartaoFoco.id && l.v > 0)
             .map(mapLanc),                                              // L1219
```

**`faturaDatas` é a resposta do desenho para "datas do ciclo · limite livre" da EF-05 §3** — uma
linha só, três fatos, separados por `·`.

🟦 O item da lista usa o **mesmo `mapLanc` do extrato** (L1074-1084) — reaproveite, não redeclare:

```js
sub: nomeCat(l.cat) + ' · ' + (l.conta === 'cred' ? 'crédito' : ...)
   + (mostrarQuem ? ' · ' + l.quem : '')
   + (l.parcTotal ? ' · parcela ' + l.parc + '/' + l.parcTotal : ''),
```

🟦 **O limite livre e o saldo do cartão** (L1024-1034):

```js
const faturaConta      = ehCartao ? faturaDe(a.id) : 0;
const saldo            = ehCartao ? faturaConta : (a.base - ...);                    // RN-25
const limiteLivreConta = ehCartao ? Math.max(0, (a.limite || 0) - faturaConta) : 0;  // RN-26
valorStr: (ehCartao ? '−' : '') + this.m(saldo),
corValor: ehCartao ? '#c62828' : '#14325a',
```

🟨 **ANOTAÇÃO:** o `Math.max(0, ...)` é piso do protótipo. A EF-06 não fala em piso para o
limite livre. Se o backend puder devolver negativo (fatura acima do limite), quem decide o que a
tela mostra é o humano — não invente.

🟦 **Os campos do ciclo são capturados na folha de conta** (L753-772, tela da EF-02): dois
_steppers_ — "Vencimento da fatura / dia do débito na conta" e "Fechamento / **até quando as
compras entram nesta fatura**". Valores de exemplo: `vencimento:8, fechamento:30` (L871).

---

## 5 · ⚠️ O QUE NÃO SE COPIA — as duas armadilhas, confirmadas no fonte

🟦 **Armadilha 1 — pagar REATRIBUI os lançamentos** (EF-05 §4.1). O fonte, L1007-1017:

```js
const contaPagadora = (s.contas.find(a => a.tipo === 'debito') || {}).id;
const pagar = id => {
  const val = faturaDe(id);
  if (!val) { this.aviso('Não há fatura em aberto nesse cartão.'); return; }
  this.setState({
    contas: s.contas.map(a => a.id === contaPagadora ? { ...a, base:a.base - val } : a),
    lancs:  s.lancs.map(l => l.conta === id ? { ...l, conta:contaPagadora } : l)   // ⛔ AQUI
  });
```

Depois disso ninguém sabe que a compra foi no cartão: o extrato filtrado por cartão passa a
mentir. **O certo é RN-24** — o pagamento é um `TRANSFERENCIA` próprio entre a conta pagadora e o
cartão, e os lançamentos **mantêm** `contaId`.

🟦 **Armadilha 2 — o ciclo é ignorado** (EF-05 §4.2). O fonte, L1006:

```js
const faturaDe = (id) =>
  s.lancs.filter((l) => l.conta === id && l.v > 0 && !l.mesRel).reduce((a, l) => a + l.v, 0);
```

`!l.mesRel` é "do mês civil corrente". **`fechamento` não aparece nesta conta** — o protótipo
captura o campo na folha de conta, exibe-o em `faturaDatas`, e depois **não o usa para somar**.
**O certo é RN-23**: a compra entra na fatura cujo ciclo de fechamento contém a data.

🟨 **ANOTAÇÃO — uma terceira, que a EF não lista.** `contaPagadora` é a **primeira conta de
débito que aparecer**, fixa no código. Não há escolha de conta pagadora em lugar nenhum do
desenho — e a EF-05 §1 exige `pagaComContaId` na entidade. Ver vazio V3.

---

## 6 · 🟨 OS VAZIOS QUE EU DECLARO — não são "o desenho não define"

Li os dois arquivos inteiros e conferi todas as ocorrências de `fatura` (36 no mobile, 35 no
desktop). O que segue **não existe no desenho**; não é que eu não tenha achado.

- **V1 · Não há status de fatura.** O desenho só conhece "fatura em aberto do ciclo corrente".
  Não há `aberta/fechada/paga`, não há `pagaEm`, não há histórico de fatura paga. A EF-05 §1
  exige os quatro como entidade. Persistir é da tarefa de backend; **expor status na tela não
  tem desenho.** Escale antes de inventar.
- **V2 · Não há navegação entre ciclos.** Nenhum "fatura anterior / próxima". Um cartão, um
  ciclo, o corrente.
- **V3 · Não há escolha de conta pagadora.** Ver a anotação da seção 5. O rótulo do botão diz
  "pela conta corrente" — o desenho **assume** que só existe uma.
- **V4 · Não há tela de faturas no plural.** O desenho abre a fatura de **um** cartão por vez
  (`faturaContaId`); "Faturas" é só o rótulo da sidebar. A rota do app é `/faturas`. Com um
  cartão só isso não aparece; com dois, **não há desenho de como escolher qual**. A porta 1
  resolve (vem do cartão clicado); as portas 2 e 3 **não** — elas caem no fallback
  "primeiro cartão".
- **V5 · Não há estado vazio.** O que existe é o `aviso()` da porta 4: _"Não há fatura em aberto
  nesse cartão."_ — um toast, não uma tela. Como fica a tela `fatura` de um cartão sem compras
  no ciclo: sem desenho.

---

## 7 · 🟨 A costura que este recorte enxerga (não é escopo da tarefa de tela)

- `faturaAviso` (L271) vive no card "EM CONTA HOJE" da tela **`contas`** (EF-02):
  `'Faturas de X ainda não debitadas'` / `'Nenhuma fatura em aberto'`.
- Os botões "Ver fatura" / "Pagar fatura" (portas 1 e 4) também são da tela `contas`.
- `ativoNav` — "Contas" aceso durante `fatura` — é do layout.

Os três dependem do módulo de faturas, mas nenhum é arquivo da tarefa de tela. Reporte-os; não
os edite.
