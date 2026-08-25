/**
 * `GET /health` — o endpoint que o compose e o gate `deploy-fresh` consultam
 * para saber se a stack subiu. Ele toca o banco de propósito: uma API que
 * responde 200 sem conseguir consultar não subiu, subiu pela metade.
 */
import { sql } from 'drizzle-orm';
import type { Router as RouterType } from 'express';
import { Router } from 'express';

import { db } from '../../db';
import { registrarRota } from '../../openapi/registro';

export const rotasDeSaude: RouterType = Router();

registrarRota({
  metodo: 'get',
  caminho: '/health',
  resumo: 'Estado da API e do banco',
  etiquetas: ['plataforma'],
  exigeSessao: false,
  respostas: [
    { status: 200, descricao: 'A API responde e o banco está acessível', esquema: 'Saude' },
    { status: 503, descricao: 'A API responde mas o banco não', esquema: 'Saude' },
  ],
});

rotasDeSaude.get('/health', async (_req, res) => {
  let banco: 'ok' | 'indisponivel' = 'ok';
  try {
    await db.execute(sql`select 1`);
  } catch {
    banco = 'indisponivel';
  }

  res.status(banco === 'ok' ? 200 : 503).json({
    estado: banco === 'ok' ? 'ok' : 'degradado',
    banco,
    versao: process.env.npm_package_version ?? '0.0.0',
  });
});
