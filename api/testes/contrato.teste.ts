/**
 * O contrato — as invariantes que o gate cobra, provadas antes de o gate rodar.
 *
 * O gate `contrato` precisa da API no ar para verificar. Estes testes verificam
 * o mesmo documento offline: quando quebra, quebra aqui, com nome de teste, em
 * vez de num curl no fim da fila.
 */
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

import { abrirApp } from './apoio';
import { fecharBanco } from '../src/db';

const app = abrirApp();

afterAll(async () => {
  await fecharBanco();
});

interface Documento {
  components: { schemas: Record<string, Record<string, unknown>> };
  paths: Record<string, Record<string, unknown>>;
}

async function documento(): Promise<Documento> {
  const resposta = await request(app).get('/openapi.json');
  expect(resposta.status).toBe(200);
  return resposta.body as Documento;
}

/** Percorre o esquema e o de dentro das suas propriedades. */
function percorrer(
  nome: string,
  esquema: Record<string, unknown>,
  visitar: (nome: string, esquema: Record<string, unknown>) => void,
): void {
  visitar(nome, esquema);
  const propriedades = esquema.properties as Record<string, Record<string, unknown>> | undefined;
  for (const [chave, filho] of Object.entries(propriedades ?? {})) {
    if (filho && typeof filho === 'object') percorrer(`${nome}.${chave}`, filho, visitar);
  }
}

describe('contrato OpenAPI', () => {
  it('a API publica o documento em /openapi.json', async () => {
    const doc = await documento();
    expect(Object.keys(doc.paths).length).toBeGreaterThan(0);
    expect(Object.keys(doc.components.schemas).length).toBeGreaterThan(0);
  });

  it('nenhum enum sai INTEIRO — enum numérico vira número na tela', async () => {
    const doc = await documento();
    const ruins: string[] = [];

    for (const [nome, esquema] of Object.entries(doc.components.schemas)) {
      percorrer(nome, esquema, (caminho, s) => {
        if ('enum' in s && (s.type === 'integer' || s.type === 'number')) {
          ruins.push(caminho);
        }
      });
    }

    expect(ruins).toEqual([]);
  });

  it('as rotas da família exigem o cookie de sessão no contrato', async () => {
    const doc = await documento();
    const familia = doc.paths['/familia'] as { get: { security: unknown[] } };
    expect(familia.get.security).toEqual([{ cookieDeSessao: [] }]);
  });

  it('o evento de invalidação NÃO declara nenhum campo de estado derivado', async () => {
    const doc = await documento();
    const invalidacao = doc.components.schemas.Invalidacao as {
      properties: Record<string, unknown>;
    };

    expect(Object.keys(invalidacao.properties).sort()).toEqual([
      'competencia',
      'origemClienteId',
      'recurso',
    ]);
  });

  it('nenhum esquema publica `familiaId` como ENTRADA de uma mutação', async () => {
    // O cliente nunca escolhe família. Se um corpo de requisição passar a
    // aceitar `familiaId`, o contrato vira convite ao vazamento — e este teste
    // é onde isso aparece.
    const doc = await documento();
    const corpos = new Set<string>();

    for (const caminho of Object.values(doc.paths)) {
      for (const operacao of Object.values(caminho)) {
        const corpo = (operacao as { requestBody?: { content: Record<string, { schema: { $ref?: string } }> } })
          .requestBody;
        const ref = corpo?.content?.['application/json']?.schema?.$ref;
        if (ref) corpos.add(ref.split('/').pop() as string);
      }
    }

    for (const nome of corpos) {
      const esquema = doc.components.schemas[nome] as { properties?: Record<string, unknown> };
      expect(Object.keys(esquema.properties ?? {})).not.toContain('familiaId');
    }
  });
});
