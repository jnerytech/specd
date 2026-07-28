---
capability: anchors
retired: []
---

# Anchors — ligação verificável entre spec e código

O diferencial do specd. Uma âncora declara onde um requisito é realizado no código, e a escada de resolução decide de forma determinística se ela ainda segura.

### REQ-ANC-001 — Anchor shape

**Statement.** The specd anchor resolver SHALL accept anchors composed of a required `file` path and an optional `symbol` string.

**Acceptance.**
- `{file}` sem `symbol` é válido
- `{symbol}` sem `file` reprova
- `file` é resolvido a partir da raiz do repositório

```yaml anchors
- file: src/anchors/model.ts
  symbol: "export interface Anchor"
```

### REQ-ANC-002 — Deterministic resolution ladder

**Statement.** The specd anchor resolver SHALL evaluate each anchor through an ordered five-step ladder and return the first matching outcome.

**Acceptance.**
- Passo 1: arquivo inexistente devolve `dangling`
- Passo 2: âncora sem `symbol` com arquivo existente devolve `resolved`
- Passo 3: estratégia grep encontrando a string devolve `resolved`
- Passo 4: estratégia treesitter encontrando a declaração devolve `resolved`
- Passo 5: busca no repositório inteiro devolve `dangling-with-suggestion` ou `dangling`
- A mesma entrada produz sempre a mesma saída

```yaml anchors
- file: src/anchors/resolve.ts
  symbol: "export function resolveAnchor"
- file: test/anchors/ladder.test.ts
  symbol: "resolution ladder"
```

### REQ-ANC-003 — Repository-wide fallback search

**Statement.** WHEN a symbol is not found in its declared file, the specd anchor resolver SHALL search the repository for that symbol and attach the location as a suggestion if exactly one match exists.

**Acceptance.**
- Exatamente um match produz `dangling-with-suggestion` contendo o caminho encontrado
- Zero ou múltiplos matches produzem `dangling` sem sugestão
- A busca respeita `.gitignore`

```yaml anchors
- file: src/anchors/search.ts
  symbol: "export function findSymbolInRepo"
```

### REQ-ANC-004 — Strategy selected by file extension

**Statement.** The specd anchor resolver SHALL select the matching strategy by file extension, falling back to the configured default when no extension mapping exists.

**Acceptance.**
- `.yml` mapeado para grep usa grep mesmo com default treesitter
- Extensão não mapeada usa `anchors.default`

```yaml anchors
- file: src/anchors/strategy.ts
  symbol: "export function strategyFor"
```

### REQ-ANC-005 — Grep is the only v1 strategy

**Statement.** The specd anchor resolver SHALL implement grep as the only version 1 strategy, reporting a configuration error when treesitter is requested.

**Acceptance.**
- `strategy = "treesitter"` no TOML produz erro de configuração legível
- Nenhuma dependência de gramática WASM entra no bundle da v1

```yaml anchors
- file: src/anchors/strategies/grep.ts
  symbol: "export const grepStrategy"
```

### REQ-ANC-006 — Graduated policy

**Statement.** The specd verifier SHALL grade a dangling anchor by the origin of its requirement, treating `.specd/specs/` as realized and a change delta as work in flight.

**Acceptance.**
- Requisito de `.specd/specs/` com âncora pendurada produz erro sob `graduated`
- Requisito de delta de change aberta produz warning sob `graduated`
- `strict` produz erro nas duas origens
- `lenient` produz warning nas duas origens
- Nenhuma consulta a "change ativa" participa da decisão

```yaml anchors
- file: src/verify/layers/anchors.ts
  symbol: "applyAnchorPolicy"
```

### REQ-ANC-007 — Archive tolerates nothing

**Statement.** The specd archive command SHALL reject the operation when any anchor of any affected requirement is dangling, regardless of the configured policy.

**Acceptance.**
- Política `lenient` não afeta o comportamento do archive
- Mensagem lista todas as âncoras penduradas antes de abortar
- Afetado é o requisito citado em `ADDED` ou `MODIFIED` da change sendo arquivada

```yaml anchors
- file: src/archive/index.ts
  symbol: "assertAllAnchorsResolved"
```

### REQ-ANC-008 — Fix rewrites with review

**Statement.** WHEN `specd anchor fix` is invoked for a requirement holding a suggestion, specd SHALL rewrite the anchor to the suggested location and leave the change unstaged.

**Acceptance.**
- Arquivo de capability é modificado no disco
- Nenhum commit é criado automaticamente
- Âncora sem sugestão faz o comando sair com código 2, porque é recusa de agir e não veredito

```yaml anchors
- file: src/anchors/fix.ts
  symbol: "export async function fixAnchor"
```
