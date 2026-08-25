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
  link: string;
}

interface DriverDeEmail {
  enviarConvite(convite: ConviteParaEnviar): Promise<void>;
}

function assuntoDoConvite(familiaNome: string): string {
  return `Convite para a família ${familiaNome} — Orçamento Familiar`;
}

function corpoDoConvite(convite: ConviteParaEnviar): string {
  return `Você foi convidado para a família "${convite.familiaNome}" no Orçamento Familiar.\n\nAceite o convite em: ${convite.link}`;
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
      'Para entrar, aceite o convite e crie sua senha (ou entre com o Google).',
    ],
    destaque: {
      rotulo: 'Vale por tempo limitado:',
      texto: 'este convite expira e serve para um único uso. Se ele vencer, peça outro a quem te convidou.',
    },
    acao: { rotulo: 'Aceitar convite', url: convite.link },
    rodape:
      'Você recebeu este email porque alguém do Orçamento da casa convidou este endereço. ' +
      'Se não foi você quem esperava este convite, pode ignorar esta mensagem — sem aceitar, nada é criado.',
  });
}

/** Registra a TENTATIVA de envio — nenhum email sai de verdade (D-07). */
const driverLog: DriverDeEmail = {
  async enviarConvite(convite) {
    console.log(
      `[email:log] convite para ${convite.para} · ${assuntoDoConvite(convite.familiaNome)} · ${convite.link}`,
    );
  },
};

const driverSmtp: DriverDeEmail = {
  async enviarConvite(convite) {
    const { default: nodemailer } = await import('nodemailer');
    const transportador = nodemailer.createTransport({
      host: ambiente.SMTP_HOST,
      port: ambiente.SMTP_PORT,
      secure: ambiente.SMTP_PORT === 465,
      auth: ambiente.SMTP_USER ? { user: ambiente.SMTP_USER, pass: ambiente.SMTP_PASS } : undefined,
    });
    await transportador.sendMail({
      from: ambiente.MAIL_FROM,
      to: convite.para,
      subject: assuntoDoConvite(convite.familiaNome),
      text: corpoDoConvite(convite),
      html: corpoHtmlDoConvite(convite),
    });
  },
};

const driverResend: DriverDeEmail = {
  async enviarConvite(convite) {
    const resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ambiente.MAIL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: ambiente.MAIL_FROM,
        to: [convite.para],
        subject: assuntoDoConvite(convite.familiaNome),
        text: corpoDoConvite(convite),
        html: corpoHtmlDoConvite(convite),
      }),
    });
    if (!resposta.ok) {
      throw new Error(`o Resend recusou o envio do convite: HTTP ${resposta.status}`);
    }
  },
};

const driverSes: DriverDeEmail = {
  async enviarConvite() {
    // @fundacao SES exige assinatura SigV4 (SDK da AWS), não instalado ainda
    // — D-07 recusou fixar fornecedor nesta tarefa. Escolher SES é decisão
    // do humano; até lá, falha alto em vez de fingir que enviou.
    throw new Error(
      'MAIL_DRIVER=ses ainda não tem adaptador implementado. Use smtp ou resend, ' +
      'ou implemente a assinatura SigV4 quando o fornecedor for escolhido.',
    );
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
