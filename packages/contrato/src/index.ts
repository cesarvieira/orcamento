/**
 * ⚠️ ARQUIVO GERADO — NÃO EDITE.
 *
 * Sai de `packages/contrato/gerar.mjs`, a partir do OpenAPI que a API publica.
 * Editar aqui é criar a segunda declaração do modelo — exatamente o que o
 * contrato gerado existe para impedir (D-03). Mude o Zod da API e regenere:
 *
 *   pnpm run contrato:gerar
 */

import type { components, operations, paths } from './gerado/api';

export type { components, operations, paths };

/** Todo valor monetário nestes tipos é INTEIRO EM CENTAVOS (D-06). */
export type AceitarConvite = components['schemas']['AceitarConvite'];
export type ConviteCriado = components['schemas']['ConviteCriado'];
export type ConvitePendente = components['schemas']['ConvitePendente'];
export type ConvitesPendentes = components['schemas']['ConvitesPendentes'];
export type Credenciais = components['schemas']['Credenciais'];
export type CriarConvite = components['schemas']['CriarConvite'];
export type Erro = components['schemas']['Erro'];
export type FamiliaAtual = components['schemas']['FamiliaAtual'];
export type Invalidacao = components['schemas']['Invalidacao'];
export type LoginGoogle = components['schemas']['LoginGoogle'];
export type MembroDaFamilia = components['schemas']['MembroDaFamilia'];
export type Saude = components['schemas']['Saude'];
export type SessaoAtual = components['schemas']['SessaoAtual'];
