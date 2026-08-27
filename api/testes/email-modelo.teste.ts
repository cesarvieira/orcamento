/**
 * O modelo visual do email (layout `Email Padrao.html` do Claude Design).
 *
 * O que se prova aqui não é "está bonito" — isso é olho humano. É que o
 * conteúdo dinâmico é ESCAPADO: o nome da família vem do banco, escrito por
 * gente, e vai parar dentro do HTML de um email que outra pessoa abre.
 */
import { describe, expect, it } from 'vitest';

import { montarEmailHtml } from '../src/modulos/familia/email-modelo';

function montarComTitulo(titulo: string): string {
  return montarEmailHtml({
    sobretitulo: 'Convite',
    titulo,
    paragrafos: ['Um parágrafo.'],
    acao: { rotulo: 'Aceitar convite', url: 'http://localhost:3001/convite/abc' },
    rodape: 'Rodapé.',
  });
}

describe('modelo de email', () => {
  it('escapa o conteúdo dinâmico — nome de família não vira marcação', () => {
    const html = montarComTitulo('Ana & Bruno <casa>');

    expect(html).toContain('Ana &amp; Bruno &lt;casa&gt;');
    expect(html).not.toContain('<casa>');
  });

  it('não deixa um nome hostil injetar tag no email de outra pessoa', () => {
    const html = montarComTitulo('<script>alert(1)</script>');

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapa também a URL da ação, que aparece no href e no texto', () => {
    const html = montarEmailHtml({
      sobretitulo: 'Convite',
      titulo: 'Título',
      paragrafos: ['Um parágrafo.'],
      acao: { rotulo: 'Aceitar', url: 'http://x.test/convite/a"onmouseover="alert(1)' },
      rodape: 'Rodapé.',
    });

    expect(html).not.toContain('onmouseover="alert(1)"');
    expect(html).toContain('&quot;onmouseover=');
  });

  it('RN-10: renderiza o código só quando ele existe, e em bloco legível', () => {
    const semCodigo = montarComTitulo('Título');
    expect(semCodigo).not.toContain('Seu código');

    const comCodigo = montarEmailHtml({
      sobretitulo: 'Convite',
      titulo: 'Título',
      paragrafos: ['Um parágrafo.'],
      codigo: '048217',
      acao: { rotulo: 'Abrir', url: 'http://x.test/convite' },
      rodape: 'Rodapé.',
    });
    expect(comCodigo).toContain('Seu código');
    expect(comCodigo).toContain('048217');
    // Monoespaçado: quem vai DIGITAR precisa distinguir 0 de O e 1 de l.
    expect(comCodigo).toContain('font-family:\'Courier New\',Courier,monospace');
  });

  it('renderiza o destaque só quando ele existe', () => {
    const semDestaque = montarComTitulo('Título');
    expect(semDestaque).not.toContain('border-left:3px solid #14325a');

    const comDestaque = montarEmailHtml({
      sobretitulo: 'Convite',
      titulo: 'Título',
      paragrafos: ['Um parágrafo.'],
      destaque: { rotulo: 'Atenção:', texto: 'expira.' },
      acao: { rotulo: 'Aceitar', url: 'http://x.test/c' },
      rodape: 'Rodapé.',
    });
    expect(comDestaque).toContain('border-left:3px solid #14325a');
    expect(comDestaque).toContain('Atenção:');
  });

  it('mantém a estrutura que cliente de email exige: tabela e estilo inline', () => {
    const html = montarComTitulo('Título');

    // Sem <div> de layout e sem classe externa — Outlook descarta os dois.
    expect(html).toContain('role="presentation"');
    expect(html).toContain('width="600"');
    // A faixa e o botão usam a cor do sistema visual do app.
    expect(html).toContain('#14325a');
  });
});
