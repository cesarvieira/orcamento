/**
 * O processo da API.
 *
 * Um servidor HTTP só: o Socket.IO monta em cima dele, na MESMA porta, no path
 * `/realtime` (D-04). Por isso não há variável de ambiente nova para o tempo
 * real — `API_BASE` já descreve o endpoint.
 */
import { createServer } from 'node:http';

import { criarApp } from './app';
import { ambiente } from './config/ambiente';
import { fecharBanco } from './db';
import { criarServidorDeTempoReal, fecharTempoReal } from './realtime/servidor';

const app = criarApp();
const http = createServer(app);

criarServidorDeTempoReal(http);

http.listen(ambiente.API_PORT, () => {
  console.log(`[api] ouvindo em :${ambiente.API_PORT} · realtime em /realtime`);
});

async function encerrar(sinal: string): Promise<void> {
  console.log(`[api] ${sinal} — encerrando`);
  await fecharTempoReal().catch(() => undefined);
  http.close();
  await fecharBanco().catch(() => undefined);
  process.exit(0);
}

process.on('SIGTERM', () => void encerrar('SIGTERM'));
process.on('SIGINT', () => void encerrar('SIGINT'));
