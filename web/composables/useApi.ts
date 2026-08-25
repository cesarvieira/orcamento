/**
 * O cliente da API.
 *
 * Dois detalhes que existem por causa do SSR (D-01):
 *
 * 1. **Duas bases.** O NAVEGADOR alcança a API por uma URL pública; o servidor
 *    Nuxt, de dentro da rede do compose, alcança por outra. Usar a pública no
 *    SSR faz o render do servidor tentar sair e voltar pela internet.
 *
 * 2. **O cookie precisa ser reencaminhado.** A sessão vive em cookie
 *    `httpOnly`: no navegador ele vai sozinho (`credentials: 'include'`), mas
 *    no SSR quem tem o cookie é a requisição que chegou ao Nuxt, e ele só
 *    chega à API se formos nós a repassá-lo.
 */
export function useApi() {
  const config = useRuntimeConfig();

  const base = import.meta.server
    ? (config.apiBaseInterna as string)
    : (config.public.apiBase as string);

  const cabecalhosDoSsr = import.meta.server ? useRequestHeaders(['cookie']) : {};

  return $fetch.create({
    baseURL: base,
    credentials: 'include',
    headers: cabecalhosDoSsr as Record<string, string>,
  });
}

/** A URL pública da API — é por ela que o socket conecta, no navegador. */
export function useApiBasePublica(): string {
  return useRuntimeConfig().public.apiBase as string;
}
