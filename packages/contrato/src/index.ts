/**
 * ⚠️ ARQUIVO GERADO — NÃO EDITE.
 *
 * Sai de `packages/contrato/gerar.mjs`, a partir do OpenAPI que a API publica.
 * Editar aqui é criar a segunda declaração do modelo — exatamente o que o
 * contrato gerado existe para impedir (D-03). Mude o Zod da API e regenere:
 *
 *   npm run contrato:gerar
 */

import type { components, operations, paths } from './gerado/api';

export type { components, operations, paths };

/** Todo valor monetário nestes tipos é INTEIRO EM CENTAVOS (D-06). */
export type Credenciais = components['schemas']['Credenciais'];
export type Erro = components['schemas']['Erro'];
export type FamiliaAtual = components['schemas']['FamiliaAtual'];
export type Invalidacao = components['schemas']['Invalidacao'];
export type MembroDaFamilia = components['schemas']['MembroDaFamilia'];
export type Saude = components['schemas']['Saude'];
export type SessaoAtual = components['schemas']['SessaoAtual'];
