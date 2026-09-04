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

| Peça       | Onde                   | Nota                                                         |
| ---------- | ---------------------- | ------------------------------------------------------------ |
| Schema     | `api/src/db/schema.ts` | TypeScript, fonte única do modelo                            |
| Migrations | `api/drizzle/*.sql`    | geradas por `drizzle-kit generate`, versionadas, nunca à mão |
| Conexão    | `api/src/db/index.ts`  | `drizzle(pool)` de `drizzle-orm/node-postgres`               |
| Contrato   | `packages/contrato`    | **saída** do OpenAPI, não fonte; não se edita                |

**Dinheiro:** o tipo padrão de valor monetário é definido aqui e usado por todos —
`integer` em centavos, com a ressalva de 32 bits registrada em
[D-06](../decisoes/D-06-dinheiro-em-centavos.md).

**Data e competência** são colunas distintas em qualquer entidade que as tenha: `data` (`DATE`,
quando o fato aconteceu) e `competencia` (`CHAR(7)`, `AAAA-MM`, a que mês do orçamento pertence).
A competência é calculada **na escrita** e persistida.

---

## §2 — Regras

| #   | Regra                                                              | Onde é imposta                                  | Fonte                                       |
| --- | ------------------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------- |
| R1  | O `familiaId` vem do token, nunca do request                       | middleware de tenant, antes de qualquer handler | [D-05](../decisoes/D-05-acesso-familiar.md) |
| R2  | A room do socket é resolvida no **handshake**, do cookie de sessão | `/realtime`                                     | [D-04](../decisoes/D-04-tempo-real.md)      |
| R3  | O servidor emite **invalidação**, nunca estado derivado            | emissor central                                 | D-04                                        |
| R4  | Ao reconectar, o cliente refaz a leitura da competência ativa      | `useRealtime`                                   | D-04                                        |
| R5  | O cliente descarta eventos de `origemClienteId` igual ao seu       | `useRealtime`                                   | D-04                                        |
| R6  | O front importa o tipo gerado; não redeclara o modelo              | build                                           | [D-03](../decisoes/D-03-contrato-gerado.md) |

---

## §3 — Telas

**Referência de tela:** o shell dos dois arquivos do mockup — tab bar no mobile, sidebar no
desktop. **As mesmas sete telas**, não dois produtos.

| Peça           | Rota                                      | Nota                                                          |
| -------------- | ----------------------------------------- | ------------------------------------------------------------- |
| Layout         | `web/app/layouts/default.vue`             | tab bar < 768px; sidebar acima                                |
| Navegação      | `web/app/config/navegacao.ts`             | os sete destinos, um só lugar                                 |
| Tempo real     | `web/app/composables/useRealtime.ts`      | conecta **só no cliente**, após hidratação                    |
| Manifesto      | `web/public/manifest.webmanifest`         | declaração de instalabilidade; referência D-10                |
| Service Worker | `web/public/sw.js`                        | cache de asset versionado só; lista de permissão de segurança |
| Plugin PWA     | `web/app/plugins/pwa.client.ts`           | registra SW em produção; escuta `beforeinstallprompt`         |
| Composable     | `web/app/composables/useInstalacaoPwa.ts` | estado do evento de instalação; dispara prompt                |
| Botão          | `web/app/layouts/default.vue` (sidebar)   | renderiza se navegador ofereceu instalação                    |
| Botão          | `web/app/pages/mais/index.vue` (menu)     | renderiza se navegador ofereceu instalação                    |

Nenhuma tela de domínio é construída aqui — só a moldura onde elas entram.

---

## §4 — O que não se copia do protótipo

- **`support.js`** é runtime gerado do dc-runtime. Zero conteúdo de produto. **Não portar.**
- As props `cenarioSemLastro` e `cartaoAbateSaldoNaHora` são chaves de demonstração, não
  configuração do produto.

---

## §5 — Definition of Done

- [x] Migrations aplicam **do zero** em banco limpo
- [x] `docker compose up --build` sobe a stack completa (o compose de **produção**)
- [x] `packages/contrato` é gerado do OpenAPI e o front o importa
- [x] Socket autentica no handshake; família B **não** recebe evento da A
- [ ] Socket derrubado e reconectado ressincroniza a competência ativa — implementado em
      `useRealtime.ts` (R4), mas **não coberto pelo gate**: é comportamento de cliente, sem teste
      automatizado que force desconexão/reconexão. Registrado como pendência em MC-00, § Validações
      obrigatórias.
- [ ] Seed cria a família de teste com membro aceito + 1–3 registros por módulo — o membro aceito
      sai; os registros por módulo **não existem ainda** porque EF-00 §1 declara "nenhuma entidade
      de domínio" e as tabelas de módulo (EF-01..EF-08) ainda não foram construídas. Entregue como
      arnês `SEMEADORES_DE_MODULO` em `api/src/db/semear.ts`, vazio e documentado — cada EF futura
      registra o seu semeador ali. Ver MC-00.
- [x] `preator-perfil.sh` preenchido; `PREATOR_TEST_USER`/`PASS` documentados no `.env.example`
- [x] A tela de login abre no artefato de deploy, zero erro de console e de rede
- [x] `PROVA_DE_COMPORTAMENTO=PASS`
- [ ] Instalação em iOS — o Safari não expõe `beforeinstallprompt` e nenhum site dispara a
      instalação automaticamente lá; o fluxo é manual (_Compartilhar_ → _Adicionar à Tela de
      Início_). Instrução de usuário para iOS é decisão de produto e de UX, fora do escopo de EF-00
      — registrada em [D-10](../decisoes/D-10-pwa-instalavel.md) §Alternativas como pendência
      declarada.

> Sem o seed e as credenciais de teste, o gate de navegação cobre a tela de login e nada mais —
> neste produto **tudo** é área logada.

---

## Tríade — o que foi construído

Fechada em 2026-08-24, história [#14](https://github.com/cesarvieira/orcamento/issues/14), tarefa
[#24](https://github.com/cesarvieira/orcamento/issues/24), commit `b6c05a7` (mesclado em `b20164b`).
`PROVA_DE_COMPORTAMENTO=PASS`, re-executado pelo condutor de forma independente do relato do
agente — duas vezes na branch da tarefa, e mais uma vez do zero na branch da história.

O que falta e o que foi implantado além do previsto: [MC-00-plataforma.md](MC-00-plataforma.md).
Como foi construído: [../manual/MANUAL-00-plataforma.md](../manual/MANUAL-00-plataforma.md).

### Decisões incorporadas na implantação

- **`/entrar` (email+senha) foi construído aqui**, adiantado da EF-01, porque a EF-00 precisa de
  uma tela de login real para o gate de navegação provar a área logada. Google OAuth e o fluxo de
  convite/aceite continuam sendo escopo da EF-01, que substitui esta página — não a EF-00.
- **`req.query` no Express 5 é um getter preguiçoso**: o middleware de tenant que fazia `delete`
  no objeto via `defineProperty` com cópia limpa, não mutação — sem isso o campo "descartado"
  reaparecia na leitura seguinte. Fixado em `api/src/http/middleware/tenant.ts`, travado por teste
  em `api/testes/tenant.teste.ts`. A terceira via de vazamento (`:familiaId` no path) foi fechada
  recusando o registro dessa forma de rota, não filtrando em runtime.
