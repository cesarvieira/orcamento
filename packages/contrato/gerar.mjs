/**
 * O passo de geração do contrato.
 *
 *   api (zod → OpenAPI)  →  packages/contrato (GERADO)  →  web (importa)
 *
 * Duas saídas, ambas descartáveis e regeneráveis:
 *
 *   src/gerado/api.ts  — a tradução crua do OpenAPI (openapi-typescript)
 *   src/index.ts       — os apelidos por nome de esquema, para o front escrever
 *                        `import type { SessaoAtual } from '@orcamento/contrato'`
 *                        em vez de cavar dentro de `components['schemas'][...]`
 *
 * O índice também é gerado de propósito: esquema novo na API aparece no front
 * sem ninguém lembrar de exportá-lo à mão. Nada aqui se edita — quem quer mudar
 * o contrato muda o Zod da API e roda `npm run contrato:gerar`.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import openapiTS, { astToString } from 'openapi-typescript';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const origem = path.join(aqui, 'openapi.json');
const destinoApi = path.join(aqui, 'src', 'gerado', 'api.ts');
const destinoIndice = path.join(aqui, 'src', 'index.ts');

const AVISO = `/**
 * ⚠️ ARQUIVO GERADO — NÃO EDITE.
 *
 * Sai de \`packages/contrato/gerar.mjs\`, a partir do OpenAPI que a API publica.
 * Editar aqui é criar a segunda declaração do modelo — exatamente o que o
 * contrato gerado existe para impedir (D-03). Mude o Zod da API e regenere:
 *
 *   npm run contrato:gerar
 */
`;

const documento = JSON.parse(await readFile(origem, 'utf8'));

// ── 1. a tradução crua ──────────────────────────────────────────────────────
const ast = await openapiTS(new URL(`file://${origem.replace(/\\/g, '/')}`));
await mkdir(path.dirname(destinoApi), { recursive: true });
await writeFile(destinoApi, `${AVISO}\n${astToString(ast)}`, 'utf8');

// ── 2. os apelidos por nome de esquema ──────────────────────────────────────
const nomes = Object.keys(documento.components?.schemas ?? {}).sort();

const linhas = [
  AVISO,
  "import type { components, operations, paths } from './gerado/api';",
  '',
  'export type { components, operations, paths };',
  '',
  '/** Todo valor monetário nestes tipos é INTEIRO EM CENTAVOS (D-06). */',
  ...nomes.map((n) => `export type ${n} = components['schemas']['${n}'];`),
  '',
];

await writeFile(destinoIndice, `${linhas.join('\n')}`, 'utf8');

console.log(
  `[contrato] ${nomes.length} esquema(s) e ${Object.keys(documento.paths ?? {}).length} caminho(s) gerados`,
);
