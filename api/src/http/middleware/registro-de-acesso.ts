/**
 * O LOG DE ACESSO — só em desenvolvimento.
 *
 * Em produção o processo fica quieto de propósito (log estruturado é outra
 * decisão, ainda não tomada); na suíte, barulho por requisição afogaria a
 * saída dos testes. Aqui o alvo é o loop local: saber o que o front pediu,
 * o que a API respondeu, quanto demorou e QUEM era — sem abrir o DevTools.
 *
 * A linha sai DEPOIS da resposta (`res.on('finish')`), porque status e
 * duração só existem no fim. Cada requisição vira uma linha só:
 *
 *   [http] POST /convites 201 · 23ms · ana@exemplo.test @ Família de teste
 *   [http] GET  /sessoes/atual 401 · 2ms · anônimo
 */
import type { NextFunction, Request, Response } from 'express';

import { ambiente } from '../../config/ambiente';

/** Faixas de status ganham cor para o erro saltar aos olhos no terminal. */
function colorir(status: number): string {
  const texto = String(status);
  if (!process.stdout.isTTY) return texto;
  if (status >= 500) return `[31m${texto}[0m`; // vermelho
  if (status >= 400) return `[33m${texto}[0m`; // amarelo
  if (status >= 300) return `[36m${texto}[0m`; // ciano
  return `[32m${texto}[0m`; // verde
}

/**
 * Quem fez a requisição, segundo o CONTEXTO (nunca segundo o cliente — o
 * middleware de tenant já resolveu isso a partir do cookie).
 */
function quem(req: Request): string {
  const contexto = req.contexto;
  if (!contexto) return 'anônimo';
  return `${contexto.membroEmail} @ ${contexto.familiaNome}`;
}

export function registrarAcesso(
  req: Request,
  res: Response,
  proximo: NextFunction,
): void {
  if (ambiente.NODE_ENV !== 'development') {
    proximo();
    return;
  }

  const inicio = process.hrtime.bigint();

  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - inicio) / 1_000_000;
    const metodo = req.method.padEnd(6);
    const rota = req.originalUrl;

    // eslint-disable-next-line no-console
    console.log(
      `[http] ${metodo}${rota} ${colorir(res.statusCode)} · ${ms.toFixed(1)}ms · ${quem(req)}`,
    );
  });

  proximo();
}
