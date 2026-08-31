/**
 * A ORQUESTRAÇÃO DE LEITURA do extrato (EF-04) — extraída de `extrato.vue`
 * pela tarefa #105 (história #63) só para ficar testável sem montar a SFC
 * inteira: este projeto não tem test-utils/jsdom para Vue (ver
 * `useExtratoLeitura.teste.ts`), mas `ref`/`computed` do Vue rodam em Node
 * puro — dependência já existente, nenhuma nova entrou por causa disto.
 *
 * ⛔ CORRIGE A CORRIDA da tarefa #105: até aqui, `verificarSeFamiliaTemHistorico()`
 * não carregava o carimbo `minhaOrdem` que já protegia o resto de `carregar()`
 * (o mesmo padrão de `orcamento.vue`). Uma segunda `carregar()` disparada
 * enquanto a primeira ainda esperava essa leitura extra podia deixar o
 * resultado da chamada MAIS ANTIGA sobrescrever o que a chamada MAIS NOVA já
 * tinha decidido. Impacto medido: só a frase do vazio trocava (nunca um
 * número financeiro — regra inviolável #4 continua intacta), mas ainda era
 * uma corrida real. O conserto é a MESMA técnica das leituras vizinhas:
 * carimbar `minhaOrdem` e descartar se `leituraEmOrdem` já mudou.
 */
import { ref } from 'vue';
import type { Lancamento, LancamentosListados } from '@orcamento/contrato';
import { mensagemDoErro } from './useApi.ts';

/** O contrato gerado já tem esta forma (regra inviolável #4: não redeclarar o modelo do back). */
export type RespostaDeLancamentos = LancamentosListados;

export interface ParametrosDeLeitura {
  competencia?: string;
  contaId?: string;
}

export interface OpcoesLeituraDoExtrato {
  /** Em produção, `useLancamentos().listarLancamentos`; no teste, um dublê controlável. */
  listar: (params: ParametrosDeLeitura) => Promise<RespostaDeLancamentos>;
}

export function useExtratoLeitura(opcoes: OpcoesLeituraDoExtrato) {
  const lancamentos = ref<Lancamento[]>([]);
  const carregando = ref(true);
  const erro = ref<string | null>(null);
  /** Distingue o vazio "por filtro/mês" (tem fonte) do vazio "família nova" (não tem). */
  const familiaSemHistorico = ref(false);

  /** Só a leitura MAIS RECENTE grava a tela — mesmo padrão de `orcamento.vue`. */
  let leituraEmOrdem = 0;

  /**
   * Chamada só quando a leitura filtrada (competência + conta) veio vazia. Recebe
   * o `minhaOrdem` de QUEM a chamou (`carregar`) — é o mesmo carimbo, não um novo:
   * o guarda só funciona se toda leitura disparada por uma dada chamada de
   * `carregar()` comparar contra o MESMO número.
   */
  async function verificarSeFamiliaTemHistorico(minhaOrdem: number): Promise<void> {
    try {
      const resposta = await opcoes.listar({});
      if (minhaOrdem !== leituraEmOrdem) return; // #105: uma leitura mais nova já decidiu a tela
      familiaSemHistorico.value = resposta.lancamentos.length === 0;
    } catch {
      if (minhaOrdem !== leituraEmOrdem) return;
      // Na dúvida, mostra o vazio "por filtro" — tem fonte no desenho, o outro não.
      familiaSemHistorico.value = false;
    }
  }

  async function carregar(params: ParametrosDeLeitura): Promise<void> {
    const minhaOrdem = ++leituraEmOrdem;
    try {
      const resposta = await opcoes.listar(params);
      if (minhaOrdem !== leituraEmOrdem) return;

      lancamentos.value = resposta.lancamentos;
      erro.value = null;

      if (resposta.lancamentos.length === 0) {
        await verificarSeFamiliaTemHistorico(minhaOrdem);
      } else {
        familiaSemHistorico.value = false;
      }
    } catch (e) {
      if (minhaOrdem !== leituraEmOrdem) return;
      erro.value = mensagemDoErro(e, 'Não consegui carregar o extrato.');
    } finally {
      if (minhaOrdem === leituraEmOrdem) carregando.value = false;
    }
  }

  return { lancamentos, carregando, erro, familiaSemHistorico, carregar };
}
