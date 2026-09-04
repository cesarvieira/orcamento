/**
 * GERA OS ÍCONES DE NAVEGADOR a partir da arte grande (D-10,
 * `docs/decisoes/D-10-pwa-instalavel.md`, §6): os quatro favicons e o
 * `apple-touch-icon`.
 *
 * ⛔ POR QUE ESTES NÃO VÊM MAIS DO PACOTE. Até aqui eram copiados do
 * `appstore-images` como todos os outros. Medido no pacote de 2026-09-03:
 * `16.png`, `32.png` e `180.png` chegaram **achatados contra branco** — zero
 * pixels transparentes, os quatro cantos em `rgb(255,255,255)` opaco —,
 * enquanto o `192` e o `512` do MESMO pacote vinham com os cantos
 * transparentes corretos. Na aba do navegador isso aparece como um quadrado
 * branco em volta do ícone arredondado; na tela de início do iPhone, como
 * lascas brancas nos cantos. Não é defeito de uma arte específica: é do
 * gerador que produziu o pacote, e copiar de novo o traria de volta.
 *
 * Entrada: `web/public/icones/icone-512.png` (versionado, vindo do humano).
 * Saída:   `favicon-16/32/48/96.png` (com alfa) e `apple-touch-icon.png` (opaco,
 *          preenchido por extensão de borda — ver o bloco no meio do arquivo).
 *
 * ⚠️ REDUÇÃO EM ETAPAS, não de uma vez. Ir de 512 para 16 num `drawImage` só
 * faz o navegador amostrar ~1 pixel a cada 32 e joga fora o resto — traço fino
 * (o telhado, a seta) simplesmente some. Aqui a imagem cai pela metade a cada
 * passo (512 → 256 → 128 → 64 → 32 → 16), que é o que faz cada pixel do
 * resultado carregar a média de todos os que ele substitui.
 *
 * Por que canvas e não `page.screenshot()`, como o irmão
 * `gerar-icone-maskable.mjs`: screenshot achata contra o fundo da página e
 * devolve sempre PNG opaco — exatamente o defeito que este script existe para
 * corrigir nos favicons. `canvas.toDataURL()` decide caso a caso.
 *
 * Mesma dependência do irmão (o Chromium do Playwright, que o monorepo já tem
 * para o gate de navegação) e mesma promessa: idempotente — sem tempo nem
 * aleatoriedade, roda duas vezes e sai o mesmo PNG.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RAIZ_ICONES = fileURLToPath(new URL('../web/public/icones/', import.meta.url));
const ORIGEM = `${RAIZ_ICONES}icone-512.png`;

/**
 * Os tamanhos declarados em `web/nuxt.config.ts`. Não é uma lista solta: cada
 * um responde a uma densidade de tela real.
 *
 *   16 → aba em tela 1×             48 → aba em 3×, atalho do Windows
 *   32 → aba em 2×, favorito em 1×  96 → favorito/histórico em tela densa
 *
 * O navegador escolhe o melhor par; declarar só 16 e 32 (como era) obrigava
 * uma tela 3× a ampliar o 32, e ampliar é o que borra.
 */
const TAMANHOS_FAVICON = [16, 32, 48, 96];

/** O que a Apple pede há anos para `<link rel="apple-touch-icon">`. */
const LADO_APPLE_TOUCH = 180;

async function gerar() {
  const base64 = readFileSync(ORIGEM).toString('base64');

  const navegador = await chromium.launch();
  try {
    const pagina = await navegador.newPage({ viewport: { width: 128, height: 128 } });

    const saidas = await pagina.evaluate(
      async ({ dados, tamanhosFavicon, ladoAppleTouch }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${dados}`;
        await img.decode();

        /** Um canvas transparente do tamanho pedido, com a melhor reamostragem disponível. */
        function quadro(lado) {
          const canvas = document.createElement('canvas');
          canvas.width = lado;
          canvas.height = lado;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          return { canvas, ctx };
        }

        /** A arte reduzida ao lado pedido, caindo pela metade a cada passo. */
        function reduzir(destinoLado) {
          let atual = img;
          let ladoAtual = img.width;

          while (Math.floor(ladoAtual / 2) > destinoLado) {
            const metade = Math.floor(ladoAtual / 2);
            const { canvas, ctx } = quadro(metade);
            ctx.drawImage(atual, 0, 0, metade, metade);
            atual = canvas;
            ladoAtual = metade;
          }

          const { canvas, ctx } = quadro(destinoLado);
          ctx.drawImage(atual, 0, 0, destinoLado, destinoLado);
          return canvas;
        }

        // ── O FUNDO DO APPLE-TOUCH: EXTENSÃO DE BORDA ─────────────────────
        //
        // O `apple-touch-icon` NÃO pode ter alfa: o iOS compõe transparência
        // sobre PRETO e depois aplica a própria máscara arredondada, então
        // canto transparente vira lasca preta — e canto branco, como vinha do
        // pacote, vira lasca branca. Alguma coisa opaca tem de preencher o
        // que sobra em volta do desenho.
        //
        // O QUE ELE **NÃO** É: uma cor chapada nem um gradiente amostrado.
        // Tentei os dois antes de medir. A arte tem 13px de margem lateral em
        // 512 (o desenho não encosta na esquerda nem na direita) e um
        // gradiente DIAGONAL — mais claro à direita, mais escuro à esquerda.
        // Nenhuma cor única e nenhum gradiente vertical acerta as duas
        // laterais ao mesmo tempo: medido, a emenda ficava de 10 a 15 níveis
        // fora na faixa de ~4px que sobra em cada lado.
        //
        // O QUE ELE É: para cada LINHA, a cor do próprio pixel da arte na
        // ponta daquela linha, esticada até a borda do quadro. A emenda passa
        // a ser zero **por construção** — não porque a amostra ficou boa, mas
        // porque não existe amostra: o pixel que preenche é literalmente o
        // vizinho dele. E não há constante nenhuma para envelhecer quando a
        // arte mudar.
        function fundoPorExtensaoDeBorda(canvasComArte, lado) {
          const ctx = canvasComArte.getContext('2d', { willReadFrequently: true });
          const imagem = ctx.getImageData(0, 0, lado, lado);
          const d = imagem.data;
          const OPACO = 250;

          // A ponta esquerda e a direita de cada linha. `null` na linha que
          // não tem pixel opaco nenhum (não acontece nesta arte, que encosta
          // no topo e na base — mas uma arte menor teria, e aí a linha herda
          // da vizinha mais próxima, logo abaixo).
          const pontas = [];
          for (let y = 0; y < lado; y++) {
            let esq = -1;
            let dir = -1;
            for (let x = 0; x < lado; x++) {
              if (d[(y * lado + x) * 4 + 3] >= OPACO) {
                if (esq === -1) esq = x;
                dir = x;
              }
            }
            pontas.push(esq === -1 ? null : { esq, dir });
          }

          const pontaMaisProxima = (y) => {
            for (let raio = 0; raio < lado; raio++) {
              if (pontas[y - raio]) return { y: y - raio, ...pontas[y - raio] };
              if (pontas[y + raio]) return { y: y + raio, ...pontas[y + raio] };
            }
            return null;
          };

          const pintar = (x, y, origemX, origemY) => {
            const destino = (y * lado + x) * 4;
            const origem = (origemY * lado + origemX) * 4;
            d[destino] = d[origem];
            d[destino + 1] = d[origem + 1];
            d[destino + 2] = d[origem + 2];
            d[destino + 3] = 255;
          };

          for (let y = 0; y < lado; y++) {
            const ponta = pontas[y] ? { y, ...pontas[y] } : pontaMaisProxima(y);
            if (!ponta) continue;
            for (let x = 0; x < ponta.esq; x++) pintar(x, y, ponta.esq, ponta.y);
            for (let x = ponta.dir + 1; x < lado; x++) pintar(x, y, ponta.dir, ponta.y);
          }

          // O que sobrou semitransparente é a franja antisserrilhada da borda
          // arredondada da arte. Ela já está por cima de pixel opaco agora;
          // só falta carimbar o alfa para que o PNG saia sem canal algum de
          // transparência — que é a exigência do iOS.
          for (let i = 3; i < d.length; i += 4) d[i] = 255;

          ctx.putImageData(imagem, 0, 0);
          return canvasComArte;
        }

        const apple = fundoPorExtensaoDeBorda(reduzir(ladoAppleTouch), ladoAppleTouch);

        return {
          favicons: tamanhosFavicon.map(lado => ({
            lado,
            dataUrl: reduzir(lado).toDataURL('image/png'),
          })),
          appleTouch: apple.toDataURL('image/png'),
        };
      },
      { dados: base64, tamanhosFavicon: TAMANHOS_FAVICON, ladoAppleTouch: LADO_APPLE_TOUCH },
    );

    const escrever = (nome, dataUrl) => {
      writeFileSync(`${RAIZ_ICONES}${nome}`, Buffer.from(dataUrl.split(',')[1], 'base64'));
      console.log(`gerado: ${nome}`);
    };

    for (const { lado, dataUrl } of saidas.favicons) escrever(`favicon-${lado}.png`, dataUrl);
    escrever('apple-touch-icon.png', saidas.appleTouch);

    console.log('  favicons com alfa · redução em etapas a partir de icone-512.png');
    console.log(`  apple-touch ${LADO_APPLE_TOUCH}×${LADO_APPLE_TOUCH} OPACO · fundo por extensão de borda (sem alfa, sem cor fixa)`);
  } finally {
    await navegador.close();
  }
}

await gerar();
