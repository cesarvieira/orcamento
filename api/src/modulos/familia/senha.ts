/**
 * Hash de senha com scrypt do `node:crypto`.
 *
 * scrypt em vez de bcrypt/argon2 por uma razão operacional: nenhum binário
 * nativo para casar com a plataforma da imagem. Módulo nativo que compila na
 * máquina de quem escreveu e falha no container é a fonte clássica de
 * "funciona local, quebra no deploy" — e é justamente o que o gate
 * `deploy-fresh` existe para pegar. Aqui não há o que pegar.
 *
 * Formato armazenado: `scrypt$N$r$p$<sal-hex>$<derivado-hex>`.
 * O parâmetro vai junto do hash para que aumentar o custo no futuro não
 * invalide as senhas já gravadas.
 */
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/**
 * `promisify` do `node:util` perde a sobrecarga com opções — o tipo resultante
 * aceita três argumentos, e o custo do scrypt é o quarto. Envolvemos à mão para
 * manter o parâmetro de custo no tipo, que é a parte que não pode se perder.
 */
function derivar(
  senha: string,
  sal: Buffer,
  tamanho: number,
  opcoes: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolver, rejeitar) => {
    scrypt(senha, sal, tamanho, opcoes, (erro, derivado) => {
      if (erro) rejeitar(erro);
      else resolver(derivado);
    });
  });
}

const N = 16384;
const r = 8;
const p = 1;
const BYTES_DERIVADOS = 64;

export async function gerarHashDeSenha(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const derivado = await derivar(senha, sal, BYTES_DERIVADOS, { N, r, p });
  return [
    'scrypt',
    N,
    r,
    p,
    sal.toString('hex'),
    derivado.toString('hex'),
  ].join('$');
}

export async function conferirSenha(
  senha: string,
  armazenado: string | null,
): Promise<boolean> {
  if (!armazenado) return false;

  const partes = armazenado.split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;

  const custoN = Number(partes[1]);
  const custoR = Number(partes[2]);
  const custoP = Number(partes[3]);
  const salHex = partes[4] as string;
  const esperadoHex = partes[5] as string;

  if (!Number.isFinite(custoN) || !Number.isFinite(custoR) || !Number.isFinite(custoP)) {
    return false;
  }

  const esperado = Buffer.from(esperadoHex, 'hex');
  const derivado = await derivar(senha, Buffer.from(salHex, 'hex'), esperado.length, {
    N: custoN,
    r: custoR,
    p: custoP,
  });

  // Comparação em tempo constante: comparar com `===` vaza o prefixo correto.
  return derivado.length === esperado.length && timingSafeEqual(derivado, esperado);
}
