---
capability: cli
retired: []
---

# CLI — superfície e contrato de execução

Comandos, códigos de saída e regras invioláveis de comportamento da CLI `specd`.

### REQ-CLI-001 — Single gate

**Statement.** The specd CLI SHALL expose exactly one command whose non-zero exit code is a verdict on quality, namely `specd verify`.

**Acceptance.**
- Nenhum outro comando retorna exit code 1
- Comando que não pode agir porque a qualidade não permite retorna 2 e nomeia `specd verify`
- `explore`, `sync` e `archive` retornam não-zero apenas por falha operacional ou recusa de agir

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
- Comando que recusa agir por precondição de qualidade retorna 2
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
- `package.json` declara `bin.specd` e inclui `dist` em `files`
- O tarball empacotado instala e expõe um binário `specd` funcional
- Nenhuma dependência nativa ou passo de build no cliente
- Nenhuma gramática WASM entra no bundle

Que `npx specd` resolva para este pacote depende de reservar o nome sem escopo no registry. É fato de registry, não propriedade do código: verificável só publicando, e por isso está no pré-requisito operacional da change, não aqui.

```yaml anchors
- file: package.json
  symbol: "\"bin\""
```

### REQ-CLI-007 — The README names an invocation that works before publication

**Statement.** The README SHALL document how to build and run specd from a clone, for as long as the package is absent from the registry.

**Acceptance.**

- README mostra a sequência que leva de clone a comando funcionando
- O caminho do executável citado é o mesmo que `package.json` declara em `bin`
- Teste falha se `bin` mudar e o README não acompanhar
- `npx specd` continua documentado como o caminho de quem instala, com a ressalva de que ainda não está publicado

É a única parede absoluta do onboarding e está no primeiro passo: `npx specd`
devolve 404 e nenhum documento diz o que fazer em vez disso. Quem para no
primeiro comando não vira usuário, e o produto morre onde ninguém olha.

O acoplamento com `bin` é o pedaço que dá para verificar. O resto continua sendo
prosa, e está declarado como tal no proposal.

```yaml anchors
- file: test/distribution/readme.test.ts
  symbol: "README names the bin path"
```
