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

| #     | Regra                                                                                                                                                                                                       | Onde é imposta                                        | Fonte                                       |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------- |
| RN-01 | O `familiaId` deriva **sempre** do token, nunca do request                                                                                                                                                  | middleware de tenant                                  | [D-05](../decisoes/D-05-acesso-familiar.md) |
| RN-02 | O email que aceita o convite é idêntico ao convidado. Com Google vale o email **verificado** do provedor                                                                                                    | `POST /convites/:token/aceitar`                       | D-05                                        |
| RN-03 | Convite **expira** e é de **uso único**                                                                                                                                                                     | mesmo handler                                         | D-05 · TTL em `CONVITE_TTL_HORAS`           |
| RN-04 | Mesmo email via Google e via senha é a **mesma pessoa**                                                                                                                                                     | serviço de identidade                                 | D-05                                        |
| RN-05 | Todo membro da família tem o mesmo poder sobre os dados                                                                                                                                                     | ausência de papéis                                    | mockup                                      |
| RN-06 | Quem cria a família nasce com a identidade **não confirmada**; o login é recusado até a confirmação do email                                                                                                | `POST /sessoes` + serviço de cadastro                 | decisão do humano, 2026-08-26               |
| RN-07 | Email que já é de um `Membro` não pode cadastrar — o email identifica a pessoa (RN-04), não a conta                                                                                                         | serviço de cadastro                                   | decorre de RN-04                            |
| RN-08 | Email com **convite pendente** não pode cadastrar. O convite é o único caminho para entrar numa família existente; a pessoa **aceita ou recusa** pelo email do convite, e recusar libera o cadastro próprio | serviço de cadastro + `POST /convites/:token/recusar` | decisão do humano, 2026-08-26               |
| RN-09 | O link de confirmação **expira** e é de **uso único** — mesmo formato do convite                                                                                                                            | serviço de cadastro                                   | simetria com RN-03                          |

**Sobre RN-02 e RN-04 juntas:** sem a vinculação de identidade, quem foi convidado como
`ana@x.com` cria uma conta de senha com o mesmo email e passa a existir duas vezes — e o convite
se burla sem nunca ser aceito.

---

## §3 — Telas

**Referência de tela:** o mockup não tem telas de login e convite — ele começa logado. **Esta é a
única EF cuja superfície não vem do desenho.** Construir no mesmo sistema visual do shell
(EF-00), sem inventar linguagem nova.

| Recurso     | Rota                | Fluxo                                                                            |
| ----------- | ------------------- | -------------------------------------------------------------------------------- |
| Entrar      | `/entrar`           | Google ou email+senha → cookie `httpOnly` → tela do mês                          |
| Criar conta | `/criar-conta`      | nome da família + nome + email + senha → cria → **email de confirmação** (RN-06) |
| Confirmar   | `/confirmar/:token` | valida o token (RN-09) → marca o email verificado → entra logado                 |
| Convidar    | dentro de _Mais_    | email → envia → confirmação + lista de convites pendentes da família             |
| Aceitar     | `/convite/:token`   | valida email → cria membro → entra                                               |
| Recusar     | `/convite/:token`   | mesma tela, ação secundária — libera o email para cadastro próprio (RN-08)       |

`/criar-conta` é alcançada pelo link **"Criar conta da família"** do `/entrar`, e usa o mesmo
padrão visual dele: hero no mobile, painel de marca no desktop, cartão com os campos.

---

## §4 — O que não se copia do protótipo

O rodapé do mockup diz _"Ana e Bruno · dados de exemplo"_. É seed, não modelo: a família não tem
número fixo de membros.

---

## §6 — O que não foi construído nesta história

- **"Esqueci minha senha" e login por Apple.** Ficam inertes ("em breve") em `/entrar` — não estão
  no escopo desta EF: ela não tem rota nem regra para recuperar senha (§3).

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
