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

/**
 * A string de conexão SEM a senha. Ela é útil no log (qual banco? qual host?
 * qual porta? — as três perguntas de todo "por que não conecta") e a senha
 * não é: log vai para arquivo, terminal compartilhado e captura de tela.
 */
function bancoSemSegredo(url: string): string {
  try {
    const u = new URL(url);
    const credencial = u.username ? `${u.username}:***@` : '';
    return `${u.protocol}//${credencial}${u.host}${u.pathname}`;
  } catch {
    return '<DATABASE_URL não é uma URL válida>';
  }
}

/**
 * O que está de pé, e com que configuração. Só em desenvolvimento: em
 * produção isto seria ruído em toda subida de container, e a suíte de teste
 * ficaria ilegível.
 *
 * O ponto é responder de cara as perguntas que a gente sempre faz na segunda
 * vez que algo não funciona: em que porta? contra qual banco? o CORS aponta
 * pro front certo? o email vai sair de verdade? o Google está ligado?
 */
function banner(): void {
  const linhas = [
    `ambiente      ${ambiente.NODE_ENV}`,
    `http          http://localhost:${ambiente.API_PORT}`,
    `realtime      ws://localhost:${ambiente.API_PORT}/realtime`,
    `contrato      http://localhost:${ambiente.API_PORT}/openapi.json`,
    `banco         ${bancoSemSegredo(ambiente.DATABASE_URL)}`,
    `cors          ${ambiente.ORIGEM_WEB}`,
    `sessão        cookie httpOnly · expira em ${ambiente.SESSAO_TTL_HORAS}h`,
    `email         driver=${ambiente.MAIL_DRIVER}${
      ambiente.MAIL_DRIVER === 'log'
        ? ' (não envia de verdade — o convite sai aqui no log)'
        : ` · de=${ambiente.MAIL_FROM || '<MAIL_FROM vazio>'}`
    }`,
    `convite       expira em ${ambiente.CONVITE_TTL_HORAS}h`,
    `google        ${
      ambiente.GOOGLE_CLIENT_ID
        ? 'ligado'
        : 'desligado (GOOGLE_CLIENT_ID vazio — o botão fica inerte no front)'
    }`,
  ];

  console.log(`[api] pronto\n${linhas.map(l => `      ${l}`).join('\n')}`);
}

http.listen(ambiente.API_PORT, () => {
  if (ambiente.NODE_ENV === 'development') {
    banner();
    return;
  }
  console.log(`[api] ouvindo em :${ambiente.API_PORT} · realtime em /realtime`);
});

async function encerrar(sinal: string): Promise<void> {
  console.log(`[api] ${sinal} — encerrando`);
  try {
    await fecharTempoReal();
  } catch {
    // encerrando de qualquer forma
  }
  http.close();
  try {
    await fecharBanco();
  } catch {
    // encerrando de qualquer forma
  }
  process.exit(0);
}

process.on('SIGTERM', () => void encerrar('SIGTERM'));
process.on('SIGINT', () => void encerrar('SIGINT'));
