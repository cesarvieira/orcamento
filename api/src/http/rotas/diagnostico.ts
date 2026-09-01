/**
 * `GET /diagnostico/sentry` — a porta que responde, a qualquer momento, à
 * pergunta que só se costuma fazer tarde demais: **a captura de erro está
 * mesmo chegando na instância?** (D-08)
 *
 * Ela existe porque integração de observabilidade tem uma falha de modo
 * silencioso: parece instalada, e no dia do incidente não chega evento nenhum.
 * Um teste automatizado prova o código daqui; o que apodrece em silêncio é o
 * caminho até a instância — DNS, TLS, certificado próprio, quota, rede do
 * compose. Isso só se prova mandando um evento de verdade.
 *
 * ⚠️ Desligada por padrão, inclusive em produção: `?modo=erro` estoura de
 * propósito, e rota assim aberta é ruído e convite a abuso. Com
 * `SENTRY_TESTE_HABILITADO=false` ela devolve o MESMO 404 de qualquer caminho
 * inexistente — nem revela que existe.
 */
import type { Router as RouterType } from 'express';
import { Router } from 'express';

import { ambiente } from '../../config/ambiente';
import {
  Sentry,
  ambienteDoSentry,
  sentryLigado,
} from '../../instrumentacao';
import { registrarRota } from '../../openapi/registro';
import { tratarNaoEncontrado } from '../middleware/erro';

export const rotasDeDiagnostico: RouterType = Router();

/**
 * O erro que a porta `?modo=erro` levanta. Uma classe própria, e não um `Error`
 * qualquer, para que ele seja reconhecível na instância: o agrupamento do
 * Sentry usa o nome do tipo, e um teste proposital misturado com os erros de
 * verdade é exatamente o que ninguém quer no dia do incidente.
 */
export class ErroDeTesteDoSentry extends Error {
  constructor() {
    super('Erro proposital da porta de diagnóstico — se você o está vendo, a captura funciona.');
    this.name = 'ErroDeTesteDoSentry';
  }
}

registrarRota({
  metodo: 'get',
  caminho: '/diagnostico/sentry',
  resumo: 'Prova a integração com o Sentry mandando um evento de verdade',
  etiquetas: ['plataforma'],
  exigeSessao: false,
  query: [
    {
      nome: 'modo',
      descricao:
        '`evento` (default) manda uma mensagem; `erro` estoura de propósito e prova o caminho do erro não tratado.',
      esquema: { type: 'string', enum: ['evento', 'erro'] },
    },
  ],
  respostas: [
    {
      status: 200,
      descricao: 'O evento foi entregue ao SDK; `eventId` é o que procurar na instância',
      esquema: 'DiagnosticoSentry',
    },
    {
      status: 404,
      descricao: 'A porta de teste está desligada (SENTRY_TESTE_HABILITADO=false)',
      esquema: 'Erro',
    },
    {
      status: 500,
      descricao: '`modo=erro` — a resposta esperada, e o evento correspondente na instância',
      esquema: 'Erro',
    },
  ],
});

rotasDeDiagnostico.get('/diagnostico/sentry', (req, res) => {
  if (!ambiente.SENTRY_TESTE_HABILITADO) {
    tratarNaoEncontrado(req, res);
    return;
  }

  // Estourar de VERDADE, sem `next(erro)`: o que se quer provar é o caminho de
  // um erro que ninguém tratou — o mesmo que um bug percorre. O Express 5
  // encaminha o throw síncrono ao middleware de erro, onde a captura do Sentry
  // e o `tratarErro` esperam, nessa ordem.
  if (req.query.modo === 'erro') {
    throw new ErroDeTesteDoSentry();
  }

  const eventId = sentryLigado()
    ? (Sentry.captureMessage(
        'Evento de teste da porta /diagnostico/sentry — a integração está viva.',
        'info',
      ) ?? null)
    : null;

  res.json({
    ligado: sentryLigado(),
    ambiente: ambienteDoSentry(),
    eventId,
  });
});
