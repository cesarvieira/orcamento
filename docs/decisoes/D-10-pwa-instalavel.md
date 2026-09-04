# D-10 — PWA instalável, com cache só de asset versionado

- **Status:** aceita
- **Data:** 2026-09-02

## Contexto

Este produto é responsivo e vive no navegador — **app nativo está fora de escopo** e continua fora.
O que falta não é uma tela: é o app não ser instalável. Quem controla orçamento familiar abre o app
várias vezes por dia, e hoje o caminho é uma aba entre as outras.

Instalar não muda comportamento de negócio nenhum. Muda **como o app é aberto** — e é por isso que
isto é decisão de arquitetura e não de produto: o que ela decide de verdade é **o que o navegador
passa a poder guardar no aparelho**.

Quatro restrições reais moldam o desenho. Nenhuma delas é preferência.

**1 · Toda tela é área logada, e o HTML já é dado financeiro.** O front é Nuxt em SSR com sessão em
cookie `httpOnly` ([D-01](D-01-stack.md)). O servidor não devolve um casco que depois busca dado:
devolve a tela **com o saldo dentro**. Não existe aqui a rota pública onde um cache de HTML seria
inofensivo.

**2 · Um cache no cliente é um servidor a mais — e esse não tem token.** A regra inviolável #1 do
`.preator/CONTEXT.md` fecha o vazamento entre famílias no servidor, derivando o `familiaId` do
token. Um service worker que respondesse HTML do cache serviria a última tela logada **antes** de
qualquer verificação de sessão, no aparelho onde outra pessoa da casa — ou o dono seguinte do
aparelho — abre o app. É a mesma falha reaberta do lado do cliente, onde nenhum teste de API a
alcança. **Isto é requisito desta decisão, não polimento dela.**

**3 · Quem decide se o app é instalável é o navegador.** O evento `beforeinstallprompt` só dispara
quando manifesto, ícones e service worker foram validados **e** o app ainda não está instalado. Ou
seja: o service worker aqui não existe para dar offline — existe porque **sem ele o Chrome não
considera o app instalável**. Isso inverte a pergunta usual. Não é _"quanto dá para cachear?"_, é
_"qual é o **menor** cache que ainda satisfaz a checagem?"_.

**4 · O gate de navegação cobra zero erro de console e de rede.** Manifesto, ícone ou `sw.js`
ausente é 404, e 404 reprova as nove rotas do crawler. Cada arquivo novo declarado no `<head>` é uma
promessa que o artefato de deploy ([D-09](D-09-deploy-em-producao.md)) precisa cumprir.

## Decisão

**O app se declara instalável — manifesto, ícones e service worker —, e o service worker cacheia
exclusivamente asset estático com nome versionado.**

Seis partes, e as seis são a decisão:

**1 · A regra de cache, que é esta decisão inteira.**

| O que                                | O que o service worker faz                          |
| ------------------------------------ | --------------------------------------------------- |
| `/_nuxt/*`, fontes e ícones          | cacheia — responde do cache, e vai à rede se faltar |
| HTML de qualquer rota, inclusive `/` | **nunca** cacheia — passa direto para a rede        |
| `/api/*`                             | **nunca** cacheia — passa direto para a rede        |
| o socket (`/realtime`)               | **nunca** cacheia — passa direto para a rede        |

O que autoriza cachear a primeira linha é o **nome**: o Vite grava o hash do conteúdo no nome do
arquivo, então um `/_nuxt/<hash>.js` que está no cache é, por construção, byte a byte o que a rede
devolveria. Não há versão velha a servir por engano, e não há dado de família dentro. As três linhas
seguintes não têm nenhuma dessas duas propriedades — e basta **uma** delas faltar para a regra
inviolável #1 voltar a ficar aberta.

**A regra é de segurança, e por isso se redige como lista de permissão, nunca de bloqueio.** O
`sw.js` casa o que **pode** entrar no cache; o que não casar vai para a rede. Uma lista de bloqueio
erra em silêncio no dia em que nasce uma rota que ninguém lembrou de listar; a lista de permissão
erra na direção de **não** cachear, que é a direção segura.

**2 · O service worker é escrito à mão, e é arquivo estático.** Mora em `web/public/sw.js`, servido
como as fontes. **A regra inviolável #5 do `.preator/CONTEXT.md` não é aberta por esta decisão:**
nada aqui cria `web/server/` nem rota de servidor nenhuma no Nuxt — o `sw.js` é conteúdo estático,
não handler. O `install` pré-carrega o mínimo, o `activate` apaga o cache da versão anterior, e é só
isso que ele faz.

**3 · Existe uma `offline.html`, e ela não tem dado nenhum.** Página estática, servida quando uma
navegação falha por rede. Ela existe por motivo mecânico: o Chrome exige resposta offline para
considerar o app instalável, e sem ela o `beforeinstallprompt` nunca dispararia. Ela **não** é o
começo de um modo offline — é o preço da checagem, e esse preço se paga sem cachear tela.

**4 · O botão _Instalar_ aparece porque o navegador o ofereceu, e some porque instalou.** O app
guarda o `beforeinstallprompt` adiado e renderiza o botão **apenas enquanto esse evento existe**;
`appinstalled` zera o estado. A condição _"só para quem ainda não instalou"_ fica verdadeira **por
construção** — sem `localStorage`, sem heurística de user agent, sem estado nosso a sincronizar. O
botão vive no menu _Mais_ **e** na sidebar, pelo mesmo motivo que o _Sair_ já vive nos dois: no
desktop ninguém passa pela tela _Mais_.

**5 · O registro é só no cliente e só no build de produção.** Em `nuxt dev` o service worker disputa
com o HMR do Vite e produz a classe de bug que ninguém consegue reproduzir depois. O plugin é
`.client.ts` e verifica o build antes de registrar.

**6 · A arte do ícone vem do humano; o que é pequeno demais para copiar, o repositório deriva.**
Os PNG do pacote fornecido entram versionados em `web/public/icones/` — copiados, não redesenhados.
Três exceções, todas geradas por script a partir do `icone-512.png` (o maior que é versionado), com
o **Playwright que o monorepo já tem** para o gate de navegação — sem dependência nova, e regeráveis
por quem vier depois:

- a **_maskable_**, que o pacote não traz — `scripts/gerar-icone-maskable.mjs`;
- os **favicons** (16, 32, 48, 96) — `scripts/gerar-favicons.mjs`;
- o **`apple-touch-icon`** (180) — mesmo script.

**Os tamanhos pequenos passaram a ser derivados em 2026-09-03, por defeito medido no pacote**, não
por preferência: o `16.png`, o `32.png` e o `180.png` chegaram achatados contra branco (zero pixels
transparentes, os quatro cantos em `rgb(255,255,255)` opaco), enquanto o `192` e o `512` do mesmo
pacote vinham com os cantos transparentes corretos — na aba do navegador, um quadrado branco em
volta do ícone arredondado; na tela de início do iPhone, lascas brancas nos cantos. O defeito é do
gerador que produziu o pacote, então copiar de novo o traria de volta. Derivar também corrigiu a
redução: o script cai pela metade a cada passo (512 → 256 → … → 16) em vez de saltar direto, que é
o que preserva traço fino.

**O `apple-touch-icon` é o oposto dos favicons: tem de ser OPACO.** O iOS compõe alfa sobre preto e
só então aplica a própria máscara arredondada — canto transparente vira lasca preta, canto branco
(o que o pacote entregou) vira lasca branca. O preenchimento não é cor chapada nem gradiente
amostrado: as duas foram tentadas e medidas, e erravam de 10 a 15 níveis na faixa lateral que sobra,
porque a arte tem margem nas laterais e gradiente diagonal. O que vale é **extensão de borda** —
cada linha estica a cor do próprio pixel da arte na ponta dela até o limite do quadro. A emenda é
zero por construção, e não há constante para envelhecer quando a arte mudar (a maior diferença
medida no resultado, a 8px da borda, é de 4–5 níveis, que é o gradiente da própria arte).

**O que derivar NÃO resolve, e nenhuma versão deste script vai resolver:** a 16 px a arte é uma
casa, uma seta, um cifrão, duas mãos e uma pilha de moedas em 256 pixels no total. O limite ali é a
quantidade de detalhe do desenho, não a qualidade da reamostragem. Sair desse limite pede outra
coisa — um SVG (que escala sem perda e que os navegadores preferem quando existe) ou uma variante
simplificada da marca para tamanhos pequenos. As duas são **arte, e portanto do humano**: nenhuma
delas se inventa aqui.

## Alternativas consideradas

**`@vite-pwa/nuxt` + Workbox.** É o caminho padrão, e é o errado aqui. O valor do módulo é o gerador
de precache — a peça que existe justamente para fazer o que esta decisão proíbe: cachear o HTML das
rotas. Adotá-lo seria trazer a máquina inteira para configurá-la a não usar quase nada dela, e
deixar a regra de segurança expressa como **ausência de configuração** — o tipo de regra que volta
sozinha no dia em que alguém atualiza a dependência e aceita o novo default. Vinte linhas de `sw.js`
legíveis por qualquer revisor valem mais que uma configuração que só o autor entende.

**Cachear HTML, ou oferecer offline completo.** Descartado por segurança, e é o descarte que dá nome
a esta decisão: deixaria a última tela logada no disco do aparelho, servível antes de qualquer
verificação de sessão. É a regra inviolável #1 reaberta pelo cliente (ver Contexto). Não é troca de
conveniência por risco — é reintroduzir, no navegador, o vazamento que o servidor já fecha.

**Lista de bloqueio no `sw.js`, em vez de lista de permissão.** Descartado pelo modo de falha: as
duas listas descrevem a mesma regra hoje e falham em direções opostas amanhã. Rota nova que ninguém
acrescentou à lista de bloqueio **é cacheada**; caminho novo que ninguém acrescentou à lista de
permissão apenas **não** é cacheado. Quando uma das falhas é vazamento de dado financeiro, a escolha
não é de estilo.

**Cachear `/api` com invalidação pelo socket.** Tecnicamente coerente com [D-04](D-04-tempo-real.md)
— o socket já empurra invalidação. Descartado **desta história**, não por mérito: ver saldo e
lançamento sem rede é decisão de produto **e** de segurança (que dado de família fica no aparelho,
por quanto tempo, e o que o apaga no logout), e sobe para EF antes de virar código. Fica como fork
declarado, não como item de backlog técnico.

**Não ter service worker nenhum** — só manifesto e ícones. Era a opção de menor superfície, e foi
descartada por medida do navegador, não por gosto: sem service worker e sem resposta offline o
Chrome não considera o app instalável, o `beforeinstallprompt` não dispara, e o botão desta história
nunca apareceria. O service worker aqui é custo obrigatório da instalabilidade — e é essa moldura
que justifica ele ser o menor possível.

**Botão _Instalar_ só na tela _Mais_.** Descartado por ser invisível justamente onde mais gente
usaria: no desktop a sidebar substitui aquela tela, e ninguém passa por ela. O _Sair_ já vive nos
dois lugares pelo mesmo motivo; o botão novo segue o padrão que já existe em vez de inventar um.

**Detectar instalação por conta própria** — `localStorage`, user agent, ou `display-mode:
standalone`. Descartado: duplica em estado nosso um fato que o navegador já sabe, e estado duplicado
diverge. O evento adiado responde à pergunta certa (_"este navegador está oferecendo instalação
agora?"_) sem nada para guardar, migrar ou limpar.

**Instrução de instalação para iOS agora.** Descartado desta fase: o Safari não expõe
`beforeinstallprompt` e nenhum site dispara instalação lá — o caminho é manual
(_Compartilhar → Adicionar à Tela de Início_). Escrever uma folha de instruções seria construir
produto para uma capacidade que o navegador não dá, e mantê-la correta a cada versão do iOS. Fica
como **pendência declarada** na EF-00 §5, não como bug.

**Desenhar ou gerar o ícone aqui.** Descartado por decisão do humano em 2026-09-02: a arte foi
fornecida (pacote `appstore-images`, de 16 a 1024 px). Ícone de produto é identidade, não asset a
improvisar em tarefa de infraestrutura. A única imagem derivada é a _maskable_, que o pacote não
traz e cuja geração é mecânica — centrar o ícone na zona segura que o Android recorta.

## Consequências

- **O produto passa a ter um cache no cliente, e cache é estado que alguém precisa lembrar de
  invalidar.** O `activate` apaga a versão anterior, então mudar a **lista** de arquivos é barato.
  Mudar a **estratégia** não é: exige subir o nome do cache e esperar que cada aparelho instalado
  passe por um `activate`. Não existe botão para expirar cache de aparelho alheio.
- **Toda alteração no `sw.js` é alteração de segurança.** Acrescentar um padrão à lista de permissão
  reabre a regra inviolável #1 para revisão — não é mudança de performance, e não se aprova como se
  fosse. É a consequência mais cara desta decisão, porque é permanente e recai sobre quem revisar
  daqui em diante.
- **Existe um arquivo JavaScript fora do pipeline do Vite.** `web/public/sw.js` não tem hash, não
  passa por bundling e não é verificado pelo `tsc`. Em troca, o `eslint.config.mjs` ganha um bloco de
  globais de service worker (`self`, `caches`, `clients`) que existe só para ele, e o `knip` pode
  precisar de entry para o plugin de registro. É o custo permanente de não trazer o Workbox, e foi
  aceito de olho aberto.
- **A `offline.html` existe para uma checagem, não para quem usa.** Ela precisa continuar sem dado
  nenhum. Página que ninguém olha apodrece: é a candidata natural a receber _"só um resumo do
  saldo"_ um dia, e é exatamente isso que ela não pode receber.
- **O iOS fica sem botão**, e quem usa iPhone não vê diferença nenhuma desta história. Declarado na
  EF-00 §5 como pendência conhecida; a fase 2 existe se e quando alguém a pedir.
- **O `<head>` ganha promessas que o gate cobra.** Manifesto, ícones e `theme-color` entram no
  `app.head` do `web/nuxt.config.ts`; cada arquivo declarado e ausente do artefato de deploy é 404, e
  404 reprova o gate de navegação. A superfície nova de falha não é o código do service worker — é o
  inventário de arquivos estáticos.
- **O favicon passa a existir**, e com ele sai a exceção que o crawler carrega hoje para o 404 de
  `/favicon.ico`. Se o gate mostrar que o navegador ainda o pede, a exceção volta — com o motivo
  medido, não suposto.
- **O app instalado abre sem barra de endereço.** `display: standalone` tira de quem usa o indicador
  de origem e o botão de recarregar. É o que instalar significa; fica registrado porque é perda real,
  e não só ganho.
- **Um aviso de _"nova versão disponível"_ não faz sentido sob esta regra.** Sem cache de HTML, o
  carregamento seguinte já traz a versão nova. O aviso só passaria a ter função se a regra de cache
  mudasse — e mudá-la é mudar esta decisão, não implementar uma melhoria.
- **Nada aqui toca a API.** Nenhuma rota nova, nenhum campo no contrato
  ([D-03](D-03-contrato-gerado.md)), nenhuma linha em `api/`. É a primeira decisão deste repositório
  cuja superfície inteira é o navegador — e a primeira em que quem tem como reprová-la é o gate de
  navegação, não o de teste.
