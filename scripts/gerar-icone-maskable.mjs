/**
 * GERA O ÍCONE MASKABLE — a única imagem derivada da arte (D-10,
 * `docs/decisoes/D-10-pwa-instalavel.md`, §6). O pacote fornecido pelo
 * humano (`appstore-images`) não traz esta variante: o Android recorta o
 * ícone declarado `purpose: "maskable"` numa forma própria (círculo,
 * squircle, ...) e exige que o conteúdo relevante esteja dentro de uma zona
 * segura central — um ícone comum, recortado sem essa margem, perde ponta.
 *
 * Entrada: `web/public/icones/icone-512.png` (já versionado, não gerado).
 * Saída:   `web/public/icones/icone-maskable-512.png` (este script escreve).
 *
 * Por que Playwright, e não uma lib de imagem nova: o monorepo já tem o
 * Chromium do Playwright como devDependency da raiz, para o crawler do gate
 * de navegação (`scripts/crawl-gate.mjs`). Desenhar um quadro 512×512 numa
 * página e tirar um screenshot reaproveita exatamente essa dependência —
 * nenhum pacote de imagem novo entra só para isto.
 *
 * Idempotente: a entrada é sempre a mesma arte e o desenho não tem nada
 * baseado em tempo ou aleatoriedade, então rodar duas vezes produz o mesmo
 * PNG (byte a byte, a menos que o Chromium mude de versão).
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RAIZ_ICONES = fileURLToPath(new URL('../web/public/icones/', import.meta.url));
const ORIGEM = `${RAIZ_ICONES}icone-512.png`;
const DESTINO = `${RAIZ_ICONES}icone-maskable-512.png`;

/** O quadro final. Maskable é sempre quadrado. */
const LADO = 512;

/**
 * O ícone ocupa ~78% do quadro, centrado — a zona segura que sobra (22%,
 * ~11% de margem por lado) é o que o Android ainda mostra depois de recortar
 * a forma dele por cima.
 */
const PROPORCAO_DO_ICONE = 0.78;

/**
 * A COR DE FUNDO é AMOSTRADA DA ARTE, na hora de gerar — não é constante.
 *
 * Ela precisa existir: os cantos do PNG original são transparentes e, sem uma
 * cor por trás, o Android pintaria o fundo do maskable com a cor que a
 * plataforma decidir (tipicamente branco), destoando do ícone.
 *
 * ⛔ POR QUE NÃO É MAIS UMA CONSTANTE. Era `#1881a9` e virou `#374f6f` quando
 * a arte mudou, em 2026-09-03 — e a troca só não passou batida porque alguém
 * lembrou de reamostrar na mão. O `MANUAL-00` ainda ficou um ciclo inteiro com
 * o valor velho. Um número que só está certo enquanto alguém lembra de
 * atualizá-lo é armadilha, não configuração.
 *
 * ── O MÉTODO: MODA, NÃO MÉDIA ────────────────────────────────────────────
 *
 * A cor de fundo é a MODA das cores opacas — o balde mais populoso de um
 * histograma quantizado de 8 em 8 —, e o valor devolvido é a média dos pixels
 * DENTRO desse balde (o que dá precisão de volta sem trazer o resto da imagem
 * junto). O branco fica de fora: `rgb > 235` nos três canais é figura (casa,
 * mãos, moedas), não fundo.
 *
 * ⚠️ NÃO troque por "média de todos os pixels opacos". Parece equivalente e
 * não é — medido nas duas artes deste produto:
 *
 *   arte              | média (errada) | MODA (em uso) | medida à mão na época
 *   ------------------|----------------|---------------|----------------------
 *   1 · turquesa      | #379eab        | #1a84aa       | #1881a9
 *   2 · azul-marinho  | #374f6f        | #334b6c       | —
 *
 * Na arte 1 a média erra por 20 níveis num canal: as moedas verdes e amarelas
 * e o contorno escuro puxam o resultado para um turquesa lavado que não é o
 * fundo de lugar nenhum. A moda ignora tudo isso por construção — ela pergunta
 * "qual cor cobre mais área?", que é exatamente a pergunta certa. A coluna da
 * direita é a prova de que a moda reproduz o que o autor original mediu à mão:
 * `#1a84aa` contra `#1881a9`, dentro do erro do balde.
 *
 * (Este arquivo já afirmou que as duas medidas históricas vinham do mesmo
 * método. Não vinham: `#1881a9` era moda e `#374f6f` era média. A tabela acima
 * existe para que o engano não se repita.)
 */
function amostrarCorDeFundo(pagina) {
  return pagina.evaluate(() => {
    const img = document.getElementById('icone');
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);

    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Baldes de 8 em 8 por canal: fino o bastante para não juntar duas cores
    // distintas, grosso o bastante para que um gradiente suave caia todo no
    // mesmo balde em vez de se espalhar em milhares deles.
    const baldes = new Map();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 250) continue;
      if (data[i] > 235 && data[i + 1] > 235 && data[i + 2] > 235) continue;

      const chave = `${data[i] >> 3}_${data[i + 1] >> 3}_${data[i + 2] >> 3}`;
      const balde = baldes.get(chave) ?? { n: 0, r: 0, g: 0, b: 0 };
      balde.n += 1;
      balde.r += data[i];
      balde.g += data[i + 1];
      balde.b += data[i + 2];
      baldes.set(chave, balde);
    }

    if (baldes.size === 0) throw new Error('maskable: a arte não tem pixel opaco de fundo para amostrar');

    const dominante = [...baldes.values()].reduce((a, b) => (b.n > a.n ? b : a));
    const media = [dominante.r, dominante.g, dominante.b].map(canal => Math.round(canal / dominante.n));
    return `#${media.map(v => v.toString(16).padStart(2, '0')).join('')}`;
  });
}

async function gerar() {
  const base64 = readFileSync(ORIGEM).toString('base64');
  const ladoDoIcone = Math.round(LADO * PROPORCAO_DO_ICONE);
  let corDeFundo;

  const navegador = await chromium.launch();
  try {
    const pagina = await navegador.newPage({
      viewport: { width: LADO, height: LADO },
      deviceScaleFactor: 1,
    });

    // O fundo entra VAZIO de propósito: a cor sai da própria arte, e para
    // amostrá-la a imagem precisa estar carregada na página primeiro.
    await pagina.setContent(`
      <html>
        <body style="margin:0;width:${LADO}px;height:${LADO}px;
                     display:flex;align-items:center;justify-content:center;">
          <img
            id="icone"
            src="data:image/png;base64,${base64}"
            width="${ladoDoIcone}"
            height="${ladoDoIcone}"
          />
        </body>
      </html>
    `);
    await pagina.locator('#icone').waitFor();

    corDeFundo = await amostrarCorDeFundo(pagina);
    await pagina.evaluate((cor) => {
      document.body.style.background = cor;
    }, corDeFundo);

    const png = await pagina.screenshot({ type: 'png' });
    writeFileSync(DESTINO, png);
  } finally {
    await navegador.close();
  }

  console.log(`gerado: ${DESTINO}`);
  console.log(`  quadro ${LADO}×${LADO} · ícone a ${Math.round(PROPORCAO_DO_ICONE * 100)}% (${ladoDoIcone}px) · fundo ${corDeFundo}, amostrado da arte`);
}

await gerar();
