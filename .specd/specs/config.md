---
capability: config
retired: []
---

# Config, init e status

Resolução de configuração, bootstrap do projeto e relatório de situação.

### REQ-CFG-001 — Four-level precedence

**Statement.** The specd configuration resolver SHALL merge values in the order CLI flag, workspace file, global file, built-in default, with earlier sources winning field by field.

**Acceptance.**
- Flag sobrescreve workspace mesmo quando o workspace define o campo
- Merge é por campo, não por seção inteira

```yaml anchors
- file: src/config/resolve.ts
  symbol: "export function resolveConfig"
```

### REQ-CFG-002 — Unknown keys are rejected

**Statement.** The specd configuration resolver SHALL reject unknown keys and values of incorrect type at load time.

**Acceptance.**
- Chave não declarada no schema faz o comando sair com código 2
- Mensagem cita arquivo, chave e chaves válidas próximas

```yaml anchors
- file: src/config/schema.ts
  symbol: "ConfigSchema"
```

### REQ-CFG-003 — Credentials by environment reference

**Statement.** The specd configuration resolver SHALL read credentials only through the environment variable named in `token_env`, rejecting any literal token value in the configuration file.

**Acceptance.**
- Campo contendo algo que pareça token literal reprova o carregamento
- Variável ausente produz erro antes da primeira chamada de rede

```yaml anchors
- file: src/config/credentials.ts
  symbol: "export function resolveToken"
```

### REQ-CFG-004 — Init writes complete defaults

**Statement.** The specd init command SHALL write a configuration file containing every supported section with recommended default values and inline comments.

**Acceptance.**
- Arquivo gerado não é esqueleto vazio
- Rodar `verify` logo após `init` não produz erro de configuração

```yaml anchors
- file: src/init/config-template.ts
  symbol: "export const DEFAULT_CONFIG"
```

### REQ-CFG-005 — Init detects the stack

**Statement.** The specd init command SHALL propose a `validation_command` matching the build manifests found in the repository.

**Acceptance.**
- Presença de `package.json` propõe comando de teste do npm
- Presença de `pyproject.toml` propõe pytest
- Nenhuma detecção deixa o campo comentado com instrução

```yaml anchors
- file: src/init/detect-stack.ts
  symbol: "export function detectStack"
```

### REQ-CFG-006 — Status reports drift and pending work

**Statement.** The specd status command SHALL report dangling anchors, requirements without tasks, tasks marked done without evidence, and memory files exceeding their configured limits.

**Acceptance.**
- Saída agrupa por change ativa
- Comando retorna sempre código 0; ele informa, não julga

```yaml anchors
- file: src/status/index.ts
  symbol: "export async function status"
```
