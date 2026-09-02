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
 * A cor de fundo sólido, amostrada da própria arte — não inventada. Medida
 * uma vez sobre `icone-512.png`: é a cor OPACA mais frequente da imagem
 * depois do branco das figuras humanas (que é detalhe do desenho, não fundo)
 * — a média exata dos pixels que caem nesse tom é `rgb(24, 129, 169)`. Os
 * cantos do PNG original são transparentes; sem uma cor nomeada aqui, o
 * fundo do maskable ficaria transparente e o Android pintaria atrás dele com
 * a cor que a plataforma decidir (tipicamente branco), destoando do ícone.
 */
const COR_FUNDO_MASKABLE = '#1881a9';

async function gerar() {
  const base64 = readFileSync(ORIGEM).toString('base64');
  const ladoDoIcone = Math.round(LADO * PROPORCAO_DO_ICONE);

  const navegador = await chromium.launch();
  try {
    const pagina = await navegador.newPage({
      viewport: { width: LADO, height: LADO },
      deviceScaleFactor: 1,
    });

    await pagina.setContent(`
      <html>
        <body style="margin:0;width:${LADO}px;height:${LADO}px;background:${COR_FUNDO_MASKABLE};
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

    const png = await pagina.screenshot({ type: 'png' });
    writeFileSync(DESTINO, png);
  } finally {
    await navegador.close();
  }

  console.log(`gerado: ${DESTINO}`);
  console.log(`  quadro ${LADO}×${LADO} · ícone a ${Math.round(PROPORCAO_DO_ICONE * 100)}% (${ladoDoIcone}px) · fundo ${COR_FUNDO_MASKABLE}`);
}

await gerar();
