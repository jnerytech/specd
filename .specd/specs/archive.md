---
capability: archive
retired: []
---

### REQ-ARC-001 — Change is named explicitly

**Statement.** The specd archive command SHALL require the name of the change to archive as an explicit argument.

**Acceptance.**
- Comando sem argumento sai com código 2 e lista as changes abertas
- Nome inexistente sai com código 2
- Nenhuma inferência por data, ordem ou quantidade de changes abertas

Com changes abertas concorrentes, inferir é adivinhar. P4.

```yaml anchors
- file: src/archive/index.ts
  symbol: "export async function archive"
```

### REQ-ARC-002 — Preconditions gate the operation

**Statement.** The specd archive command SHALL exit with code 2 without writing anything when the change fails the coverage, evidence or anchor preconditions.

**Acceptance.**
- Requisito em `ADDED` ou `MODIFIED` sem task apontando aborta, por REQ-VER-004
- Task `done` com `evidence.commits` vazio aborta, por REQ-VER-005
- Âncora pendurada de requisito afetado aborta, por REQ-ANC-007
- Nenhum arquivo é escrito e nenhum diretório é movido quando aborta
- Mensagem nomeia `specd verify` como o lugar do veredito

```yaml anchors
- file: src/archive/index.ts
  symbol: "assertArchivable"
```

### REQ-ARC-003 — ADDED inserts a new section

**Statement.** WHEN a requirement appears under `ADDED`, the specd archive command SHALL insert its text as a new section in the capability named by its `**Capability.**` field.

**Acceptance.**
- Seção é acrescentada ao fim do arquivo da capability
- Linha `**Capability.**` é removida na inserção; o frontmatter do arquivo já a declara
- Capability inexistente faz o arquivo ser criado com frontmatter `capability` e `retired` vazio
- ID já presente como seção ativa aborta

```yaml anchors
- file: src/archive/apply.ts
  symbol: "insertRequirement"
```

### REQ-ARC-004 — MODIFIED replaces the whole section

**Statement.** WHEN a requirement appears under `MODIFIED`, the specd archive command SHALL replace the entire existing section with the delta text.

**Acceptance.**
- Nenhuma parte da seção antiga sobrevive
- Posição da seção no arquivo é preservada
- ID ausente de toda capability aborta
- ID presente em mais de uma capability aborta como conflito

```yaml anchors
- file: src/archive/apply.ts
  symbol: "replaceRequirement"
```

### REQ-ARC-005 — REMOVED deletes the section and retires the identifier

**Statement.** WHEN an identifier appears under `REMOVED`, the specd archive command SHALL delete its section and append the identifier to the `retired` list of its capability.

**Acceptance.**
- Seção desaparece do arquivo
- ID passa a constar em `retired`
- ID já presente em `retired` aborta

```yaml anchors
- file: src/archive/apply.ts
  symbol: "retireRequirement"
```

### REQ-ARC-006 — Archive destination preserves the change name

**Statement.** The specd archive command SHALL move the change directory into `.specd/changes/archive/` preserving its directory name.

**Acceptance.**
- `2026-07-fatia-1` vira `.specd/changes/archive/2026-07-fatia-1`
- Nenhum prefixo de data é acrescentado, porque o nome da change já carrega data
- Destino já existente aborta sem mover nada
- `archive/` nunca é tratado como change aberta

```yaml anchors
- file: src/archive/index.ts
  symbol: "archiveDestination"
```

### REQ-ARC-007 — No commit is created

**Statement.** The specd archive command SHALL leave every file it writes and moves unstaged.

**Acceptance.**
- Nenhum commit é criado
- Nenhum `git add` é executado
- Saída instrui revisar o diff antes de commitar

`archive` reescreve o contrato. P4 exige revisão humana entre a máquina propor e
o repositório aceitar.

```yaml anchors
- file: src/archive/index.ts
  symbol: "export async function archive"
```

### REQ-ARC-008 — Memory travels with the change

**Statement.** The specd archive command SHALL move the change's `memory/` directory along with the change without copying its content into any capability.

**Acceptance.**
- `memory/` acompanha o diretório arquivado
- Nenhum conteúdo de memória aparece em `.specd/specs/`
- Ausência de `memory/` não é erro

Efêmera por P6 significa não-autoritativa, não destruída. Apagar é irreversível
e não compra nada; carregar preserva a trilha a custo zero. O que P6 exige é que
nada de `memory/` vire contrato, e é o segundo critério que trava isso.

```yaml anchors
- file: src/archive/index.ts
  symbol: "export async function archive"
```

### REQ-ARC-009 — Validation precedes every write

**Statement.** The specd archive command SHALL compute and validate the new content of every affected capability before writing any of them, moving the change directory last.

**Acceptance.**
- Conflito em qualquer capability impede a escrita de todas
- O movimento do diretório é a última operação
- Falha de escrita em uma capability não deixa outra pela metade

```yaml anchors
- file: src/archive/apply.ts
  symbol: "planApplication"
```

### REQ-ARC-010 — Reapplication is idempotent by content

**Statement.** IF a capability already contains a requirement that the delta declares under `ADDED` with identical text, THEN the specd archive command SHALL treat it as already applied instead of aborting.

**Acceptance.**
- Rerodada depois de falha no movimento do diretório conclui a operação
- Texto divergente sob o mesmo ID aborta como conflito
- Nenhuma seção é duplicada
- A comparação ignora a linha `**Capability.**`, que a inserção remove

Par de REQ-ARC-009. Sem ele, falha entre escrever as capabilities e mover o
diretório deixa o operador sem caminho de volta, porque REQ-ARC-003 abortaria por
ID duplicado na segunda tentativa.

```yaml anchors
- file: src/archive/apply.ts
  symbol: "alreadyApplied"
```
