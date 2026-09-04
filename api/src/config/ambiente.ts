/**
 * A configuração vem do AMBIENTE — nunca de arquivo versionado (D-07).
 *
 * Este módulo valida o que chegou e falha alto quando falta o essencial: um
 * processo que sobe com metade da config e quebra na primeira requisição custa
 * mais caro que um que não sobe.
 *
 * O dotenv carrega `.env` + `.env.${NODE_ENV}` para `process.env` ANTES da
 * validação — fora do compose (que injeta variável direto), nada mais faz
 * isso. Ver `carregar-dotenv.ts` para a ordem das camadas.
 */
import { z } from 'zod';

import { carregarAmbiente } from './carregar-dotenv';

carregarAmbiente();

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  /**
   * A barreira 1 das duas que a D-09 exige (emenda de 2026-09-01): sem ela,
   * `NODE_ENV=production` sozinho não distingue produção real da stack de
   * PROVA que o gate sobe — a mesma imagem, D-02 — e que precisa semear a
   * família de teste para o gate de navegação ter área logada.
   *
   * `false` por padrão, inclusive em produção real: lá ninguém liga esta
   * chave. Quem liga é o COMANDO do gate (`STACK_UP_CMD` em
   * `preator-perfil.sh`), nunca o `docker-compose.yml` — arquivo não
   * distingue quem o está rodando, comando distingue.
   *
   * Chaveia as DUAS guardas abaixo (SESSAO_SEGREDO e SEMEAR) — de propósito:
   * antes desta variável, a guarda de SESSAO_SEGREDO só passava no gate
   * porque o default do compose (`troque-este-segredo-fora-do-gate`) tem
   * exatamente 32 caracteres. Coincidência não é projeto.
   */
  AMBIENTE_DE_PROVA: z
    .enum(['true', 'false'])
    .default('false')
    .transform(v => v === 'true'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),

  API_PORT: z.coerce.number().int().positive().default(3000),

  /**
   * Assina o cookie de sessão. Em produção é obrigatório (a checagem abaixo
   * derruba o processo se estiver ausente, no default de desenvolvimento, ou
   * curto demais); em dev e teste há um default explícito para não travar o
   * loop local.
   */
  SESSAO_SEGREDO: z.string().default('segredo-de-desenvolvimento'),
  SESSAO_TTL_HORAS: z.coerce.number().int().positive().default(720),

  /**
   * Semeia a família de teste (`PREATOR_TEST_USER`) depois de migrar — é o
   * que dá ao gate de navegação uma área logada para percorrer (D-09). NUNCA
   * em produção: a checagem abaixo derruba o processo se `SEMEAR=true`
   * chegar com `NODE_ENV=production`, porque semear ali colocaria a família
   * de teste no banco real. Lido cru como `process.env.SEMEAR` antes desta
   * tarefa — trazido para o schema para não escapar da validação.
   */
  SEMEAR: z
    .enum(['true', 'false'])
    .default('false')
    .transform(v => v === 'true'),

  /**
   * Origem do front autorizada a mandar cookie (CORS com credenciais). É UMA:
   * a mesma variável monta os links dos emails (convite, confirmação), e um
   * link não pode ter duas origens.
   *
   * Alcançando o app por outro nome (`orcamento.localhost:3001`), aponte esta
   * variável para ELE — não acrescente uma segunda. Além de o CORS passar, os
   * links do email passam a levar para o host que a pessoa de fato usa.
   */
  ORIGEM_WEB: z.string().default('http://localhost:3001'),

  /**
   * O DOMÍNIO do cookie de sessão. Vazio — o default — deixa o cookie
   * *host-only*: preso ao host da API e a mais nenhum.
   *
   * Não é ajuste fino: é o que faz o F5 sobreviver à sessão quando front e API
   * moram em hosts diferentes (D-09). Host-only, o cookie vai para
   * `api.orcamento.cesarvieira.dev` e NUNCA para `orcamento.cesarvieira.dev`
   * — então a requisição do DOCUMENTO, que é a que o SSR do Nuxt recebe e
   * reencaminha (`web/app/composables/useApi.ts`), chega sem cookie nenhum, a
   * API responde 401 e o middleware conclui, com toda a razão, que não há
   * sessão. Depois o navegador hidrata, fala com a API pela URL pública — aí
   * o cookie vai — e manda para `/`. É o F5 que passa por `/entrar` e cai na
   * home. Medido em produção.
   *
   * O que a D-09 mediu era OUTRA requisição: o `fetch` do NAVEGADOR para a
   * API, onde quem manda é o `SameSite=Lax` e domínio registrável igual
   * basta. O documento não passa por aquela medição.
   *
   * Em produção vale `orcamento.cesarvieira.dev`: `api.orcamento...` pode
   * gravar cookie para o domínio-pai, e aí ele acompanha os DOIS hosts.
   *
   * Vazio em dev e no gate de propósito, e lá não custa nada: cookie ignora
   * PORTA, então `localhost:3000` e `localhost:3001` já são o mesmo host para
   * o navegador. É também por isso que nenhum gate pega este defeito sozinho
   * — ele precisa de dois NOMES para existir.
   */
  COOKIE_DOMINIO: z.string().default(''),

  MAIL_DRIVER: z.enum(['log', 'smtp', 'resend', 'ses']).default('log'),
  MAIL_FROM: z.string().default(''),
  /** Credencial do provedor de API (Resend/SES). Vazia quando MAIL_DRIVER=log|smtp. */
  MAIL_API_KEY: z.string().default(''),
  /** Só usados quando MAIL_DRIVER=smtp — qualquer fornecedor que fale o protocolo. */
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  CONVITE_TTL_HORAS: z.coerce.number().int().positive().default(72),
  // Prazo do link que confirma o email de quem criou a família (RN-49).
  // Menor que o do convite de propósito: quem acabou de se cadastrar está com
  // a caixa de entrada aberta; convite espera a agenda de outra pessoa.
  CADASTRO_TTL_HORAS: z.coerce.number().int().positive().default(24),
  // Prazo do código que troca a senha esquecida (RN-52). O MENOR dos três de
  // propósito: é o código mais perigoso — quem o tem troca a senha e, por
  // RN-54, derruba todas as sessões da dona da conta. Quem pediu está com a
  // caixa de entrada aberta agora; não há motivo para ele sobreviver ao dia.
  RECUPERACAO_TTL_HORAS: z.coerce.number().int().positive().default(1),

  /**
   * O client id OAuth do Google — não é segredo (viaja no próprio token), mas
   * é a AUDIÊNCIA que a verificação do ID token exige (EF-01). Vazio desliga
   * o login por Google com um erro claro, em vez de aceitar qualquer token.
   */
  GOOGLE_CLIENT_ID: z.string().default(''),
  /**
   * O client SECRET do Google — este SIM é segredo, e é o primeiro deste
   * projeto que precisa mesmo existir em produção.
   *
   * Ele entrou quando o fluxo passou a ser o de CÓDIGO DE AUTORIZAÇÃO: o
   * navegador devolve um código de uso único, e é a API que o troca por um ID
   * token junto ao Google — troca que exige provar quem é o cliente.
   *
   * ⚠️ NUNCA repasse para o `web`: o front só precisa do client id. Um
   * `NUXT_PUBLIC_*` com este valor o publicaria no HTML de todo mundo.
   */
  GOOGLE_CLIENT_SECRET: z.string().default(''),

  /**
   * OBSERVABILIDADE (D-08) — o DSN da instância SELF-HOSTED do Sentry.
   *
   * Vazio é o default e é um estado válido: o SDK nem se inicializa e NADA sai
   * desta máquina. É isso que mantém a suíte de integração offline e o gate de
   * navegação com zero erro de rede — um coletor inalcançável pintaria o gate
   * de vermelho por um motivo que não é o produto.
   *
   * O DSN não é segredo no sentido do client secret (ele viaja no envelope de
   * todo evento, e o do front sai no HTML), mas também não é público: quem o
   * tem consegue escrever eventos na sua instância. Ambiente, como todo o
   * resto (D-07).
   */
  SENTRY_DSN: z.string().default(''),
  /**
   * Separa dev, prova e produção DENTRO da instância. Vazio herda o
   * `NODE_ENV` — que é o que se quer em 90% dos casos; a variável existe para
   * o caso em que não é (duas instalações de prova, por exemplo).
   */
  SENTRY_AMBIENTE: z.string().default(''),
  /**
   * Fatia das requisições que viram trace de performance. 0.1 = 10%, o
   * suficiente para ver forma sem inundar o disco da instância — que é seu.
   * `0` desliga o tracing e mantém só a captura de erro.
   */
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
  /**
   * A versão que o evento carrega. Preenchida no build (o SHA do commit serve),
   * é o que faz o stack trace casar com o source map certo. Vazia, o evento
   * chega sem release — funciona, só dói mais de ler.
   */
  SENTRY_RELEASE: z.string().default(''),
  /**
   * O slug da organização na instância. Só serve para o `sentry:teste` montar
   * o link direto do evento que acabou de mandar. Vazio, ele imprime só o
   * `event_id` — o teste continua valendo.
   */
  SENTRY_ORG: z.string().default(''),
  /**
   * Liga as PORTAS DE TESTE expostas (o endpoint `/diagnostico/sentry` e a
   * tela `/mais/diagnostico`). `false` por padrão, inclusive em produção: uma
   * delas estoura de propósito, e rota assim aberta é ruído e convite a abuso.
   * Liga para diagnosticar, desliga depois.
   *
   * A CLI `pnpm --filter @orcamento/api run sentry:teste` NÃO passa por aqui:
   * ela é comando, não superfície exposta — e por isso é a porta que funciona
   * a qualquer momento, sem ligar chave nenhuma.
   *
   * Enum em vez de booleano coagido de propósito: `SENTRY_TESTE_HABILITADO=1`
   * ou `=yes` falha alto aqui, em vez de virar `false` em silêncio e render
   * meia hora de "por que o endpoint continua dando 404?".
   */
  SENTRY_TESTE_HABILITADO: z
    .enum(['true', 'false'])
    .default('false')
    .transform(v => v === 'true'),
});

const analise = esquema.safeParse(process.env);

if (!analise.success) {
  const problemas = analise.error.issues
    .map(i => `  · ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`Configuração de ambiente inválida:\n${problemas}`);
}

export const ambiente = analise.data;

/**
 * O mínimo de caracteres que `SESSAO_SEGREDO` precisa ter em produção — o
 * tamanho do digest de um HMAC-SHA256 (32 bytes), o algoritmo que
 * `sessao-servico.ts` usa para assinar o cookie. Abaixo disso o segredo é
 * mais curto que o próprio hash que ele assina.
 */
const SESSAO_SEGREDO_TAMANHO_MINIMO = 32;

// As duas guardas abaixo disparam sob PRODUÇÃO REAL — não sob a stack de
// prova que o gate sobe (mesmo NODE_ENV=production, D-02): AMBIENTE_DE_PROVA
// é o que separa as duas (emenda à D-09, 2026-09-01). NODE_ENV sozinho não
// bastava — foi medido: derrubava o próprio gate que deveria proteger.
if (ambiente.NODE_ENV === 'production' && !ambiente.AMBIENTE_DE_PROVA) {
  if (ambiente.SESSAO_SEGREDO === 'segredo-de-desenvolvimento') {
    throw new Error(
      '[ambiente] SESSAO_SEGREDO ausente (ou igual ao default de desenvolvimento) sob ' +
      'NODE_ENV=production. Defina um segredo forte no ambiente antes de subir — ex.: ' +
      '`openssl rand -hex 32`.',
    );
  }
  if (ambiente.SESSAO_SEGREDO.length < SESSAO_SEGREDO_TAMANHO_MINIMO) {
    throw new Error(
      `[ambiente] SESSAO_SEGREDO tem ${ambiente.SESSAO_SEGREDO.length} caracteres sob ` +
      `NODE_ENV=production — o mínimo é ${SESSAO_SEGREDO_TAMANHO_MINIMO}. Gere um segredo ` +
      'mais forte e defina-o no ambiente — ex.: `openssl rand -hex 32`.',
    );
  }

  if (ambiente.SEMEAR) {
    throw new Error(
      '[ambiente] SEMEAR=true sob NODE_ENV=production. Isso semearia a família de teste ' +
      '(PREATOR_TEST_USER) no banco real — defina SEMEAR=false (ou remova a variável), ou ' +
      'ligue AMBIENTE_DE_PROVA=true se isto for a stack de prova do gate, não produção real.',
    );
  }
}

/** @fundacao ninguém tipa contra isto ainda — todo mundo importa `ambiente` direto. */
export type Ambiente = typeof ambiente;
