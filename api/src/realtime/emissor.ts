/**
 * O EMISSOR CENTRAL DE INVALIDAÇÃO.
 *
 * REGRA R3 (D-04): o servidor emite invalidação, NUNCA estado derivado.
 *
 * Existe uma função só, de propósito. Cada módulo passa a ter uma
 * responsabilidade a mais — emitir a invalidação do que altera — e todos a
 * cumprem por aqui. Um emissor por módulo viraria, em pouco tempo, um módulo
 * mandando payload e outro mandando id.
 *
 * O que NÃO entra no evento: saldo, disponível, lastro, bloqueado, total. Se
 * você está prestes a acrescentar um número aqui, o que você quer é que o
 * cliente refaça a leitura — que é exatamente o que ele já faz ao receber isto.
 */
import type { Invalidacao } from '../openapi/esquemas';
import {
  EVENTO_INVALIDACAO,
  salaDaFamilia,
  servidorDeTempoReal,
} from './servidor';

export interface PedidoDeInvalidacao {
  /** A família dona do dado. Vem do token da requisição, nunca do corpo (R1). */
  familiaId: string;
  /** Que família de leitura ficou velha. Ex.: `lancamentos`, `contas`. */
  recurso: string;
  /** A competência afetada (`AAAA-MM`), quando o recurso é mensal. */
  competencia?: string | null;
  /** Quem provocou a mudança — o cliente descarta o próprio eco (R5). */
  origemClienteId?: string | null;
}

export function emitirInvalidacao(pedido: PedidoDeInvalidacao): void {
  const evento: Invalidacao = {
    recurso: pedido.recurso,
    competencia: pedido.competencia ?? null,
    origemClienteId: pedido.origemClienteId ?? null,
  };

  servidorDeTempoReal()
    .to(salaDaFamilia(pedido.familiaId))
    .emit(EVENTO_INVALIDACAO, evento);
}

/**
 * O cabeçalho pelo qual o cliente se identifica ao mutar. Vai junto na
 * invalidação para que quem agiu descarte o próprio eco: ele já recebeu o
 * estado recomputado na resposta HTTP e não precisa refazer a leitura.
 */
export const CABECALHO_ORIGEM_CLIENTE = 'x-origem-cliente';
