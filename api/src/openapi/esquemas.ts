/**
 * Os esquemas que a plataforma publica no contrato.
 *
 * Cada nome aqui vira um tipo em `packages/contrato` que o front IMPORTA.
 * O front não redeclara nenhum deles (R6 · D-03) — o gate de contrato reprova
 * quem redeclarar.
 *
 * Módulos de domínio registram os seus próprios esquemas nos seus arquivos;
 * aqui ficam só os da fundação.
 *
 * Os exports abaixo marcados `@fundacao` (exceto `EsquemaCredenciais`, já
 * consumido em `rotas.ts`) só são usados aqui dentro, no registro — o valor
 * deles é o `.meta()`/`registrarEsquema()` que roda ao importar o módulo,
 * publicando a forma no OpenAPI. Um handler futuro que precise validar contra
 * um desses tipos importa daqui em vez de redeclarar.
 */
import { z } from 'zod';

import { registrarEsquema } from './registro';

/** @fundacao */
export const EsquemaErro = registrarEsquema(
  'Erro',
  z.object({
    erro: z.string().meta({ description: 'Código estável do erro, legível por máquina.' }),
    mensagem: z.string().meta({ description: 'Texto para a pessoa.' }),
  }),
);

/** @fundacao */
export const EsquemaSaude = registrarEsquema(
  'Saude',
  z.object({
    estado: z.enum(['ok', 'degradado']),
    banco: z.enum(['ok', 'indisponivel']),
    versao: z.string(),
  }),
);

/**
 * O que a porta de teste do Sentry devolve (D-08). Publicado no contrato como
 * qualquer outra rota — rota que não se registra não existe.
 *
 * @fundacao
 */
export const EsquemaDiagnosticoSentry = registrarEsquema(
  'DiagnosticoSentry',
  z.object({
    ligado: z
      .boolean()
      .meta({ description: 'O SDK inicializou? `false` quando SENTRY_DSN está vazio.' }),
    ambiente: z.string().meta({ description: 'O ambiente com que o evento chega à instância.' }),
    eventId: z
      .string()
      .nullable()
      .meta({ description: 'O id do evento enviado — `null` quando o SDK está inerte.' }),
  }),
);

export const EsquemaCredenciais = registrarEsquema(
  'Credenciais',
  z.object({
    email: z.string().min(3),
    senha: z.string().min(1),
  }),
);

/** @fundacao */
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
 *
 * @fundacao
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

/** @fundacao */
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
 *
 * @fundacao
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

/** @fundacao */
export type ContextoSessaoPublico = z.infer<typeof EsquemaSessaoAtual>;
