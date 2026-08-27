/**
 * O ADAPTADOR DE EMAIL (D-07) — o código fala com um driver; o AMBIENTE
 * escolhe o fornecedor. Trocar de fornecedor é mudar `MAIL_DRIVER`, nunca
 * código.
 *
 * `log` não é só conveniência de teste: sem ele todo teste de integração de
 * convite mandaria email de verdade. Fingir o ENVIO é legítimo; fingir o
 * CONVITE não é — o teste ainda tem de provar que o convite foi persistido,
 * que o token valida, que expira e que email divergente é recusado (D-07).
 *
 * `smtp` fala com QUALQUER fornecedor que implemente o protocolo — SMTP não
 * é uma escolha de fornecedor, então usá-lo aqui não contradiz D-07 (que
 * recusa fixar um fornecedor AGORA). `resend` é uma chamada HTTP direta à
 * API do Resend, sem biblioteca. `ses` fica como ponto de extensão: SigV4 da
 * AWS exige o SDK, que ninguém pediu para instalar ainda — ver fork no
 * relatório da tarefa.
 */
import { ambiente } from '../../config/ambiente';
import { montarEmailHtml } from './email-modelo';

export interface ConviteParaEnviar {
  para: string;
  familiaNome: string;
  /**
   * O código de 6 dígitos que a pessoa vai DIGITAR (RN-10). O email não leva
   * mais o segredo dentro do link: `link` agora só abre a tela, e sozinho não
   * autoriza nada.
   */
  codigo: string;
  link: string;
}

/** Confirmação do email de quem criou a própria família (RN-06). */
export type ConfirmacaoParaEnviar = ConviteParaEnviar;

/** Código que troca a senha esquecida (RN-12). */
export type RecuperacaoParaEnviar = ConviteParaEnviar;

interface DriverDeEmail {
  enviarConvite(convite: ConviteParaEnviar): Promise<void>;
  enviarConfirmacao(confirmacao: ConfirmacaoParaEnviar): Promise<void>;
  enviarRecuperacao(recuperacao: RecuperacaoParaEnviar): Promise<void>;
}

function assuntoDoConvite(familiaNome: string): string {
  return `Convite para a família ${familiaNome} — Orçamento Familiar`;
}

function corpoDoConvite(convite: ConviteParaEnviar): string {
  return `Você foi convidado para a família "${convite.familiaNome}" no Orçamento Familiar.\n\n` +
    `Seu código: ${convite.codigo}\n\nAbra ${convite.link} e digite o código junto com este email.`;
}

/**
 * A versão HTML, no layout do design. O texto acima NÃO é descartado: todo
 * email sai com as duas partes. Cliente que bloqueia HTML, leitor de tela e
 * filtro de spam leem a de texto — mandar só HTML piora entrega e acessibilidade.
 */
function corpoHtmlDoConvite(convite: ConviteParaEnviar): string {
  return montarEmailHtml({
    sobretitulo: 'Convite',
    titulo: `Você foi convidado para a família ${convite.familiaNome}`,
    paragrafos: [
      'Alguém da família criou um acesso para você no Orçamento da casa — o lugar onde vocês ' +
      'planejam o mês por categoria e acompanham o que realmente dá para gastar.',
      'Abra a tela de convite, digite o código abaixo junto com este email e crie sua senha ' +
      '(ou entre com o Google).',
    ],
    codigo: convite.codigo,
    destaque: {
      rotulo: 'Vale por tempo limitado:',
      texto:
        'este convite expira e serve para um único uso. O código erra no máximo 5 vezes antes ' +
        'de ser invalidado — se isso acontecer, peça outro a quem te convidou.',
    },
    acao: { rotulo: 'Abrir a tela de convite', url: convite.link },
    rodape:
      'Você recebeu este email porque alguém do Orçamento da casa convidou este endereço. ' +
      'Se não foi você quem esperava este convite, pode ignorar esta mensagem — sem aceitar, nada é criado.',
  });
}

function assuntoDaConfirmacao(familiaNome: string): string {
  return `Confirme seu email — família ${familiaNome} no Orçamento Familiar`;
}

function corpoDaConfirmacao(c: ConfirmacaoParaEnviar): string {
  return `Você criou a família "${c.familiaNome}" no Orçamento Familiar.\n\n` +
    `Seu código: ${c.codigo}\n\nAbra ${c.link} e digite o código junto com este email.`;
}

function corpoHtmlDaConfirmacao(c: ConfirmacaoParaEnviar): string {
  return montarEmailHtml({
    sobretitulo: 'Confirme seu email',
    titulo: `Falta um passo para abrir a família ${c.familiaNome}`,
    paragrafos: [
      'Você criou a família no Orçamento da casa. Antes de entrar, precisamos ter certeza ' +
      'de que este email é seu — é por ele que a recuperação de acesso vai passar.',
      'Digite o código abaixo na tela de confirmação e você já entra direto.',
    ],
    codigo: c.codigo,
    destaque: {
      rotulo: 'Enquanto não confirmar:',
      texto:
        'o login fica bloqueado para esta conta. O código vale por tempo limitado, serve uma vez ' +
        'só e erra no máximo 5 vezes antes de ser invalidado.',
    },
    acao: { rotulo: 'Abrir a tela de confirmação', url: c.link },
    rodape:
      'Você recebeu este email porque alguém usou este endereço para criar uma família no ' +
      'Orçamento da casa. Se não foi você, ignore — sem a confirmação, ninguém entra nessa conta.',
  });
}

function assuntoDaRecuperacao(familiaNome: string): string {
  return `Recuperar sua senha — família ${familiaNome} no Orçamento Familiar`;
}

function corpoDaRecuperacao(r: RecuperacaoParaEnviar): string {
  return 'Alguém pediu para trocar a senha da sua conta no Orçamento Familiar.\n\n' +
    `Seu código: ${r.codigo}\n\nAbra ${r.link} e digite o código junto com este email.\n\n` +
    'Se não foi você, ignore: sem o código, nada muda.';
}

function corpoHtmlDaRecuperacao(r: RecuperacaoParaEnviar): string {
  return montarEmailHtml({
    sobretitulo: 'Recuperar senha',
    titulo: 'Vamos trocar sua senha',
    paragrafos: [
      'Alguém pediu para trocar a senha desta conta no Orçamento da casa. Se foi você, é só ' +
      'digitar o código abaixo e escolher a senha nova.',
      'Se não foi você, não precisa fazer nada — sem o código, senha nenhuma muda.',
    ],
    codigo: r.codigo,
    destaque: {
      rotulo: 'Ao trocar a senha:',
      texto:
        'todos os aparelhos conectados nesta conta são desconectados. O código vale por pouco ' +
        'tempo e erra no máximo 5 vezes antes de ser invalidado.',
    },
    acao: { rotulo: 'Abrir a tela de recuperação', url: r.link },
    rodape:
      'Você recebeu este email porque este endereço foi usado para pedir uma troca de senha no ' +
      'Orçamento da casa. Se não foi você, ignore esta mensagem.',
  });
}

/** Registra a TENTATIVA de envio — nenhum email sai de verdade (D-07). */
const driverLog: DriverDeEmail = {
  async enviarConvite(convite) {
    console.log(
      `[email:log] convite para ${convite.para} · ${assuntoDoConvite(convite.familiaNome)} · código ${convite.codigo} · ${convite.link}`,
    );
  },
  async enviarConfirmacao(c) {
    console.log(
      `[email:log] confirmação para ${c.para} · ${assuntoDaConfirmacao(c.familiaNome)} · código ${c.codigo} · ${c.link}`,
    );
  },
  async enviarRecuperacao(r) {
    console.log(
      `[email:log] recuperação para ${r.para} · ${assuntoDaRecuperacao(r.familiaNome)} · código ${r.codigo} · ${r.link}`,
    );
  },
};

async function porSmtp(
  para: string,
  subject: string,
  text: string,
  html: string,
): Promise<void> {
  const { default: nodemailer } = await import('nodemailer');
  const transportador = nodemailer.createTransport({
    host: ambiente.SMTP_HOST,
    port: ambiente.SMTP_PORT,
    secure: ambiente.SMTP_PORT === 465,
    auth: ambiente.SMTP_USER ? { user: ambiente.SMTP_USER, pass: ambiente.SMTP_PASS } : undefined,
  });
  await transportador.sendMail({ from: ambiente.MAIL_FROM, to: para, subject, text, html });
}

const driverSmtp: DriverDeEmail = {
  async enviarConvite(convite) {
    await porSmtp(
      convite.para,
      assuntoDoConvite(convite.familiaNome),
      corpoDoConvite(convite),
      corpoHtmlDoConvite(convite),
    );
  },
  async enviarConfirmacao(c) {
    await porSmtp(
      c.para,
      assuntoDaConfirmacao(c.familiaNome),
      corpoDaConfirmacao(c),
      corpoHtmlDaConfirmacao(c),
    );
  },
  async enviarRecuperacao(r) {
    await porSmtp(
      r.para,
      assuntoDaRecuperacao(r.familiaNome),
      corpoDaRecuperacao(r),
      corpoHtmlDaRecuperacao(r),
    );
  },
};

async function porResend(
  para: string,
  subject: string,
  text: string,
  html: string,
): Promise<void> {
  const resposta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ambiente.MAIL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: ambiente.MAIL_FROM, to: [para], subject, text, html }),
  });
  if (!resposta.ok) {
    throw new Error(`o Resend recusou o envio: HTTP ${resposta.status}`);
  }
}

const driverResend: DriverDeEmail = {
  async enviarConvite(convite) {
    await porResend(
      convite.para,
      assuntoDoConvite(convite.familiaNome),
      corpoDoConvite(convite),
      corpoHtmlDoConvite(convite),
    );
  },
  async enviarConfirmacao(c) {
    await porResend(
      c.para,
      assuntoDaConfirmacao(c.familiaNome),
      corpoDaConfirmacao(c),
      corpoHtmlDaConfirmacao(c),
    );
  },
  async enviarRecuperacao(r) {
    await porResend(
      r.para,
      assuntoDaRecuperacao(r.familiaNome),
      corpoDaRecuperacao(r),
      corpoHtmlDaRecuperacao(r),
    );
  },
};

// @fundacao SES exige assinatura SigV4 (SDK da AWS), não instalado ainda —
// D-07 recusou fixar fornecedor nesta tarefa. Escolher SES é decisão do
// humano; até lá, falha alto em vez de fingir que enviou.
function sesNaoImplementado(): never {
  throw new Error(
    'MAIL_DRIVER=ses ainda não tem adaptador implementado. Use smtp ou resend, ' +
    'ou implemente a assinatura SigV4 quando o fornecedor for escolhido.',
  );
}

const driverSes: DriverDeEmail = {
  async enviarConvite() {
    sesNaoImplementado();
  },
  async enviarConfirmacao() {
    sesNaoImplementado();
  },
  async enviarRecuperacao() {
    sesNaoImplementado();
  },
};

const drivers: Record<typeof ambiente.MAIL_DRIVER, DriverDeEmail> = {
  log: driverLog,
  smtp: driverSmtp,
  resend: driverResend,
  ses: driverSes,
};

function driverDeEmail(): DriverDeEmail {
  // Em TESTE o driver é `log` SEMPRE, aconteça o que acontecer com o ambiente.
  // Sem esta trava, um `MAIL_DRIVER=resend` (ou `smtp`) no `.env` de alguém
  // faria a suíte de integração mandar email DE VERDADE, para endereços
  // inventados, a cada execução — e a conta chegaria para o fornecedor.
  //
  // Fixar isso no `.env.test` não resolveria: ele é local e ignorado pelo Git,
  // então a garantia dependeria de cada máquina ter o arquivo certo. Garantia
  // que depende de arquivo não versionado não é garantia. Aqui é código, vale
  // para todo mundo, e o gate a re-executa.
  if (ambiente.NODE_ENV === 'test') return driverLog;

  return drivers[ambiente.MAIL_DRIVER];
}

export async function enviarConvitePorEmail(convite: ConviteParaEnviar): Promise<void> {
  await driverDeEmail().enviarConvite(convite);
}

export async function enviarConfirmacaoPorEmail(c: ConfirmacaoParaEnviar): Promise<void> {
  await driverDeEmail().enviarConfirmacao(c);
}

export async function enviarRecuperacaoPorEmail(r: RecuperacaoParaEnviar): Promise<void> {
  await driverDeEmail().enviarRecuperacao(r);
}
