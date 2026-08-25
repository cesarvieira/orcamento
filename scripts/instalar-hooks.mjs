// `pnpm install` roda isto (script "prepare") para religar os git hooks do
// projeto a cada clone/instalação — sem depender de alguém lembrar de rodar
// `git config` na mão. Não usa husky de propósito: o hook de pre-commit que
// bloqueia segredo vazado já vive em `.githooks/` (instalado por
// `preator/adocao/instalar.sh`), e husky reescreveria `core.hooksPath` para
// `.husky/`, desligando aquele gate em silêncio.
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync } from 'node:fs';

function raizDoGit() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

const raiz = raizDoGit();
if (!raiz) {
  // `pnpm install` também roda fora de um clone git (ex.: dentro da imagem
  // Docker de produção) — nesse caso não há o que religar.
  process.exit(0);
}

execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: raiz });

for (const hook of ['pre-commit', 'pre-push']) {
  const caminho = `${raiz}/.githooks/${hook}`;
  if (existsSync(caminho)) {
    chmodSync(caminho, 0o755);
  }
}

console.log('[hooks] core.hooksPath=.githooks — pre-commit e pre-push ligados.');
