<script setup lang="ts">
/**
 * ENTRAR — visual atualizado do mockup (Claude Design, projeto
 * b7d13c37-0d57-4a92-9df6-c50357cb587d), com painel de marca no desktop.
 *
 * ⚠️ ESCOPO: email + senha e Google são REAIS (EF-01, fechada). Apple,
 * "criar conta da família" tambem sao REAIS desde RN-06..RN-09 — o link leva
 * a `/criar-conta` —, e "esqueci minha senha" e REAL desde RN-12..RN-16, com o
 * link levando a `/recuperar`. Apple segue FORA da EF-01: continua inerte,
 * mostrando "em breve" em vez de abrir um fluxo que a EF nao especificou.
 */
definePageMeta({ layout: false });

const { entrar, entrarComGoogle } = useSessao();
const { disponivel: googleDisponivel, obterCodigoDeAutorizacao } = useGoogle();

const email = ref('');
const senha = ref('');
const verSenha = ref(false);
const enviando = ref(false);
const mensagem = ref<string | null>(null);
const ehErro = ref(false);

const MARCAS = [
  { icone: 'ti-lock-dollar', texto: 'Só mostra o que tem lastro de verdade' },
  { icone: 'ti-credit-card', texto: 'Cartão abate a categoria no mesmo dia' },
  { icone: 'ti-users', texto: 'Duas pessoas, um orçamento só' },
];

function emBreve(nome: string): void {
  ehErro.value = false;
  mensagem.value = `${nome}: em breve.`;
}

async function submeter(): Promise<void> {
  if (enviando.value) return;
  mensagem.value = null;
  ehErro.value = false;
  enviando.value = true;
  try {
    await entrar(email.value.trim(), senha.value);
    await navigateTo('/');
  } catch {
    ehErro.value = true;
    mensagem.value = 'Email ou senha não conferem.';
  } finally {
    enviando.value = false;
  }
}

async function comGoogle(): Promise<void> {
  if (!googleDisponivel) {
    emBreve('Entrar com Google');
    return;
  }
  if (enviando.value) return;
  mensagem.value = null;
  ehErro.value = false;
  enviando.value = true;
  try {
    const codigoAutorizacao = await obterCodigoDeAutorizacao();
    await entrarComGoogle(codigoAutorizacao);
    await navigateTo('/');
  } catch (erro) {
    ehErro.value = true;
    mensagem.value = mensagemDoErro(erro, 'Não consegui entrar com o Google.');
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <div class="entrar">
    <!-- ── painel de marca · só desktop ─────────────────────────────────── -->
    <aside class="entrar__marca">
      <div class="entrar__marca-topo">
        <span class="entrar__selo"><i class="ti ti-home-dollar"></i></span>
        <span class="entrar__marca-nome">Orçamento Familiar</span>
      </div>

      <div class="entrar__marca-meio">
        <h1 class="entrar__headline">O controle total,<br>num lugar só.</h1>
        <p class="entrar__tagline">
          Tetos por categoria, cartão abatendo na hora e um saldo que nunca promete o que não existe.
        </p>
        <ul class="entrar__lista-marcas">
          <li v-for="marca in MARCAS" :key="marca.texto">
            <i class="ti" :class="marca.icone"></i>
            <span>{{ marca.texto }}</span>
          </li>
        </ul>
      </div>

      <p class="entrar__marca-rodape">Desenvolvido por <a href="https://cesarvieira.dev" target="_blank">Cesar Vieira</a></p>
    </aside>

    <!-- ── coluna do formulário ─────────────────────────────────────────── -->
    <div class="entrar__coluna">
      <!-- hero só mobile: o painel de marca acima já cobre o desktop -->
      <div class="entrar__hero">
        <span class="entrar__selo"><i class="ti ti-home-dollar"></i></span>
        <h1 class="entrar__hero-titulo">Orçamento<br>familiar</h1>
        <p class="entrar__hero-sub">Um lugar só para o dinheiro de vocês dois.</p>
      </div>

      <div class="entrar__cartao">
        <h2 class="entrar__titulo">Entrar</h2>
        <p class="entrar__subtitulo">Bem-vinda de volta.</p>

        <form class="entrar__campos" @submit.prevent="submeter">
          <label class="campo">
            <i class="ti ti-mail campo__icone"></i>
            <span class="campo__texto">
              <span class="campo__rotulo">EMAIL</span>
              <input
                v-model="email"
                type="email"
                name="email"
                autocomplete="username"
                placeholder="voce@email.com"
                required
                class="campo__entrada"
              >
            </span>
          </label>

          <label class="campo">
            <i class="ti ti-lock campo__icone"></i>
            <span class="campo__texto">
              <span class="campo__rotulo">SENHA</span>
              <input
                v-model="senha"
                :type="verSenha ? 'text' : 'password'"
                name="senha"
                autocomplete="current-password"
                placeholder="••••••••"
                required
                class="campo__entrada"
              >
            </span>
            <button type="button" class="campo__olho" @click="verSenha = !verSenha">
              <i class="ti" :class="verSenha ? 'ti-eye-off' : 'ti-eye'"></i>
            </button>
          </label>

          <div class="entrar__linha">
            <NuxtLink to="/recuperar" class="entrar__link">Esqueci minha senha</NuxtLink>
          </div>

          <p v-if="mensagem" class="entrar__mensagem" :class="{ 'entrar__mensagem--erro': ehErro }" role="status">
            <i class="ti" :class="ehErro ? 'ti-alert-circle' : 'ti-info-circle'"></i>
            <span>{{ mensagem }}</span>
          </p>

          <button type="submit" class="botao" :disabled="enviando">
            {{ enviando ? 'Entrando…' : 'Entrar' }}
          </button>
        </form>

        <div class="entrar__divisor"><span></span><span>ou</span><span></span></div>

        <div class="entrar__social">
          <button type="button" @click="comGoogle">
            <i class="ti ti-brand-google"></i><span>Google</span>
          </button>
        </div>

        <p class="entrar__criar-conta">
          <span class="entrar__criar-conta-pergunta">Ainda não tem conta?</span>
          <NuxtLink to="/criar-conta">Criar conta da família</NuxtLink>
        </p>
      </div>
    </div>
  </div>
</template>

<style lang="scss" src="~/assets/scss/pages/entrar.scss" scoped></style>
