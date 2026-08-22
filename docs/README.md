# Documentação

| Documento | Dono de… |
|---|---|
| [DOMINIO.md](DOMINIO.md) | o modelo e a linguagem ubíqua. O **lastro** está aqui. |
| [REGRAS-DE-NEGOCIO.md](REGRAS-DE-NEGOCIO.md) | as regras numeradas, `RN-XXX-NNN`. Cada uma vira teste. |
| [PADROES.md](PADROES.md) | como se escreve código aqui — dinheiro, datas, módulos, testes. |
| [AMBIENTE.md](AMBIENTE.md) | portas, composes, `.env`, e como os gates provam. |
| [APRENDIZADOS.md](APRENDIZADOS.md) | o que já custou caro. **Leia antes de codar.** |
| [decisoes/](decisoes/) | os ADRs — por que cada coisa é como é. |

**Fato duplicado é bug.** Cada documento é dono de um assunto; os outros apontam para ele em vez
de repetir. Se você precisar mudar uma regra, mude no dono e conserte os ponteiros.

---

## Ordem de leitura

**Chegando agora:** [../README.md](../README.md) → [APRENDIZADOS.md](APRENDIZADOS.md) →
[DOMINIO.md](DOMINIO.md).

**Vai implementar uma fatia:** a issue → [REGRAS-DE-NEGOCIO.md](REGRAS-DE-NEGOCIO.md) (as RN que
ela cita) → [PADROES.md](PADROES.md) → o ADR relevante.

**Vai decidir algo novo:** [decisoes/](decisoes/) primeiro, para não rediscutir o que já foi
fechado.

---

## Decisões

Seis ADRs, indexados em **[decisoes/](decisoes/)** — com o mapa de dependência entre eles, a
tabela de "qual ADR responde a qual pergunta" e o modelo para escrever um novo.

O [ADR-002](decisoes/ADR-002-orcamento-por-envelope-com-lastro.md) é a espinha: define o produto,
e o 003 e o 004 existem por causa dele.
