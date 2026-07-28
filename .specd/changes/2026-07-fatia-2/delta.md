---
change: 2026-07-fatia-2
target: [spec-format, anchors, verify, archive, config, cli]
---

# Delta — Fatia 2

Fecha o ciclo change → verify → archive. Sob o Modelo B, este arquivo é a
superfície de escrita: o texto completo dos requisitos mora aqui até que
`specd archive` os aplique em `.specd/specs/`.

## ADDED

### REQ-FMT-004 — Retired identifiers are never reused

**Capability.** spec-format

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

**Capability.** spec-format

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

**Capability.** spec-format

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

**Capability.** spec-format

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

### REQ-ANC-007 — Archive tolerates nothing

**Capability.** anchors

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

**Capability.** anchors

**Statement.** WHEN `specd anchor fix` is invoked for a requirement holding a suggestion, specd SHALL rewrite the anchor to the suggested location and leave the change unstaged.

**Acceptance.**
- Arquivo de capability é modificado no disco
- Nenhum commit é criado automaticamente
- Âncora sem sugestão faz o comando sair com código 2, porque é recusa de agir e não veredito

```yaml anchors
- file: src/anchors/fix.ts
  symbol: "export async function fixAnchor"
```

### REQ-VER-004 — Coverage layer

**Capability.** verify

**Statement.** The specd verifier SHALL reject any change in which a requirement listed under ADDED or MODIFIED has no task referencing it.

**Acceptance.**
- REQ sem task apontando reprova
- Referência é o campo `req` do frontmatter da task, e nada mais
- Task em qualquer status conta como cobertura, inclusive `pending`
- Só tasks da própria change contam
- Requisito listado em `REMOVED` não exige task
- Task apontando para REQ inexistente reprova na camada schema, não aqui

```yaml anchors
- file: src/verify/layers/coverage.ts
  symbol: "export const coverageLayer"
```

### REQ-VER-005 — Evidence layer

**Capability.** verify

**Statement.** IF a task declares status `done`, THEN the specd verifier SHALL reject it when `evidence.commits` is empty.

**Acceptance.**
- Task `done` sem commits reprova
- Task em qualquer outro status não é avaliada

```yaml anchors
- file: src/verify/layers/evidence.ts
  symbol: "export const evidenceLayer"
```

### REQ-VER-010 — Unreachable commit is reported, not rejected

**Capability.** verify

**Statement.** IF a commit listed in `evidence.commits` is not reachable in the repository history, THEN the specd verifier SHALL report it as a warning.

**Acceptance.**
- SHA inalcançável produz warning e não reprova a camada
- Mensagem cita a task, o identificador e o SHA
- Squash, rebase e clone raso não reprovam o gate

Âncora prova que existe código agora; evidência prova que houve trabalho então.
São eixos diferentes, por P7. Um SHA que o histórico não alcança mais é sinal
degradado, não fraude: o fluxo de merge do projeto pode tê-lo reescrito. O que
permanece antifraude é `evidence.commits` vazio, que é declaração de trabalho
sem qualquer lastro, e esse continua reprovando por REQ-VER-005.

```yaml anchors
- file: src/verify/layers/evidence.ts
  symbol: "assertCommitsReachable"
```

### REQ-VER-011 — Evidence without history is operational

**Capability.** verify

**Statement.** WHEN the repository history is unavailable, the specd verifier SHALL exit with code 2 instead of producing a verdict for the evidence layer.

**Acceptance.**
- Diretório sem `.git` acessível sai com código 2
- Mensagem distingue "não consegui verificar" de "verifiquei e reprovou"
- Nenhuma violação de evidência é reportada quando o histórico falta

```yaml anchors
- file: src/verify/layers/evidence.ts
  symbol: "requireGitHistory"
```

### REQ-ARC-001 — Change is named explicitly

**Capability.** archive

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

**Capability.** archive

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

**Capability.** archive

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

**Capability.** archive

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

**Capability.** archive

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

**Capability.** archive

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

**Capability.** archive

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

**Capability.** archive

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

**Capability.** archive

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

**Capability.** archive

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

### REQ-CFG-007 — Requirement location is reported

**Capability.** config

**Statement.** The specd status command SHALL report, for every requirement identifier, the file that currently holds it and whether it is realized or in flight.

**Acceptance.**
- ID em `.specd/specs/` é reportado como realizado, com o caminho da capability
- ID em delta de change aberta é reportado como em voo, com o caminho e o nome da change
- ID presente nos dois é reportado como em modificação, com os dois caminhos
- ID desconhecido é reportado como tal, sem exit code diferente de zero

Sob o Modelo B o identificador continua estável e o endereço não. Sem este
relatório, achar um requisito passa a exigir busca em dois lugares.

```yaml anchors
- file: src/status/locate.ts
  symbol: "export function locateRequirement"
```

### REQ-CFG-008 — Open change age is reported

**Capability.** config

**Statement.** The specd status command SHALL report how long each open change has been open.

**Acceptance.**
- Idade vem da primeira aparição de `delta.md` no histórico
- Histórico indisponível reporta idade desconhecida, sem erro
- Change arquivada não aparece

```yaml anchors
- file: src/status/changes.ts
  symbol: "changeAge"
```

### REQ-CFG-009 — Warning debt per open change is reported

**Capability.** config

**Statement.** The specd status command SHALL report how many requirements each open change holds with a dangling anchor.

**Acceptance.**
- Contagem por change, não agregada
- Change com zero pendurada aparece com zero, não some
- Comando continua retornando código 0, por REQ-CFG-006

Change que segura órfão e não fecha rebaixa a warning tudo que lista. Idade e
dívida juntas tornam o encalhe visível sem que a ferramenta julgue.

```yaml anchors
- file: src/status/changes.ts
  symbol: "warningDebt"
```

## MODIFIED

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

## REMOVED

Nenhum.
