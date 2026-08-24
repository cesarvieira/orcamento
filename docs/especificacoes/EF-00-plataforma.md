# EF-00 — Plataforma

> **Gargalo serial.** Cria o que todos os módulos consomem e ninguém edita depois. Um agente só.
> Não é história de usuário: não tem tela própria e não fecha por si.

## §0 — Escopo & fronteira

**Pasta:** a raiz do monorepo, `packages/contrato`, `scripts/`, e o esqueleto de `api/` e `web/`.

**É deste módulo:** monorepo, conexão de banco, migrations, geração de contrato, transporte de
tempo real, shell responsivo, seed, composes e o preenchimento do `preator-perfil.sh`.

**Não é:** nenhuma regra de negócio. Nenhuma entidade de domínio além do mínimo para autenticar
(que é da [EF-01](EF-01-familia-e-acesso.md)).

---

## §1 — Dados

Nenhuma entidade de domínio. Este módulo entrega a **fundação**:

| Peça | Onde | Nota |
|---|---|---|
| Schema | `api/src/db/schema.ts` | TypeScript, fonte única do modelo |
| Migrations | `api/drizzle/*.sql` | geradas por `drizzle-kit generate`, versionadas, nunca à mão |
| Conexão | `api/src/db/index.ts` | `drizzle(pool)` de `drizzle-orm/node-postgres` |
| Contrato | `packages/contrato` | **saída** do OpenAPI, não fonte; não se edita |

**Dinheiro:** o tipo padrão de valor monetário é definido aqui e usado por todos —
`integer` em centavos, com a ressalva de 32 bits registrada em
[D-06](../decisoes/D-06-dinheiro-em-centavos.md).

**Data e competência** são colunas distintas em qualquer entidade que as tenha: `data` (`DATE`,
quando o fato aconteceu) e `competencia` (`CHAR(7)`, `AAAA-MM`, a que mês do orçamento pertence).
A competência é calculada **na escrita** e persistida.

---

## §2 — Regras

| # | Regra | Onde é imposta | Fonte |
|---|---|---|---|
| R1 | O `familiaId` vem do token, nunca do request | middleware de tenant, antes de qualquer handler | [D-05](../decisoes/D-05-acesso-familiar.md) |
| R2 | A room do socket é resolvida no **handshake**, do cookie de sessão | `/realtime` | [D-04](../decisoes/D-04-tempo-real.md) |
| R3 | O servidor emite **invalidação**, nunca estado derivado | emissor central | D-04 |
| R4 | Ao reconectar, o cliente refaz a leitura da competência ativa | `useRealtime` | D-04 |
| R5 | O cliente descarta eventos de `origemClienteId` igual ao seu | `useRealtime` | D-04 |
| R6 | O front importa o tipo gerado; não redeclara o modelo | build | [D-03](../decisoes/D-03-contrato-gerado.md) |

---

## §3 — Telas

**Referência de tela:** o shell dos dois arquivos do mockup — tab bar no mobile, sidebar no
desktop. **As mesmas sete telas**, não dois produtos.

| Peça | Rota | Nota |
|---|---|---|
| Layout | `web/layouts/default.vue` | tab bar < 768px; sidebar acima |
| Navegação | `web/config/navegacao.ts` | os sete destinos, um só lugar |
| Tempo real | `web/composables/useRealtime.ts` | conecta **só no cliente**, após hidratação |

Nenhuma tela de domínio é construída aqui — só a moldura onde elas entram.

---

## §4 — O que não se copia do protótipo

- **`support.js`** é runtime gerado do dc-runtime. Zero conteúdo de produto. **Não portar.**
- As props `cenarioSemLastro` e `cartaoAbateSaldoNaHora` são chaves de demonstração, não
  configuração do produto.

---

## §5 — Definition of Done

- [ ] Migrations aplicam **do zero** em banco limpo
- [ ] `docker compose up --build` sobe a stack completa (o compose de **produção**)
- [ ] `packages/contrato` é gerado do OpenAPI e o front o importa
- [ ] Socket autentica no handshake; família B **não** recebe evento da A
- [ ] Socket derrubado e reconectado ressincroniza a competência ativa
- [ ] Seed cria a família de teste com membro aceito + 1–3 registros por módulo
- [ ] `preator-perfil.sh` preenchido; `PREATOR_TEST_USER`/`PASS` documentados no `.env.example`
- [ ] A tela de login abre no artefato de deploy, zero erro de console e de rede
- [ ] `PROVA_DE_COMPORTAMENTO=PASS`

> Sem o seed e as credenciais de teste, o gate de navegação cobre a tela de login e nada mais —
> neste produto **tudo** é área logada.
