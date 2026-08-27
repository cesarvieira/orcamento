/**
 * O MÊS ATIVO DO APP — estado compartilhado, um só para todas as telas.
 *
 * Ele vive aqui, e não dentro de `useOrcamento`, porque não é da EF-03: a visão
 * do mês (EF-04) e o fechamento (EF-08) leem a MESMA competência. Duas telas com
 * dois meses ativos seria a segunda fonte da verdade que a regra inviolável #4
 * do produto proíbe — só que sobre o período, em vez de sobre o cálculo.
 *
 * `useState` é o mesmo mecanismo de `useSessao` e `useRealtime`: sobrevive à
 * navegação entre rotas e é seguro no SSR (cada requisição tem o seu).
 *
 * ⚠️ Ao carregar é SEMPRE o mês corrente. Não persiste em `localStorage` de
 * propósito: quem abre o app quer ver o mês em que está, não o último que
 * consultou há três semanas.
 */
import {
  competenciaAtual,
  deslocarCompetencia,
  partesDaCompetencia,
  rotuloDaCompetencia,
} from '~/utils/competencia';

export function useCompetencia() {
  const competencia = useState<string>('competencia-ativa', () => competenciaAtual());

  /** O rótulo humano do mês ativo — `Agosto 2026`. */
  const rotulo = computed(() => rotuloDaCompetencia(competencia.value));

  /** Se o mês ativo é o corrente. Falso significa que a pessoa navegou para longe. */
  const ehMesCorrente = computed(() => competencia.value === competenciaAtual());

  /** O ano do mês ativo — a folha de seleção começa nele. */
  const ano = computed(() => partesDaCompetencia(competencia.value).ano);

  function ir(alvo: string): void {
    competencia.value = alvo;
  }
  function anterior(): void {
    competencia.value = deslocarCompetencia(competencia.value, -1);
  }
  function seguinte(): void {
    competencia.value = deslocarCompetencia(competencia.value, 1);
  }
  function voltarParaCorrente(): void {
    competencia.value = competenciaAtual();
  }

  return { competencia, rotulo, ehMesCorrente, ano, ir, anterior, seguinte, voltarParaCorrente };
}
