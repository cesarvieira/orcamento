# EF-01 — Família e acesso

## §0 — Escopo & fronteira

**Pasta:** `api/src/modulos/familia` · telas de login, convite e aceite.

**É deste módulo:** identidade, sessão, família como tenant, convite por email, vínculo de
identidade. **Não é:** nenhum dado financeiro.

---

## §1 — Dados

| Entidade | Papel | Relaciona-com | Decisão |
|---|---|---|---|
| `Familia` | tenant; raiz de todo isolamento | 1—N `Membro` | todo dado do produto pende daqui |
| `Membro` | pessoa com login numa família | N—1 `Familia` | autor imutável de cada lançamento |
| `Identidade` | credencial de um membro | N—1 `Membro` | `provedor` (google \| senha) + `emailVerificado` |
| `Convite` | convite pendente | N—1 `Familia` | `email`, `token`, `expiraEm`, `usadoEm` |

**Por que `Identidade` é entidade separada de `Membro`:** o mesmo email pode chegar por Google e
por senha, e precisa resolver para **a mesma pessoa**. Guardar o provedor dentro de `Membro`
forçaria duplicar a pessoa por provedor — que é exatamente o furo de RN-04.

---

## §2 — Regras

| # | Regra | Onde é imposta | Fonte |
|---|---|---|---|
| RN-01 | O `familiaId` deriva **sempre** do token, nunca do request | middleware de tenant | [D-05](../decisoes/D-05-acesso-familiar.md) |
| RN-02 | O email que aceita o convite é idêntico ao convidado. Com Google vale o email **verificado** do provedor | `POST /convites/:token/aceitar` | D-05 |
| RN-03 | Convite **expira** e é de **uso único** | mesmo handler | D-05 · TTL em `CONVITE_TTL_HORAS` |
| RN-04 | Mesmo email via Google e via senha é a **mesma pessoa** | serviço de identidade | D-05 |
| RN-05 | Todo membro da família tem o mesmo poder sobre os dados | ausência de papéis | mockup |

**Sobre RN-02 e RN-04 juntas:** sem a vinculação de identidade, quem foi convidado como
`ana@x.com` cria uma conta de senha com o mesmo email e passa a existir duas vezes — e o convite
se burla sem nunca ser aceito.

---

## §3 — Telas

**Referência de tela:** o mockup não tem telas de login e convite — ele começa logado. **Esta é a
única EF cuja superfície não vem do desenho.** Construir no mesmo sistema visual do shell
(EF-00), sem inventar linguagem nova.

| Recurso | Rota | Fluxo |
|---|---|---|
| Entrar | `/entrar` | Google ou email+senha → cookie `httpOnly` → tela do mês |
| Convidar | dentro de *Mais* | email → envia → convite listado como pendente |
| Aceitar | `/convite/:token` | valida email → cria membro → entra |

---

## §4 — O que não se copia do protótipo

O rodapé do mockup diz *"Ana e Bruno · dados de exemplo"*. É seed, não modelo: a família não tem
número fixo de membros.

---

## §5 — Definition of Done

- [ ] Um teste de integração por RN acima
- [ ] **Isolamento:** a família B não enxerga dado da A — no REST **e** no socket
- [ ] Convite: persistido, token valida, **expira**, e recusa email divergente (driver `log`)
- [ ] Google e senha com mesmo email resolvem para o mesmo `Membro`
- [ ] As telas abrem no artefato de deploy, zero erro de console e de rede
- [ ] `PROVA_DE_COMPORTAMENTO=PASS`
