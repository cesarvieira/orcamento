/**
 * A montagem do app HTTP. A ORDEM dos middlewares é regra, não estilo:
 *
 *   1. cors          — precisa vir antes de qualquer resposta
 *   2. json/cookie   — o corpo e o cookie precisam existir para o passo 3
 *   3. tenant        — descarta `familiaId` do cliente e monta o contexto
 *                      a partir do token, ANTES de qualquer handler (R1)
 *   4. rotas
 *   5. 404 e erro
 *
 * Inverter 3 e 4 é o bug: um handler que rode antes do tenant enxerga o
 * `familiaId` que o cliente mandou.
 */
import cookieParser from 'cookie-parser';
import cors from 'cors';
import type { Express } from 'express';
import express from 'express';

import { ambiente } from './config/ambiente';
import { tratarErro, tratarNaoEncontrado } from './http/middleware/erro';
import { registrarAcesso } from './http/middleware/registro-de-acesso';
import {
  carregarSessao,
  descartarTenantDoCliente,
} from './http/middleware/tenant';
import { rotasDeSaude } from './http/rotas/saude';
import { rotasDeFamilia } from './modulos/familia/rotas';
import { construirDocumento } from './openapi/registro';
import './openapi/esquemas';

export function criarApp(): Express {
  const app = express();

  app.disable('x-powered-by');

  // Primeiro de todos: a linha só sai no `finish`, então ele enxerga inclusive
  // o que morre no CORS ou cai no 404 — que é justamente o que a pessoa quer
  // ver quando está caçando "por que o front não recebeu nada".
  app.use(registrarAcesso);

  app.use(
    cors({
      origin: ambiente.ORIGEM_WEB,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());

  app.use(descartarTenantDoCliente);
  app.use(carregarSessao);

  // O contrato vivo. É este endpoint que `OPENAPI_URL` aponta e que o gate de
  // contrato consulta — o documento servido é o MESMO que gera
  // `packages/contrato`, montado do mesmo registro.
  app.get('/openapi.json', (_req, res) => {
    res.json(construirDocumento());
  });

  app.use(rotasDeSaude);
  app.use(rotasDeFamilia);

  app.use(tratarNaoEncontrado);
  app.use(tratarErro);

  return app;
}
