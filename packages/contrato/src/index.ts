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
export type AtualizarCategoria = components['schemas']['AtualizarCategoria'];
export type AtualizarConta = components['schemas']['AtualizarConta'];
export type AtualizarMeta = components['schemas']['AtualizarMeta'];
export type Categoria = components['schemas']['Categoria'];
export type CategoriaEstourada = components['schemas']['CategoriaEstourada'];
export type CategoriaNaCompetencia = components['schemas']['CategoriaNaCompetencia'];
export type CategoriasListadas = components['schemas']['CategoriasListadas'];
export type CompetenciaLida = components['schemas']['CompetenciaLida'];
export type ConcluirRecuperacao = components['schemas']['ConcluirRecuperacao'];
export type ConfirmarConta = components['schemas']['ConfirmarConta'];
export type Conta = components['schemas']['Conta'];
export type ContaCriada = components['schemas']['ContaCriada'];
export type ContasListadas = components['schemas']['ContasListadas'];
export type ConviteCriado = components['schemas']['ConviteCriado'];
export type ConvitePendente = components['schemas']['ConvitePendente'];
export type ConvitesPendentes = components['schemas']['ConvitesPendentes'];
export type Credenciais = components['schemas']['Credenciais'];
export type CriarConta = components['schemas']['CriarConta'];
export type CriarConvite = components['schemas']['CriarConvite'];
export type DefinirRendaPrevista = components['schemas']['DefinirRendaPrevista'];
export type DefinirTeto = components['schemas']['DefinirTeto'];
export type Erro = components['schemas']['Erro'];
export type FamiliaAtual = components['schemas']['FamiliaAtual'];
export type Fatura = components['schemas']['Fatura'];
export type FaturasDoCartao = components['schemas']['FaturasDoCartao'];
export type FechamentoMes = components['schemas']['FechamentoMes'];
export type Guardar = components['schemas']['Guardar'];
export type Invalidacao = components['schemas']['Invalidacao'];
export type ItemDeFatura = components['schemas']['ItemDeFatura'];
export type Lancamento = components['schemas']['Lancamento'];
export type LancamentosListados = components['schemas']['LancamentosListados'];
export type LoginGoogle = components['schemas']['LoginGoogle'];
export type MembroDaFamilia = components['schemas']['MembroDaFamilia'];
export type Meta = components['schemas']['Meta'];
export type MetasListadas = components['schemas']['MetasListadas'];
export type ModoDeExclusao = components['schemas']['ModoDeExclusao'];
export type NovaCategoria = components['schemas']['NovaCategoria'];
export type NovaConta = components['schemas']['NovaConta'];
export type NovaMeta = components['schemas']['NovaMeta'];
export type NovoLancamento = components['schemas']['NovoLancamento'];
export type NovoRemanejamento = components['schemas']['NovoRemanejamento'];
export type OrcamentoMesLido = components['schemas']['OrcamentoMesLido'];
export type PagarFatura = components['schemas']['PagarFatura'];
export type PedirRecuperacao = components['schemas']['PedirRecuperacao'];
export type RecuperacaoPedida = components['schemas']['RecuperacaoPedida'];
export type RecusarConvite = components['schemas']['RecusarConvite'];
export type Remanejamento = components['schemas']['Remanejamento'];
export type ResumoFechamento = components['schemas']['ResumoFechamento'];
export type Saude = components['schemas']['Saude'];
export type SessaoAtual = components['schemas']['SessaoAtual'];
