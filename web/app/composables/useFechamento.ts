import type { FechamentoMes, ResumoFechamento } from '@orcamento/contrato';

const CABECALHO_ORIGEM_CLIENTE = 'x-origem-cliente';

export function useFechamento() {
  const api = useApi();
  const origemClienteId = useOrigemClienteId();

  const cabecalhoDeOrigem = { [CABECALHO_ORIGEM_CLIENTE]: origemClienteId };

  async function lerResumoFechamento(competencia: string): Promise<ResumoFechamento> {
    return api<ResumoFechamento>(`/competencias/${competencia}/fechamento`);
  }

  async function fecharCompetencia(competencia: string): Promise<FechamentoMes> {
    return api<FechamentoMes>(`/competencias/${competencia}/fechar`, {
      method: 'POST',
      headers: cabecalhoDeOrigem,
    });
  }

  return {
    lerResumoFechamento,
    fecharCompetencia,
  };
}
