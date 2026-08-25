import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['testes/**/*.teste.ts'],
    globalSetup: ['./testes/preparar-banco.ts'],
    // Os testes compartilham UM banco. Rodar arquivos em paralelo faria um
    // truncar a tabela que o outro acabou de povoar — e o resultado seria uma
    // suíte que falha de vez em quando, que é pior que uma que falha sempre.
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
