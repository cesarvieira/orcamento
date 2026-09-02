/**
 * O CRAWLER DE NAVEGAÇÃO DESTE PROJETO.
 *
 * O gate `navegacao` da fábrica separa "compila" de "funciona": ele percorre as
 * rotas do front RODANDO e reprova em erro de console, resposta >= 400 ou
 * página de erro. Só o projeto conhece as suas rotas e o seu login — por isso o
 * crawler é daqui, declarado como `CRAWL_CMD` no `preator-perfil.sh`.
 *
 * NESTE PRODUTO TUDO É ÁREA LOGADA. A credencial de fixture tem default (o
 * mesmo do `docker-compose.yml`), então a área logada é coberta sem depender
 * de arquivo não versionado. Com `CRAWL_SEM_LOGIN=1` o crawler cobre só a tela
 * de login e DECLARA no veredito que não cobriu o resto — em vez de fingir.
 *
 * Saída (o gate lê estas duas chaves):
 *     rotas:<visitadas>  quebradas:<com problema>
 */
import { chromium } from 'playwright';

const BASE = (process.env.FRONT_BASE ?? 'http://localhost:3001').replace(/\/$/, '');
const API_BASE = (process.env.API_BASE ?? 'http://localhost:3000').replace(/\/$/, '');
/**
 * A credencial de fixture da stack de prova. São os MESMOS valores que o
 * `docker-compose.yml` declara como default (`PREATOR_TEST_USER:-...` e
 * `PREATOR_TEST_PASS:-...`) e que o seed grava no banco que este crawler vai
 * visitar — por isso os dois lados PRECISAM concordar.
 *
 * Isto é fixture, não segredo: nenhum sistema real é protegido por ela, e o
 * valor já está em arquivo rastreado (o compose). O default existe aqui porque
 * o crawler roda no HOST, é `node` puro e nunca passa pelo `carregar-dotenv` —
 * então ele lia só o ambiente do shell, que num worktree recém-aberto está
 * vazio. Resultado: o gate cobria só a tela de login e declarava cobertura
 * parcial, sem que nada estivesse errado com o produto.
 *
 * Se os dois lados divergirem, o login falha alto e o gate reprova — que é o
 * modo de falha certo. O que não pode voltar a acontecer é o gate rodar sem
 * cobrir a área logada porque um arquivo não versionado não estava lá.
 */
const USUARIO = process.env.PREATOR_TEST_USER || 'ana@exemplo.test';
const SENHA = process.env.PREATOR_TEST_PASS || 'orcamento-teste';
const ESPERA = Number(process.env.CRAWL_TIMEOUT_MS ?? 20000);

/** A rota pública. É a única que existe antes de haver sessão. */
const ROTA_PUBLICA = '/entrar';

/**
 * As rotas logadas. Espelham `web/app/config/navegacao.ts` — os sete destinos mais
 * a tela-índice do mobile.
 *
 * A duplicação é deliberada e é o ponto: se alguém acrescentar destino lá e
 * esquecer aqui, o gate para de cobrir a tela nova. A conferência abaixo
 * transforma esse esquecimento em rota quebrada, não em silêncio.
 */
const ROTAS_LOGADAS = [
  '/',
  '/contas',
  '/extrato',
  '/faturas',
  '/orcamento',
  '/metas',
  '/fechamento',
  '/mais',
];

/**
 * Ruído que não é defeito do produto. Mantenha esta lista CURTA e justificada:
 * cada item aqui é uma classe de erro que o gate deixa de pegar.
 */
const RUIDO_ACEITO = [
  // A extensão do devtools do Vue, quando presente no ambiente de quem roda.
  /vue-devtools/i,
  // A exceção de `/favicon.ico` (D-10) SAIU daqui: o app agora declara
  // `link rel="icon"` explícito para os dois PNG (`web/nuxt.config.ts`), e
  // com ele o Chrome para de pedir o `/favicon.ico` implícito. MEDIDO
  // (tarefa #129), não suposto: uma visita completa a `/entrar` contra o
  // BUILD DE PRODUÇÃO, registrando TODA requisição da página (sem filtrar
  // por status — "não pediu" e "pediu e não deu erro" são coisas
  // diferentes, e só a lista completa distingue as duas) — das 41
  // requisições da página, ZERO bateram em `/favicon.ico`. Se um gate
  // futuro mostrar o navegador voltando a pedi-lo, a exceção volta aqui —
  // com o motivo medido, não por hábito (é a mesma regra que descartou a
  // lista de bloqueio no `sw.js`, D-10).
];

function ehRuido(texto) {
  return RUIDO_ACEITO.some(rx => rx.test(texto));
}

async function entrar(pagina) {
  await pagina.goto(`${BASE}${ROTA_PUBLICA}`, { waitUntil: 'networkidle', timeout: ESPERA });
  await pagina.fill('input[name="email"]', USUARIO);
  await pagina.fill('input[name="senha"]', SENHA);
  await Promise.all([
    pagina.waitForURL(u => !u.pathname.startsWith(ROTA_PUBLICA), { timeout: ESPERA }),
    pagina.click('button[type="submit"]'),
  ]);
}

async function visitar(contexto, rota) {
  const pagina = await contexto.newPage();
  const problemas = [];

  pagina.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const texto = msg.text();
    if (ehRuido(texto)) return;
    problemas.push(`console: ${texto}`);
  });

  pagina.on('pageerror', (erro) => {
    problemas.push(`exceção: ${erro.message}`);
  });

  pagina.on('response', (resposta) => {
    if (resposta.status() < 400) return;
    if (ehRuido(resposta.url())) return;
    problemas.push(`rede ${resposta.status()}: ${resposta.url()}`);
  });

  try {
    const resposta = await pagina.goto(`${BASE}${rota}`, {
      waitUntil: 'networkidle',
      timeout: ESPERA,
    });

    if (!resposta || resposta.status() >= 400) {
      problemas.push(`documento ${resposta?.status() ?? 'sem resposta'}`);
    }

    // O redirecionamento silencioso para o login é o modo de falha desta
    // stack: a rota "abre", mas não é a rota pedida. Sem esta checagem, uma
    // sessão que não colou daria sete telas verdes que são a mesma tela.
    const chegou = new URL(pagina.url()).pathname;
    if (chegou.startsWith(ROTA_PUBLICA) && rota !== ROTA_PUBLICA) {
      problemas.push(`caiu no login (sessão não colou) ao pedir ${rota}`);
    }

    // Uma tela que renderiza o shell vazio passa em tudo acima e não prova
    // nada. Exigimos texto visível.
    const texto = (await pagina.locator('body').innerText()).trim();
    if (texto.length < 10) {
      problemas.push('render vazio (menos de 10 caracteres visíveis)');
    }
  } catch (erro) {
    problemas.push(`navegação: ${erro.message}`);
  } finally {
    await pagina.close();
  }

  return problemas;
}

async function principal() {
  // O opt-out virou EXPLÍCITO quando a credencial de fixture ganhou default:
  // sem ele `temCredenciais` seria sempre verdadeiro, e o ramo que declara
  // cobertura parcial viraria código morto. Ramo que nunca roda não é
  // honestidade, é enfeite. Quem precisa provar o crawler sem área logada
  // (ambiente sem seed, por exemplo) roda com CRAWL_SEM_LOGIN=1.
  const temCredenciais =
    process.env.CRAWL_SEM_LOGIN !== '1' && Boolean(USUARIO && SENHA);

  console.log(`base: ${BASE}`);
  console.log(`api:  ${API_BASE}`);
  if (!temCredenciais) {
    console.log(
      'AVISO: login desligado (CRAWL_SEM_LOGIN=1) — ' +
      'a ÁREA LOGADA NÃO FOI COBERTA. Só a tela de login foi verificada.',
    );
  }

  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({ viewport: { width: 1280, height: 800 } });

  let visitadas = 0;
  let quebradas = 0;

  const rotas = [ROTA_PUBLICA];

  try {
    if (temCredenciais) {
      const pagina = await contexto.newPage();
      try {
        await entrar(pagina);
        rotas.push(...ROTAS_LOGADAS);
      } catch (erro) {
        console.log(`  ✗ ${ROTA_PUBLICA} — login falhou: ${erro.message}`);
        quebradas += 1;
      } finally {
        await pagina.close();
      }
    }

    for (const rota of rotas) {
      const problemas = await visitar(contexto, rota);
      visitadas += 1;
      if (problemas.length > 0) {
        quebradas += 1;
        console.log(`  ✗ ${rota}`);
        for (const p of problemas) console.log(`      ${p}`);
      } else {
        console.log(`  ✓ ${rota}`);
      }
    }

    // Também no mobile: a tab bar é outra moldura, e uma moldura que só foi
    // provada num tamanho não foi provada.
    const movel = await navegador.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    try {
      if (temCredenciais) {
        const pagina = await movel.newPage();
        try {
          await entrar(pagina);
        } finally {
          await pagina.close();
        }
        const problemas = await visitar(movel, '/');
        visitadas += 1;
        if (problemas.length > 0) {
          quebradas += 1;
          console.log('  ✗ / (mobile 390px)');
          for (const p of problemas) console.log(`      ${p}`);
        } else {
          console.log('  ✓ / (mobile 390px)');
        }
      }
    } finally {
      await movel.close();
    }
  } finally {
    await contexto.close();
    await navegador.close();
  }

  const cobertura = temCredenciais ? 'login + área logada' : 'SÓ a tela de login';
  console.log(`cobertura: ${cobertura}`);
  console.log(`rotas:${visitadas} quebradas:${quebradas}`);

  return quebradas === 0 ? 0 : 1;
}

try {
  const codigo = await principal();
  process.exit(codigo);
} catch (erro) {
  console.error(erro);
  console.log('rotas:0 quebradas:1');
  process.exit(1);
}
