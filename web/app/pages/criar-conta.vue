<script setup lang="ts">
/**
 * CRIAR CONTA DA FAMÍLIA — RN-06 a RN-09 (EF-01 §3).
 *
 * Usa a MESMA folha de estilo do `/entrar` (`pages/entrar.scss`), não uma
 * cópia: é literalmente o mesmo padrão visual — painel de marca no desktop,
 * hero no mobile, cartão com os campos —, e copiar o CSS seria recriar a
 * duplicação que acabamos de remover do projeto.
 *
 * O cadastro NÃO entra no app: a identidade nasce não confirmada (RN-06), e o
 * login a recusa até o email ser provado. Por isso a tela termina em "confira
 * seu email", e não numa navegação.
 */
definePageMeta({ layout: false });

const { criarConta } = useConta();

const familiaNome = ref('');
const nome = ref('');
const email = ref('');
const senha = ref('');
const verSenha = ref(false);
const enviando = ref(false);
const enviadoPara = ref<string | null>(null);
const mensagem = ref<string | null>(null);
const ehErro = ref(false);

const MARCAS = [
  { icone: 'ti-lock-dollar', texto: 'Só mostra o que tem lastro de verdade' },
  { icone: 'ti-credit-card', texto: 'Cartão abate a categoria no mesmo dia' },
  { icone: 'ti-users', texto: 'Duas pessoas, um orçamento só' },
];

async function submeter(): Promise<void> {
  if (enviando.value) return;
  mensagem.value = null;
  ehErro.value = false;
  enviando.value = true;
  try {
    const criada = await criarConta({
      familiaNome: familiaNome.value.trim(),
      nome: nome.value.trim(),
      email: email.value.trim(),
      senha: senha.value,
    });
    enviadoPara.value = criada.email;
  } catch (erro) {
    ehErro.value = true;
    // A mensagem vem da API: é ela que conhece RN-07 e RN-08, e quem convida.
    mensagem.value = mensagemDoErro(erro, 'Não consegui criar a família.');
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <div class="entrar">
    <aside class="entrar__marca">
      <div class="entrar__marca-topo">
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

    <div class="entrar__coluna">
      <div class="entrar__hero">
        <span class="entrar__selo"><i class="ti ti-home-dollar"></i></span>
        <h1 class="entrar__hero-titulo">Orçamento<br>familiar</h1>
        <p class="entrar__hero-sub">Comece criando a família de vocês.</p>
      </div>

      <div class="entrar__cartao">
        <!-- Depois de enviar, a tela não some: ela vira o aviso de confirmação. -->
        <template v-if="enviadoPara">
          <h2 class="entrar__titulo">Confira seu email</h2>
          <p class="entrar__subtitulo">
            Mandamos um código de 6 dígitos para <strong>{{ enviadoPara }}</strong>. Digite-o na
            tela de confirmação — enquanto não confirmar, o login fica bloqueado.
          </p>
          <p class="entrar__criar-conta">
            <span class="entrar__criar-conta-pergunta">Já tem o código?</span>
            <NuxtLink to="/confirmar">Confirmar email</NuxtLink>
          </p>
        </template>

        <template v-else>
          <h2 class="entrar__titulo">Criar conta da família</h2>
          <p class="entrar__subtitulo">Quem cria vira o primeiro membro e convida o resto.</p>

          <form class="entrar__campos" @submit.prevent="submeter">
            <label class="campo">
              <i class="ti ti-home campo__icone"></i>
              <span class="campo__texto">
                <span class="campo__rotulo">NOME DA FAMÍLIA</span>
                <input
                  v-model="familiaNome"
                  type="text"
                  name="familiaNome"
                  placeholder="Casa da Ana e do Bruno"
                  required
                  minlength="2"
                  class="campo__entrada"
                >
              </span>
            </label>

            <label class="campo">
              <i class="ti ti-user campo__icone"></i>
              <span class="campo__texto">
                <span class="campo__rotulo">SEU NOME</span>
                <input
                  v-model="nome"
                  type="text"
                  name="nome"
                  autocomplete="name"
                  placeholder="Como te chamam"
                  required
                  minlength="2"
                  class="campo__entrada"
                >
              </span>
            </label>

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
                <span class="campo__rotulo">SENHA (MÍNIMO 8)</span>
                <input
                  v-model="senha"
                  :type="verSenha ? 'text' : 'password'"
                  name="senha"
                  autocomplete="new-password"
                  placeholder="••••••••"
                  required
                  minlength="8"
                  class="campo__entrada"
                >
              </span>
              <button type="button" class="campo__olho" @click="verSenha = !verSenha">
                <i class="ti" :class="verSenha ? 'ti-eye-off' : 'ti-eye'"></i>
              </button>
            </label>

            <p v-if="mensagem" class="entrar__mensagem" :class="{ 'entrar__mensagem--erro': ehErro }" role="status">
              <i class="ti" :class="ehErro ? 'ti-alert-circle' : 'ti-info-circle'"></i>
              <span>{{ mensagem }}</span>
            </p>

            <button type="submit" class="botao" :disabled="enviando">
              {{ enviando ? 'Criando…' : 'Criar família' }}
            </button>
          </form>

          <p class="entrar__criar-conta">
            <span class="entrar__criar-conta-pergunta">Já tem conta?</span>
            <NuxtLink to="/entrar">Entrar</NuxtLink>
          </p>
        </template>
      </div>
    </div>
  </div>
</template>

<style lang="scss" src="~/assets/scss/pages/entrar.scss" scoped></style>
