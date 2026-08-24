/**
 * Os esquemas que a plataforma publica no contrato.
 *
 * Cada nome aqui vira um tipo em `packages/contrato` que o front IMPORTA.
 * O front não redeclara nenhum deles (R6 · D-03) — o gate de contrato reprova
 * quem redeclarar.
 *
 * Módulos de domínio registram os seus próprios esquemas nos seus arquivos;
 * aqui ficam só os da fundação.
 */
import { z } from 'zod';

import { registrarEsquema } from './registro';

export const EsquemaErro = registrarEsquema(
  'Erro',
  z.object({
    erro: z.string().meta({ description: 'Código estável do erro, legível por máquina.' }),
    mensagem: z.string().meta({ description: 'Texto para a pessoa.' }),
  }),
);

export const EsquemaSaude = registrarEsquema(
  'Saude',
  z.object({
    estado: z.enum(['ok', 'degradado']),
    banco: z.enum(['ok', 'indisponivel']),
    versao: z.string(),
  }),
);

export const EsquemaCredenciais = registrarEsquema(
  'Credenciais',
  z.object({
    email: z.string().min(3),
    senha: z.string().min(1),
  }),
);

export const EsquemaMembroDaFamilia = registrarEsquema(
  'MembroDaFamilia',
  z.object({
    id: z.string(),
    nome: z.string(),
    email: z.string(),
  }),
);

/**
 * A sessão como o front a enxerga. Note o que NÃO está aqui: nada que permita
 * ao cliente escolher família. O `familiaId` é informativo — o servidor o lê do
 * token, não deste objeto.
 */
export const EsquemaSessaoAtual = registrarEsquema(
  'SessaoAtual',
  z.object({
    membroId: z.string(),
    membroNome: z.string(),
    membroEmail: z.string(),
    familiaId: z.string(),
    familiaNome: z.string(),
  }),
);

export const EsquemaFamiliaAtual = registrarEsquema(
  'FamiliaAtual',
  z.object({
    id: z.string(),
    nome: z.string(),
    membros: z.array(EsquemaMembroDaFamilia),
  }),
);

/**
 * O QUE O SOCKET TRANSPORTA — e o que ele deliberadamente NÃO transporta.
 *
 * O servidor emite INVALIDAÇÃO, nunca estado derivado (R3 · D-04). Quem recebe
 * refaz a leitura pela API: não aplica diff, não patcheia estado local, não
 * recalcula nada.
 *
 * A tentação de mandar o estado novo aqui é grande e está descartada com
 * convicção: para aplicar um diff útil o cliente precisaria conhecer a fórmula
 * do lastro — ou seja, reimplementar no front a regra que DEFINE o produto.
 */
export const EsquemaInvalidacao = registrarEsquema(
  'Invalidacao',
  z.object({
    recurso: z
      .string()
      .meta({ description: 'Que família de leitura ficou velha. Ex.: "lancamentos".' }),
    competencia: z
      .string()
      .nullable()
      .meta({ description: 'Competência afetada, AAAA-MM. Nulo quando não é mensal.' }),
    origemClienteId: z
      .string()
      .nullable()
      .meta({
        description:
          'Quem provocou a mudança. O cliente descarta o próprio eco (R5).',
      }),
  }),
);

export type Invalidacao = z.infer<typeof EsquemaInvalidacao>;
export type ContextoSessaoPublico = z.infer<typeof EsquemaSessaoAtual>;
