# EF-01 — Família e acesso

## §0 — Escopo & fronteira

**Pasta:** `api/src/modulos/familia` · telas de login, convite e aceite.

**É deste módulo:** identidade, sessão, família como tenant, convite por email, vínculo de
identidade. **Não é:** nenhum dado financeiro.

---

## §1 — Dados

| Entidade     | Papel                           | Relaciona-com | Decisão                                          |
| ------------ | ------------------------------- | ------------- | ------------------------------------------------ |
| `Familia`    | tenant; raiz de todo isolamento | 1—N `Membro`  | todo dado do produto pende daqui                 |
| `Membro`     | pessoa com login numa família   | N—1 `Familia` | autor imutável de cada lançamento                |
| `Identidade` | credencial de um membro         | N—1 `Membro`  | `provedor` (google \| senha) + `emailVerificado` |
| `Convite`    | convite pendente                | N—1 `Familia` | `email`, `token`, `expiraEm`, `usadoEm`          |

**Por que `Identidade` é entidade separada de `Membro`:** o mesmo email pode chegar por Google e
por senha, e precisa resolver para **a mesma pessoa**. Guardar o provedor dentro de `Membro`
forçaria duplicar a pessoa por provedor — que é exatamente o furo de RN-04.

---

## §2 — Regras

| #     | Regra                                                                                                                                                                                                       | Onde é imposta                                 | Fonte                                            |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------ |
| RN-01 | O `familiaId` deriva **sempre** do token, nunca do request                                                                                                                                                  | middleware de tenant                           | [D-05](../decisoes/D-05-acesso-familiar.md)      |
| RN-02 | O email que aceita o convite é idêntico ao convidado. Com Google vale o email **verificado** do provedor                                                                                                    | `POST /convites/aceitar`                       | D-05                                             |
| RN-03 | Convite **expira** e é de **uso único**                                                                                                                                                                     | mesmo handler                                  | D-05 · TTL em `CONVITE_TTL_HORAS`                |
| RN-04 | Mesmo email via Google e via senha é a **mesma pessoa**                                                                                                                                                     | serviço de identidade                          | D-05                                             |
| RN-05 | Todo membro da família tem o mesmo poder sobre os dados                                                                                                                                                     | ausência de papéis                             | mockup                                           |
| RN-06 | Quem cria a família nasce com a identidade **não confirmada**; o login é recusado até a confirmação do email                                                                                                | `POST /sessoes` + serviço de cadastro          | decisão do humano, 2026-08-26                    |
| RN-07 | Email que já é de um `Membro` não pode cadastrar — o email identifica a pessoa (RN-04), não a conta                                                                                                         | serviço de cadastro                            | decorre de RN-04                                 |
| RN-08 | Email com **convite pendente** não pode cadastrar. O convite é o único caminho para entrar numa família existente; a pessoa **aceita ou recusa** pelo email do convite, e recusar libera o cadastro próprio | serviço de cadastro + `POST /convites/recusar` | decisão do humano, 2026-08-26                    |
| RN-09 | O código de confirmação **expira** e é de **uso único** — mesmo formato do convite                                                                                                                          | serviço de cadastro                            | simetria com RN-03                               |
| RN-10 | Convite e confirmação chegam por email como **código de 6 dígitos digitado**, nunca como link clicável. O código é validado **junto do email** — ele não é único sozinho                                    | serviços de convite e cadastro                 | decisão do humano, 2026-08-26                    |
| RN-11 | Um código erra no máximo **5 vezes**; na 5ª o código é **invalidado** e é preciso pedir outro                                                                                                               | mesmos serviços                                | decorre de RN-10 — ver abaixo                    |
| RN-12 | Quem esqueceu a senha pede recuperação e recebe um **código de 6 dígitos**, com o mesmo teto de tentativas de RN-10/RN-11                                                                                   | serviço de recuperação                         | decisão do humano, 2026-08-26                    |
| RN-13 | A resposta ao **pedido** de recuperação é idêntica exista ou não a conta — nunca revela quem tem conta                                                                                                      | `POST /recuperacoes`                           | decisão do humano, 2026-08-26 — ver abaixo       |
| RN-14 | Trocar a senha **encerra todas** as sessões daquele membro, em todo dispositivo                                                                                                                             | `POST /recuperacoes/concluir`                  | decisão do humano, 2026-08-26                    |
| RN-15 | Quem só tinha Google ganha a identidade de **senha** ao recuperar — é a mesma pessoa, e passa a entrar pelos dois caminhos                                                                                  | serviço de recuperação                         | decisão do humano, 2026-08-26 · decorre de RN-04 |
| RN-16 | Concluir a recuperação **prova o email**: marca o email verificado se ainda não estava, e com isso satisfaz RN-06                                                                                           | serviço de recuperação                         | decisão do humano, 2026-08-26                    |

**Sobre RN-02 e RN-04 juntas:** sem a vinculação de identidade, quem foi convidado como
`ana@x.com` cria uma conta de senha com o mesmo email e passa a existir duas vezes — e o convite
se burla sem nunca ser aceito.

**Sobre RN-10 e RN-11 juntas — por que o limite não é opcional.** O token anterior tinha 256 bits
e era inadivinhável; um código de 6 dígitos tem ~1 milhão de combinações, que um script percorre
em segundos. O que o mantém seguro é **só** o teto de tentativas: com 5, a chance de acerto cego é
5 em 1.000.000. Quem mexer neste fluxo e afrouxar RN-11 devolve a força bruta ao jogo — e aqui o
que está do outro lado é a conta de uma família e o dinheiro dela.

Disso decorre uma consequência de projeto: **o código não é único sozinho** (dois convites
pendentes podem sortear o mesmo), então a busca é sempre por **email + código**, nunca só pelo
código. Isso também é o que torna o teto possível: acha-se a linha pelo email para então contar o
erro.

**Sobre RN-13 — e a incoerência que ela deixa exposta.** Não revelar quem tem conta é a postura que
`POST /sessoes` já toma: ele responde `credenciais_invalidas` tanto para senha errada quanto para
email que nunca existiu, e o comentário no código diz por quê. RN-13 segue a mesma linha. Quem
destoa é **RN-07**: o cadastro responde `email_ja_cadastrado` e portanto revela. A decisão do
humano foi manter a não-enumeração aqui e **não** mexer em RN-07 nesta história — a incoerência
está registrada em [MC-01](MC-01-familia-e-acesso.md), não emendada de contrabando.

**Sobre RN-14 — por que encerrar tudo.** É o que separa "esqueci a senha" de "tomaram minha
conta". Se as sessões abertas sobrevivessem à troca, quem tivesse entrado indevidamente
continuaria dentro depois de a dona trocar a senha — e a recuperação viraria teatro. Por isso as
sessões morrem **antes** de a nova ser aberta.

---

## §3 — Telas

**Referência de tela:** o mockup não tem telas de login e convite — ele começa logado. **Esta é a
única EF cuja superfície não vem do desenho.** Construir no mesmo sistema visual do shell
(EF-00), sem inventar linguagem nova.

| Recurso     | Rota             | Fluxo                                                                                |
| ----------- | ---------------- | ------------------------------------------------------------------------------------ |
| Entrar      | `/entrar`        | Google ou email+senha → cookie `httpOnly` → tela do mês                              |
| Criar conta | `/criar-conta`   | nome da família + nome + email + senha → cria → **email com o código** (RN-06/RN-10) |
| Confirmar   | `/confirmar`     | email + **código de 6 dígitos** (RN-10) → marca o email verificado → entra logado    |
| Convidar    | dentro de _Mais_ | email → envia → confirmação + lista de convites pendentes da família                 |
| Aceitar     | `/convite`       | email + **código** + nome e senha (ou Google) → cria membro → entra                  |
| Recusar     | `/convite`       | mesma tela, ação secundária — libera o email para cadastro próprio (RN-08)           |
| Recuperar   | `/recuperar`     | email → **email com o código** → mesma tela pede código + senha nova → entra (RN-12) |

`/criar-conta` é alcançada pelo link **"Criar conta da família"** do `/entrar`, e usa o mesmo
padrão visual dele: hero no mobile, painel de marca no desktop, cartão com os campos.
`/recuperar` é alcançada pelo link **"Esqueci minha senha"** da mesma tela, e segue o mesmo padrão.

---

## §4 — O que não se copia do protótipo

O rodapé do mockup diz _"Ana e Bruno · dados de exemplo"_. É seed, não modelo: a família não tem
número fixo de membros.

---

## §6 — O que não foi construído nesta história

- **Login por Apple.** Fica inerte ("em breve") em `/entrar` — não está no escopo desta EF.

> **"Esqueci minha senha" saiu desta lista em 2026-08-26**, pelo mesmo caminho que "Criar conta da
> família": era inerte porque a EF não tinha regra, e a decisão do humano fechou RN-12 a RN-16.
> Virou `/recuperar` (§3). O que a decisão trouxe de novo além da tela: **RN-14**, que faz a troca
> de senha expulsar sessões abertas, e **RN-15**, que deixa quem entrava só por Google passar a
> entrar também por senha.

> **"Criar conta da família" saiu desta lista em 2026-08-26.** Era inerte porque a EF não a
> especificava; a decisão do humano fechou RN-06 a RN-09 e ela virou `/criar-conta` (§3). O que a
> decisão trouxe de novo além da tela: **recusar convite**, sem o qual RN-08 prenderia quem
> recebesse um convite indesejado.

> Listagem de convites pendentes (`GET /convites`) foi identificada como lacuna após o primeiro
> fechamento desta história e fechada em seguida, ainda antes do merge do PR — tarefas #35
> (backend) e #36 (frontend). Ver [MC-01](MC-01-familia-e-acesso.md).

## §5 — Definition of Done

- [x] Um teste de integração por RN acima
- [x] **Isolamento:** a família B não enxerga dado da A — no REST **e** no socket
- [x] Convite: persistido, token valida, **expira**, e recusa email divergente (driver `log`)
- [x] Google e senha com mesmo email resolvem para o mesmo `Membro`
- [x] As telas abrem no artefato de deploy, zero erro de console e de rede
- [x] `PROVA_DE_COMPORTAMENTO=PASS`
