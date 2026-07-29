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

### REQ-ARC-011 — Archive syncs only when asked

**Statement.** WHERE the `--sync` flag is given, the specd archive command SHALL run the board reconciliation after the capabilities have been written.

**Acceptance.**

- Sem `--sync`, nenhuma requisição ao board é feita
- Com `--sync`, a reconciliação roda depois de as capabilities estarem escritas
- Com `--sync` e sem board configurado, sai 2 antes de aplicar o delta
- Não existe `--no-sync`: a ausência da flag já é o não

REQ-SYNC-001 diz que o `sync` escreve no board só quando invocado diretamente
por uma pessoa. `archive` sincronizando por conta própria quebra o requisito;
`archive --sync` não, porque continua sendo alguém digitando — e a escrita
externa continua declarada, que é P9.

A flag existe em vez de só um aviso porque o modo de falha do aviso é esquecer,
e esquecer é o caso comum. Ela transforma dois comandos num ato deliberado sem
transformar nenhum ato em automático.

Não existe `--no-sync` porque duas flags para um booleano é botão sem dois
clientes divergindo, que é P5.

```yaml anchors
- file: src/archive/index.ts
  symbol: "export interface ArchiveOptions"
```

### REQ-ARC-012 — A failed sync never undoes the archive

**Statement.** IF the board reconciliation fails after the capabilities have been written, THEN the specd archive command SHALL exit with code 2 leaving the written capabilities and the archived directory in place.

**Acceptance.**

- Capabilities escritas permanecem escritas, e fora do índice do git
- O diretório da change permanece movido para `archive/`
- A mensagem diz que a spec avançou e o board não, e manda rodar `specd sync`
- Rodar `specd sync` em seguida alcança o board sem repetir o archive

A ordem é `archive` primeiro e `sync` depois, e ela é escolhida: a spec adiante
do board é recuperável por um comando idempotente, enquanto o board adiante da
spec deixa card para requisito que o repositório não reconhece.

Desfazer o `archive` seria pior que as duas. O que ele escreveu está correto e
está fora do índice, ao alcance da revisão — desfazer destrói trabalho bom por
causa de uma falha de rede, e é exatamente a decisão silenciosa que P9 proíbe.

```yaml anchors
- file: src/archive/index.ts
  symbol: "export class ArchiveSyncError"
```

### REQ-ARC-013 — Archive without the flag reports what stayed out of sync

**Statement.** WHERE a board is configured and `--sync` is absent, the specd archive command SHALL report how many archived items have no board link or a stale one.

**Acceptance.**

- Contagem aparece na saída do `archive`, nomeando o comando que a resolve
- Sem board configurado, nada é reportado e nada é contado
- A contagem é obtida sem requisição ao board, a partir das ligações gravadas
- Contagem zero é dita explicitamente, e não omitida

Sem isto, "rode `specd sync` depois" é prosa, e prosa não tem contrato — que é o
defeito que esta fatia inteira ataca. Requisito com critério de aceite é a
diferença entre um lembrete que se apaga e um comportamento que se testa.

A contagem não consulta o board de propósito. `archive` sem `--sync` não toca a
rede, e um relatório que precisasse dela falharia offline — informação sobre
sincronia virando motivo para não conseguir arquivar.

```yaml anchors
- file: src/archive/index.ts
  symbol: "export function countUnsyncedItems"
```
