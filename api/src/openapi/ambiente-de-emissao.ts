/**
 * Preenche o mínimo de ambiente para EMITIR o contrato sem banco.
 *
 * Por que existe: importar as rotas é o que popula o registro, e as rotas
 * importam a conexão — que exige `DATABASE_URL`. Nenhuma conexão é ABERTA
 * (o `Pool` do pg só disca na primeira consulta), mas a variável precisa
 * existir para a validação de ambiente passar.
 *
 * O valor é falso de propósito e nunca é usado: se alguém conseguir consultar
 * com ele, o problema é outro.
 *
 * ⚠️ Este módulo tem de ser o PRIMEIRO import de `emitir.ts` — em CommonJS a
 * ordem dos `require` segue a ordem dos `import`, e o efeito colateral precisa
 * acontecer antes de `config/ambiente` ser avaliado.
 */
process.env.DATABASE_URL ??= 'postgres://localhost:5432/contrato-sem-banco';
export {};
