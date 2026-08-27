/**
 * DINHEIRO NA BORDA — centavos ↔ texto, num lugar só.
 *
 * O produto guarda dinheiro em **inteiro de centavos** na pilha inteira
 * (`.preator/CONTEXT.md` regra 2, [D-06](../../../docs/decisoes/D-06-dinheiro-em-centavos.md)).
 * A conversão para reais existe só na **borda de exibição e de digitação** —
 * nunca no composable, nunca antes de mandar para a API.
 *
 * ⚠️ POR QUE ESTE ARQUIVO EXISTE, e não uma cópia por tela: `formatarCentavos`
 * já estava duplicado — uma cópia em `pages/contas.vue`, outra idêntica em
 * `pages/orcamento.vue`, comentário e tudo. E `textoParaCentavos` estava preso
 * dentro de `contas.vue`, prestes a ser copiado para a segunda tela que
 * precisasse de campo digitável.
 *
 * Duplicar `textoParaCentavos` seria duplicar o pedaço mais perigoso do front:
 * ele já teve um defeito real corrigido (ver abaixo), e uma correção que só
 * chega a uma das cópias é pior que o defeito original, porque a segunda cópia
 * continua errada com aparência de código revisado.
 */

/**
 * Centavos → reais, formatado em pt-BR com o cifrão.
 *
 * É a função de **exibição**. Quem precisa do valor para editar em campo de
 * texto usa `centavosParaTexto`, que hoje é a mesma coisa e existe separada
 * porque as duas podem divergir (um campo de digitação pode querer perder o
 * cifrão sem que o resto da tela perca).
 */
export function formatarCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Centavos → o texto que aparece DENTRO de um campo digitável.
 *
 * Mantém o cifrão de propósito: o campo não perde o desenho só por ter virado
 * editável.
 */
export function centavosParaTexto(centavos: number): string {
  return formatarCentavos(centavos);
}

/**
 * O que a pessoa digitou → centavos inteiros.
 *
 * Aceita o que gente digita de verdade: `1234`, `12,34`, `1.234,56`, `R$ 10`,
 * `,5`. Nunca devolve negativo, nunca devolve `NaN`.
 *
 * ⚠️ O DEFEITO QUE ESTA FUNÇÃO JÁ TEVE, e que a forma abaixo existe para
 * impedir: quando o último separador NÃO é decimal, ele é de milhar — e aí
 * TODOS os dígitos são da parte inteira, não só os que vêm antes dele. Pegar
 * só o pedaço anterior lia `1.000` como R$ 1,00: alguém digitando mil reais
 * guardava um.
 *
 * ⚠️ SEM TESTE AUTOMATIZADO. A suíte deste projeto roda só em `api/`
 * (`TEST_CMD` do `preator-perfil.sh`), e não há harness de teste em `web/`.
 * Foi verificada à mão contra 17 casos — inclusive `1.000`, `1.234.567,89`,
 * `,5` e `10,999`. Nada disso regride sozinho: está registrado como lacuna na
 * matriz de completude da EF-02, e mover a função para cá **não fecha** essa
 * lacuna — só reduz de duas cópias para uma o que precisa ser coberto quando
 * o harness existir.
 */
export function textoParaCentavos(texto: string): number {
  const limpo = texto.replace(/[^\d.,]/g, '');
  if (!limpo) return 0;

  const ultimoSeparador = Math.max(limpo.lastIndexOf(','), limpo.lastIndexOf('.'));
  const casasDecimais = ultimoSeparador === -1 ? 0 : limpo.length - ultimoSeparador - 1;
  const ehDecimal = casasDecimais > 0 && casasDecimais <= 2;

  const inteiro = (ehDecimal ? limpo.slice(0, ultimoSeparador) : limpo).replace(/\D/g, '');
  const decimal = ehDecimal ? limpo.slice(ultimoSeparador + 1).replace(/\D/g, '') : '';

  const centavos = Number(inteiro || '0') * 100 + Number(decimal.padEnd(2, '0').slice(0, 2) || '0');
  return Number.isFinite(centavos) ? Math.max(0, centavos) : 0;
}
