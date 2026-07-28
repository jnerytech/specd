---
capability: spec-format
retired: []
---

# Spec format — capabilities, requisitos, delta e task

Estrutura dos artefatos que o specd lê e valida.

**Requisito é maleável em voo e congela ao ser realizado.** Dividir, renomear ou
reescrever requisito que está num delta não custa nada: ele ainda não tem
identificador citado por task, nem âncora com histórico, nem código apontando
para ele. O mesmo em `.specd/specs/` custa churn de ID e perda de rastro de
âncora. Logo refatoração de requisito acontece antes do archive, não depois.

Isto é disciplina e não requisito porque não é checável por máquina — decidir se
uma reescrita melhorou o requisito é julgamento semântico, que P1 mantém fora do
caminho de decisão. O que a máquina checa é a consequência: sob o Modelo B, o
texto só entra em `specs/` pelo `archive`, e o `archive` só roda com âncora
resolvendo.

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

### REQ-FMT-008 — Anchors live on requirements

**Statement.** The specd parser SHALL accept anchor declarations only inside requirement blocks, in a fenced code block tagged `yaml anchors`.

**Acceptance.**
- Bloco `yaml anchors` dentro de task é ignorado com warning
- Cada entrada exige `file`; `symbol` é opcional

```yaml anchors
- file: src/parser/anchors.ts
  symbol: "export function parseAnchorBlock"
```
