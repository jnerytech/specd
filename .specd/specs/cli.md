---
capability: cli
retired: []
---

# CLI — superfície e contrato de execução

Comandos, códigos de saída e regras invioláveis de comportamento da CLI `specd`.

### REQ-CLI-001 — Single gate

**Statement.** The specd CLI SHALL expose exactly one command that returns a non-zero exit code as a quality gate, namely `specd verify`.

**Acceptance.**
- Nenhum outro comando retorna exit code 1 por reprovação de qualidade
- `explore`, `sync` e `archive` retornam não-zero apenas por falha operacional (rede, I/O, argumento inválido)

```yaml anchors
- file: src/cli/index.ts
  symbol: "registerCommands"
- file: src/verify/index.ts
  symbol: "export async function verify"
```

### REQ-CLI-002 — No LLM in the decision path

**Statement.** The specd CLI SHALL NOT invoke any language model when computing the result of `verify`.

**Acceptance.**
- Nenhum módulo alcançável a partir de `verify()` importa cliente de LLM
- Teste automatizado falha se `src/verify/**` importar de `src/llm/**`

```yaml anchors
- file: src/verify/index.ts
  symbol: "export async function verify"
- file: test/architecture/no-llm-in-verify.test.ts
  symbol: "no-llm-in-verify"
```

### REQ-CLI-003 — Never guess on conflict

**Statement.** IF specd encounters an ambiguous or conflicting state, THEN specd SHALL exit non-zero with a diagnostic listing the conflict instead of resolving it automatically.

**Acceptance.**
- Âncora com múltiplos candidatos não é reescrita automaticamente
- Conflito de sync interrompe a operação e lista os itens afetados

```yaml anchors
- file: src/core/conflict.ts
  symbol: "class ConflictError"
```

### REQ-CLI-004 — Exit code contract

**Statement.** The specd CLI SHALL use exit code 0 for success, 1 for gate failure, and 2 for operational failure.

**Acceptance.**
- Falha de rede no `explore` retorna 2, não 1
- Âncora pendurada em contexto de erro retorna 1
- CI consegue distinguir "spec reprovou" de "ferramenta quebrou"

```yaml anchors
- file: src/cli/exit-codes.ts
  symbol: "export const EXIT"
```

### REQ-CLI-005 — Offline gate

**Statement.** The specd CLI SHALL NOT perform network access during `verify`.

**Acceptance.**
- Teste de arquitetura falha se `src/verify/**` importar módulo de rede
- `verify` roda com sucesso sem conectividade

```yaml anchors
- file: src/verify/index.ts
  symbol: "export async function verify"
- file: test/architecture/no-network-in-verify.test.ts
  symbol: "no-network-in-verify"
```

### REQ-CLI-006 — Zero-install distribution

**Statement.** The specd package SHALL expose a `specd` binary executable via `npx` without prior installation.

**Acceptance.**
- `package.json` declara `bin.specd`
- `npx specd verify` funciona em diretório limpo
- Nenhuma dependência nativa ou passo de build no cliente

```yaml anchors
- file: package.json
  symbol: "\"bin\""
