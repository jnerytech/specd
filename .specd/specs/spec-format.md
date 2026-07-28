---
capability: spec-format
retired: []
---

# Spec format — capabilities, requisitos, delta e task

Estrutura dos artefatos que o specd lê e valida.

### REQ-FMT-001 — Capability file layout

**Statement.** The specd parser SHALL read each capability as a Markdown file under `.specd/specs/` containing YAML frontmatter with `capability` and `retired`, followed by requirements as level-3 headings.

**Acceptance.**
- Frontmatter ausente ou sem `capability` reprova
- Cada heading `### REQ-…` vira um requisito no modelo interno

```yaml anchors
- file: src/parser/capability.ts
  symbol: "export function parseCapability"
```

### REQ-FMT-002 — Requirement identifier format

**Statement.** The specd parser SHALL accept requirement identifiers matching `^REQ-[A-Z][A-Z0-9]*-\d{3}$` and reject any other form.

**Acceptance.**
- `REQ-AUTH-003` aceito
- `REQ-auth-3` rejeitado
- Prefixo não precisa igualar o nome da capability, mas divergência gera warning

```yaml anchors
- file: src/parser/requirement-id.ts
  symbol: "REQ_ID_PATTERN"
```

### REQ-FMT-003 — Requirements carry no status

**Statement.** The specd parser SHALL reject any requirement that declares a `status` field.

**Acceptance.**
- Requisito com `status:` reprova na camada schema
- Mensagem de erro aponta que status pertence à task

```yaml anchors
- file: src/parser/requirement.ts
  symbol: "assertNoStatus"
```

### REQ-FMT-004 — Retired identifiers are never reused

**Statement.** IF a requirement identifier appears in the `retired` list of its capability, THEN specd SHALL reject any active requirement using that identifier.

**Acceptance.**
- ID em `retired` reaparecendo como seção ativa reprova
- Mensagem cita a change que aposentou o ID, quando conhecida

```yaml anchors
- file: src/verify/layers/schema.ts
  symbol: "checkRetiredReuse"
```

### REQ-FMT-005 — Delta declares three sections

**Statement.** The specd parser SHALL read `delta.md` as three optional sections named `ADDED`, `MODIFIED` and `REMOVED`, each listing requirements by identifier.

**Acceptance.**
- Seção com nome fora do conjunto reprova
- `REMOVED` aceita apenas lista de identificadores, sem corpo

```yaml anchors
- file: src/parser/delta.ts
  symbol: "export function parseDelta"
```

### REQ-FMT-006 — MODIFIED carries full text

**Statement.** WHEN a requirement appears under `MODIFIED`, the specd parser SHALL require the complete replacement text including statement, acceptance and anchors.

**Acceptance.**
- Bloco `MODIFIED` sem `**Statement.**` reprova
- Nenhuma sintaxe de patch é interpretada

```yaml anchors
- file: src/parser/delta.ts
  symbol: "assertFullReplacement"
```

### REQ-FMT-007 — Task frontmatter schema

**Statement.** The specd parser SHALL require every task file to declare `id`, `change`, `req`, `status` and `evidence` in YAML frontmatter.

**Acceptance.**
- `req` é lista não vazia de identificadores existentes
- `status` pertence a `pending | in_progress | done | blocked`
- `evidence.commits` é lista, possivelmente vazia

```yaml anchors
- file: src/parser/task.ts
  symbol: "TaskFrontmatterSchema"
```

### REQ-FMT-008 — Anchors live on requirements

**Statement.** The specd parser SHALL accept anchor declarations only inside requirement blocks, in a fenced code block tagged `yaml anchors`.

**Acceptance.**
- Bloco `yaml anchors` dentro de task é ignorado com warning
- Cada entrada exige `file`; `symbol` é opcional

```yaml anchors
- file: src/parser/anchors.ts
  symbol: "export function parseAnchorBlock"
```
