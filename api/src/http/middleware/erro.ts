/**
 * O tratador de erro final. Uma forma de erro só, em toda a API — é ela que o
 * contrato publica como `Erro` e que o front sabe ler.
 *
 * Nunca devolve a mensagem interna ao cliente: stack e detalhe de driver vão
 * para o log do servidor, não para a tela de quem usa.
 */
import type { NextFunction, Request, Response } from 'express';

export function tratarNaoEncontrado(_req: Request, res: Response): void {
  res.status(404).json({ erro: 'nao_encontrado', mensagem: 'Recurso inexistente.' });
}

export function tratarErro(
  erro: unknown,
  _req: Request,
  res: Response,
  _proximo: NextFunction,
): void {
  console.error('[api] erro não tratado:', erro);
  if (res.headersSent) return;
  res.status(500).json({
    erro: 'erro_interno',
    mensagem: 'Algo quebrou aqui dentro. Tente de novo.',
  });
}
