/**
 * O MODELO VISUAL DO EMAIL — layout `Email Padrao.html` do Claude Design
 * (projeto b7d13c37-0d57-4a92-9df6-c50357cb587d), o mesmo sistema visual do
 * app: fundo `#eef0f4`, cartão de 600px, faixa e botão em `#14325a`, título
 * em serifada.
 *
 * Mora separado de `email.ts` de propósito: ali é ENTREGA (qual fornecedor
 * despacha), aqui é APARÊNCIA. Mudam por motivos diferentes e em ritmos
 * diferentes.
 *
 * ⚠️ Email não é página web. Aqui NÃO se usa flexbox, grid, classe externa
 * nem `<div>` para layout: cliente de email (Outlook à frente) descarta. É
 * tabela aninhada com estilo INLINE — o `<style>` do topo só carrega as media
 * queries, que os clientes que as suportam aplicam e os demais ignoram sem
 * quebrar.
 */

/**
 * O nome da família vem do banco, escrito por gente. Sem escapar, uma família
 * chamada `Ana & Bruno <3` quebraria o HTML — e um nome hostil poderia
 * injetar marcação no email de outra pessoa.
 */
function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface ConteudoDoEmail {
  /** Etiqueta pequena em caixa alta, acima do título. */
  sobretitulo: string;
  titulo: string;
  /** Cada item vira um parágrafo. */
  paragrafos: string[];
  /** O box destacado com barra à esquerda. Omita para não renderizá-lo. */
  destaque?: { rotulo: string; texto: string };
  acao: { rotulo: string; url: string };
  /** Explica por que a pessoa recebeu isto. Transacional, sem descadastro. */
  rodape: string;
}

export function montarEmailHtml(conteudo: ConteudoDoEmail): string {
  const titulo = escaparHtml(conteudo.titulo);
  const sobretitulo = escaparHtml(conteudo.sobretitulo);
  const url = escaparHtml(conteudo.acao.url);
  const rotuloAcao = escaparHtml(conteudo.acao.rotulo);

  const paragrafos = conteudo.paragrafos
    .map((texto, i) => {
      const margem = i === conteudo.paragrafos.length - 1 ? '0' : '0 0 14px 0';
      return `<p style="margin:${margem};">${escaparHtml(texto)}</p>`;
    })
    .join('');

  const destaque = conteudo.destaque
    ? `
        <tr>
          <td class="px" style="padding:24px 34px 0 34px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f2f4f8; border-radius:12px;">
              <tr>
                <td style="padding:18px 20px; font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:22px; color:#3f4b5c; border-left:3px solid #14325a; mso-line-height-rule:exactly;">
                  <strong style="color:#14325a;">${escaparHtml(conteudo.destaque.rotulo)}</strong> ${escaparHtml(conteudo.destaque.texto)}
                </td>
              </tr>
            </table>
          </td>
        </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${titulo}</title>
<!--[if mso]>
<style>body,table,td,a{font-family:Arial,Helvetica,sans-serif !important}</style>
<![endif]-->
<style>
  @media only screen and (max-width:620px){
    .wrap{width:100% !important}
    .px{padding-left:22px !important; padding-right:22px !important}
    .h1{font-size:25px !important; line-height:32px !important}
    .btn a{display:block !important}
  }
</style>
</head>
<body style="margin:0; padding:0; background:#eef0f4; -webkit-text-size-adjust:100%;">

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eef0f4;">
  <tr>
    <td align="center" style="padding:28px 12px;">

      <table role="presentation" class="wrap" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px; max-width:600px; background:#fbfbfc; border-radius:16px; overflow:hidden; border:1px solid #dfe3ea;">

        <tr>
          <td class="px" style="background:#14325a; padding:26px 34px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="font-family:Arial,Helvetica,sans-serif; font-size:15px; font-weight:bold; color:#ffffff; letter-spacing:-0.2px; mso-line-height-rule:exactly; line-height:20px;">
                  Orçamento da casa
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td class="px" style="padding:34px 34px 0 34px;">
            <p style="margin:0 0 10px 0; font-family:Arial,Helvetica,sans-serif; font-size:11px; font-weight:bold; letter-spacing:1.4px; text-transform:uppercase; color:#7c8798; mso-line-height-rule:exactly; line-height:16px;">${sobretitulo}</p>
            <h1 class="h1" style="margin:0; font-family:Georgia,'Times New Roman',serif; font-size:29px; line-height:36px; font-weight:normal; color:#14325a; mso-line-height-rule:exactly;">${titulo}</h1>
          </td>
        </tr>

        <tr>
          <td class="px" style="padding:18px 34px 0 34px; font-family:Arial,Helvetica,sans-serif; font-size:15px; line-height:25px; color:#3f4b5c; mso-line-height-rule:exactly;">
            ${paragrafos}
          </td>
        </tr>
${destaque}
        <tr>
          <td class="px" align="center" style="padding:28px 34px 4px 34px;">
            <table role="presentation" class="btn" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td bgcolor="#14325a" style="border-radius:12px; padding:16px 34px; mso-padding-alt:16px 34px;">
                  <a href="${url}" style="display:block; font-family:Arial,Helvetica,sans-serif; font-size:15px; font-weight:bold; color:#ffffff; text-decoration:none; letter-spacing:0.2px; mso-line-height-rule:exactly; line-height:20px;">${rotuloAcao}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td class="px" align="center" style="padding:14px 34px 32px 34px; font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:19px; color:#7c8798; mso-line-height-rule:exactly;">
            Ou copie este endereço: <a href="${url}" style="color:#14325a; text-decoration:underline; word-break:break-all;">${url}</a>
          </td>
        </tr>

        <tr>
          <td style="padding:0 34px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="height:1px; background:#e3e7ee; font-size:0; line-height:1px;">&nbsp;</td></tr></table></td>
        </tr>

        <tr>
          <td class="px" style="padding:22px 34px 30px 34px; font-family:Arial,Helvetica,sans-serif; font-size:12px; line-height:20px; color:#8a94a3; mso-line-height-rule:exactly;">
            <p style="margin:0;">${escaparHtml(conteudo.rodape)}</p>
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>`;
}
