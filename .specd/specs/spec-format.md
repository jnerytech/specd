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

### REQ-FMT-004 — Retired identifiers are never reused

**Statement.** IF a requirement identifier appears in the `retired` list of its capability, THEN specd SHALL reject any active requirement using that identifier.

**Acceptance.**
- ID em `retired` reaparecendo como seção ativa reprova
- Mensagem cita a change que aposentou o ID, quando conhecida
- Requisito de delta de change aberta também conta como ativo

```yaml anchors
- file: src/verify/layers/schema.ts
  symbol: "checkRetiredReuse"
```

### REQ-FMT-005 — Delta declares three sections

**Statement.** The specd parser SHALL read `delta.md` as three optional sections named `ADDED`, `MODIFIED` and `REMOVED`.

**Acceptance.**
- Seção com nome fora do conjunto reprova
- `ADDED` e `MODIFIED` contêm blocos de requisito em heading de nível 3, na mesma forma dos arquivos de capability
- `REMOVED` aceita apenas lista de identificadores, sem corpo
- Bloco em `ADDED` declara `**Capability.**` com a capability de destino
- Bloco em `MODIFIED` pode omitir `**Capability.**`; o destino é a capability que já contém o identificador
- Identificador repetido em mais de uma seção do mesmo delta reprova

```yaml anchors
- file: src/parser/delta.ts
  symbol: "export function parseDelta"
```

### REQ-FMT-006 — ADDED and MODIFIED carry full text

**Statement.** WHEN a requirement appears under `ADDED` or `MODIFIED`, the specd parser SHALL require the complete requirement text including statement, acceptance and anchors.

**Acceptance.**
- Bloco sem `**Statement.**` reprova
- Bloco sem `**Acceptance.**` reprova
- Nenhuma sintaxe de patch é interpretada
- Bloco sem bloco de âncoras é aceito, porque âncora é opcional por REQ-ANC-001

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
- Task é lida de `tasks/*.md` dentro do diretório da change

```yaml anchors
- file: src/parser/task.ts
  symbol: "TaskFrontmatterSchema"
```

### REQ-FMT-009 — Unreadable delta content is rejected, never ignored

**Statement.** IF a delta section contains content that is neither a requirement block nor a requirement identifier, THEN the specd parser SHALL reject the delta.

**Acceptance.**
- Seção `ADDED` ou `MODIFIED` com conteúdo e nenhum bloco de requisito reprova
- Item de lista citando identificador fora de qualquer bloco, em `ADDED` ou `MODIFIED`, reprova
- Seção `REMOVED` com linha que não é identificador reprova
- Seção sem conteúdo algum é aceita
- Marcador explícito de vazio — `Nenhum.` ou `None.` — é aceito em qualquer seção
- Prosa antes do primeiro bloco é aceita quando a seção tem ao menos um bloco

A distinção entre seção legitimamente vazia e seção que o parser não entende é
o requisito inteiro. Uma change sem remoções escreve `REMOVED` vazio e isso é
verdade; uma change cujo `ADDED` lista quarenta identificadores em bullets tem
conteúdo que o parser lê como nada, e ler nada como conformidade é o modo de
falha que a Fatia 2 expôs ao arquivar a Fatia 1 sem verificar coisa alguma.

Mesma família da passagem vazia: ausência de dados apresentada como aprovação.

```yaml anchors
- file: src/parser/delta.ts
  symbol: "assertSectionReadable"
```
