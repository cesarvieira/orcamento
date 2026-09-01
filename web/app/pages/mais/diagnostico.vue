<script setup lang="ts">
/**
 * DIAGNÓSTICO — as portas de teste do Sentry no front (D-08).
 *
 * Existe porque integração de observabilidade tem uma falha de modo
 * silencioso: parece instalada, e no dia do incidente não chega evento nenhum.
 * Aqui se prova, a qualquer momento, os três caminhos que a CLI da API não
 * alcança — o SDK do navegador, o do SSR e o trajeto front → API.
 *
 * ⚠️ NÃO entra em `config/navegacao.ts`. Não é tela de produto: não tem lugar
 * na tab bar nem na sidebar, e chega-se a ela pela URL. Com
 * `NUXT_PUBLIC_SENTRY_TESTE_HABILITADO` desligado (o default, inclusive em
 * produção) ela devolve 404 — uma tela que quebra de propósito, aberta a
 * qualquer um, é ruído e convite a abuso.
 *
 * Continua atrás da sessão, como todo o resto do app (`middleware/sessao.global.ts`).
 */
import * as Sentry from '@sentry/nuxt';

const config = useRuntimeConfig();

if (!config.public.sentryTesteHabilitado) {
  throw createError({ statusCode: 404, statusMessage: 'Recurso inexistente.', fatal: true });
}

const route = useRoute();

/**
 * A porta do SSR. Estoura durante o render DO SERVIDOR — por isso se chega
 * nela por um link de verdade (recarregamento completo), e não por
 * `navigateTo`: navegação de cliente nunca passa pelo servidor, e o teste
 * provaria o SDK errado.
 */
if (import.meta.server && route.query.ssr === 'erro') {
  throw new Error('Erro proposital no SSR — se ele chegou ao Sentry, a captura do servidor funciona.');
}

const dsnConfigurado = Boolean(config.public.sentryDsn);
const ultimoEvento = ref<string | null>(null);
const respostaDaApi = ref<string | null>(null);
const erroDaApi = ref<string | null>(null);

const api = useApi();

/** Manda uma mensagem e mostra o `event_id` — é ele que se procura na instância. */
function mandarEvento() {
  ultimoEvento.value = Sentry.captureMessage(
    `Evento de teste da tela de diagnóstico — ${new Date().toISOString()}`,
    'info',
  );
}

/**
 * Estoura de verdade dentro de um handler do Vue. É o caminho de um bug real:
 * o tratador de erro do Vue captura e repassa ao SDK. Não devolve `event_id` —
 * ninguém tratou o erro, então não há a quem devolver; o evento aparece na
 * instância mesmo assim, que é justamente o que se quer provar.
 */
function quebrarNoNavegador() {
  throw new Error('Erro proposital no navegador — se ele chegou ao Sentry, a captura do cliente funciona.');
}

async function chamarApi(modo: 'evento' | 'erro') {
  respostaDaApi.value = null;
  erroDaApi.value = null;
  try {
    const resposta = await api(`/diagnostico/sentry?modo=${modo}`);
    respostaDaApi.value = JSON.stringify(resposta, null, 2);
  } catch (erro: unknown) {
    // Em `modo=erro` o 500 é o resultado ESPERADO: a API respondeu na forma
    // `Erro` do contrato e o evento saiu. Não é falha do teste.
    erroDaApi.value = mensagemDoErro(erro, 'A API não respondeu.');
  }
}
</script>

<template>
  <section class="diagnostico">
    <h2 class="diagnostico__titulo">Diagnóstico do Sentry</h2>
    <p class="diagnostico__sub">
      Cada botão manda um evento de verdade. Depois de clicar, procure o evento na sua instância.
    </p>

    <dl class="estado">
      <div class="estado__linha">
        <dt>DSN</dt>
        <dd :class="dsnConfigurado ? 'ok' : 'inerte'">
          {{ dsnConfigurado ? 'configurado' : 'vazio — o SDK está inerte e nada será enviado' }}
        </dd>
      </div>
      <div class="estado__linha">
        <dt>Ambiente</dt>
        <dd>{{ config.public.sentryAmbiente }}</dd>
      </div>
    </dl>

    <div class="grupo">
      <h3 class="grupo__titulo">Navegador</h3>
      <button type="button" class="botao" @click="mandarEvento">Mandar um evento</button>
      <button type="button" class="botao botao--perigo" @click="quebrarNoNavegador">
        Quebrar no navegador
      </button>
      <p v-if="ultimoEvento" class="saida">event_id = {{ ultimoEvento }}</p>
    </div>

    <div class="grupo">
      <h3 class="grupo__titulo">SSR</h3>
      <!-- Link de verdade, não `navigateTo`: só um carregamento completo passa
           pelo render do servidor. -->
      <a class="botao botao--perigo" href="/mais/diagnostico?ssr=erro">Quebrar no SSR</a>
    </div>

    <div class="grupo">
      <h3 class="grupo__titulo">API</h3>
      <button type="button" class="botao" @click="chamarApi('evento')">Mandar um evento pela API</button>
      <button type="button" class="botao botao--perigo" @click="chamarApi('erro')">
        Quebrar na API
      </button>
      <pre v-if="respostaDaApi" class="saida">{{ respostaDaApi }}</pre>
      <p v-if="erroDaApi" class="saida saida--erro">
        {{ erroDaApi }} — em "Quebrar na API", esta é a resposta esperada.
      </p>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.diagnostico {
  padding: 1.5rem;

  &__titulo {
    margin: 0 0 0.25rem;
    color: var(--texto);
  }

  &__sub {
    margin: 0 0 1.5rem;
    color: var(--texto-medio);
    font-size: 0.875rem;
  }
}

.estado {
  margin: 0 0 1.5rem;
  padding: 0.875rem 1rem;
  background: var(--superficie);
  border-radius: var(--raio);
  box-shadow: var(--sombra-carta);

  &__linha {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.25rem 0;
    font-size: 0.875rem;
  }

  dt {
    color: var(--texto-fraco);
  }

  dd {
    margin: 0;
    color: var(--texto);
    text-align: right;
  }

  .ok {
    color: var(--sucesso);
  }

  .inerte {
    color: var(--atencao);
  }
}

.grupo {
  margin-bottom: 1.5rem;

  &__titulo {
    margin: 0 0 0.5rem;
    color: var(--texto-medio);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .botao {
    margin: 0 0.5rem 0.5rem 0;
  }
}

.botao--perigo {
  background: var(--alerta);
  border-color: var(--alerta);
}

.saida {
  margin: 0.5rem 0 0;
  padding: 0.625rem 0.75rem;
  background: var(--superficie);
  border-radius: var(--raio-pequeno);
  color: var(--texto-medio);
  font-size: 0.8125rem;
  white-space: pre-wrap;
  word-break: break-all;

  &--erro {
    color: var(--alerta);
  }
}
</style>
