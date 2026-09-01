/**
 * Escreve o documento OpenAPI em `packages/contrato/openapi.json`.
 *
 * Roda OFFLINE, sem subir a API: o passo de geração precisa acontecer antes do
 * typecheck do front (D-03), e fazer o build depender de um servidor no ar
 * seria trocar um passo determinístico por uma corrida.
 *
 * O mesmo documento é servido em `GET /openapi.json` pela API viva — é ele que
 * o gate de contrato consulta.
 */
// PRIMEIRO import, sempre: preenche o ambiente mínimo antes que
// `config/ambiente` seja avaliado pela cadeia de imports das rotas.
import './ambiente-de-emissao';

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { construirDocumento } from './registro';

// Importar as rotas é o que POPULA o registro. Sem estes imports o documento
// sai vazio e o front fica sem tipo — em silêncio.
import './esquemas';
import '../http/rotas/saude';
import '../modulos/familia/rotas';
import '../modulos/contas/rotas';
import '../modulos/orcamento/rotas';
import '../modulos/lancamentos/rotas';
import '../modulos/faturas/rotas';
import '../modulos/metas/rotas';
import '../modulos/fechamento/rotas';

const destino = path.resolve(__dirname, '..', '..', '..', 'packages', 'contrato', 'openapi.json');

const documento = construirDocumento();

mkdirSync(path.dirname(destino), { recursive: true });
writeFileSync(destino, `${JSON.stringify(documento, null, 2)}\n`, 'utf8');

const quantasRotas = Object.keys(documento.paths as object).length;
console.log(`[openapi] ${quantasRotas} caminho(s) escritos em ${destino}`);
