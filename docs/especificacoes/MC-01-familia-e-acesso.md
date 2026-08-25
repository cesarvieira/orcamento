# MC-01 — Matriz de Completude · Família e acesso

> O que **falta** decidir/construir/validar para EF-01 alcançar padrão implantável. Não repete o
> que a EF já resolveu. Ver [EF-01](EF-01-familia-e-acesso.md) (o contrato) e
> [MANUAL-01](../manual/MANUAL-01-familia-e-acesso.md) (o que foi construído).

- **Conteúdo base:** Com conteúdo — a EF-01 fechou uma implementação completa e provada.
- **Confiança:** Alta (código + gate re-executado pelo condutor, três vezes: por tarefa e pela
  história inteira do zero)
- **Critério de completude:** igual ao de [MC-00](MC-00-plataforma.md) — `Concluído` quando o gate
  prova de forma reproduzível; `Parcial` quando o código existe mas não há prova automatizada;
  `Pendente` quando nem o código existe.

## Matriz de completude

| Área                | Capacidade esperada                                                                  | Status    | O que falta |
| ------------------- | ------------------------------------------------------------------------------------ | --------- | ----------- |
| RN-01 · tenant      | `familiaId` sempre do token, também em convite/aceite                                | Concluído | —           |
| RN-02 · convite     | Email divergente do convidado é recusado (Google: verificado)                        | Concluído | —           |
| RN-03 · convite     | Expira (`CONVITE_TTL_HORAS`) e é de uso único                                        | Concluído | —           |
| RN-04 · identidade  | Google e senha com mesmo email resolvem para o mesmo `Membro`                        | Concluído | —           |
| RN-05 · poder igual | Quem entra por convite tem o mesmo poder (convida também)                            | Concluído | —           |
| Isolamento          | Família B não vê convite/membro/evento da A — REST e socket                          | Concluído | —           |
| Tela — entrar       | Google real (GIS), email/senha já existia                                            | Concluído | —           |
| Tela — convidar     | Envia convite, mostra confirmação e lista os pendentes da família                    | Concluído | —           |
| Tela — aceitar      | `/convite/:token`, senha ou Google, erro da API sempre exibido                       | Concluído | —           |
| Contrato            | `LoginGoogle`/`CriarConvite`/`ConviteCriado`/`AceitarConvite` gerados, front importa | Concluído | —           |
| Tempo real          | `emitirInvalidacao({recurso:'familia'})` ao aceitar convite                          | Concluído | —           |

## Lacunas

| Código          | Lacuna                                                                                                                                                                                                                                                                                                                                                                                                                                | Impacto                                                                                                                                                                         | Prioridade                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| ~~EF01-MC-001~~ | ~~Sem `GET /convites` (listagem de pendentes)~~ — **Resolvida** pelas tarefas #35/#36, ainda dentro desta história (antes do merge do PR)                                                                                                                                                                                                                                                                                             | —                                                                                                                                                                               | Fechada                                                                                                                          |
| EF01-MC-002     | `GOOGLE_CLIENT_ID` não configurado neste ambiente — login/aceite por Google fica inerte ("em breve"). **E, mesmo configurado no `.env`, não chega à stack de prova nem a um deploy:** a variável não é repassada em `docker-compose.yml` (falta `GOOGLE_CLIENT_ID` no serviço `api` e `NUXT_PUBLIC_GOOGLE_CLIENT_ID` no `web`). Como obter a credencial e o que falta ligar: [playbook](../../.preator/playbooks/google-client-id.md) | O caminho feliz do Google nunca roda em CI/gate; só o caminho "vazio" é exercitado automaticamente. Em produção o botão seguiria inerte mesmo com credencial válida no ambiente | Média                                                                                                                            |
| EF01-MC-003     | O gate de navegação (`crawl-gate.mjs`) não visita `/mais/convidar` nem `/convite/:token` — só as 7 rotas de domínio + `/entrar`                                                                                                                                                                                                                                                                                                       | Regressão nessas duas telas não seria pega pelo gate automatizado, só por checagem manual (feita nesta história, ver MANUAL-01)                                                 | Média                                                                                                                            |
| EF01-MC-004     | `raiz.sh` (fábrica) não exporta `FRONT_BASE`/`API_BASE` para o processo filho do `CRAWL_CMD` — só aparece quando as portas fogem do padrão 3000/3001, mascarado nesta máquina por outro app respondendo na porta 3001                                                                                                                                                                                                                 | Falso-negativo enganoso (crawler parece travado numa tela errada) sempre que alguém remapear porta sem exportar as duas variáveis                                               | Baixa — é bug da fábrica (`preator/`), fora do escopo de escrita deste projeto; contornado nesta história exportando manualmente |

## Riscos de implantação

| Risco                                                                                              | Severidade | Mitigação                                                                                                     |
| -------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID` configurado em produção sem nunca ter sido testado ponta-a-ponta neste ambiente | Média      | Testar o fluxo Google manualmente contra credencial real antes do primeiro deploy com login social habilitado |

## Validações obrigatórias para implantação

| Validação                                                           | Resultado esperado                   | Status                                                                     |
| ------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------- |
| Família B não vê convite/membro/evento da A                         | Bloqueado no servidor, REST e socket | Provado (teste automatizado)                                               |
| Convite expirado/usado é recusado                                   | Erro claro, sem criar membro         | Provado (teste automatizado)                                               |
| Mesmo email por Google e por senha vira o mesmo `Membro`            | Sem duplicar pessoa                  | Provado (teste automatizado)                                               |
| `/mais/convidar` e `/convite/:token` abrem sem erro de console/rede | Zero erro                            | Provado manualmente (Playwright ad hoc, fora do crawler — ver EF01-MC-003) |

## Pendências de decisão

_(nenhuma — as decisões desta história estavam fechadas em D-05 antes de codar; os itens acima são
lacunas técnicas e de cobertura de gate, não decisão de negócio em aberto)_

## Próximo passo

EF-02 (Contas) é a próxima história natural.

## Status final do ciclo

- [x] EF atualizada (DoD marcado, §6 com o que não foi construído)
- [x] MC criada, depois atualizada quando EF01-MC-001 foi fechada
- [x] MANUAL as-built criado, depois atualizado
- [x] Memória do condutor (`.motor/condutor-15.md`) atualizada
- [x] Issues #32, #33, #35, #36 e #15 carimbadas `provado`, com evidência comentada
- [x] PR aberto: [#34](https://github.com/cesarvieira/orcamento/pull/34)
