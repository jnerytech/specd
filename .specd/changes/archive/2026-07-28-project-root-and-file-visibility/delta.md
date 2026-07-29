---
change: 2026-07-28-project-root-and-file-visibility
target: [config, anchors, verify]
---

# Delta — project-root-and-file-visibility

Fazer o specd funcionar fora deste repositório. Todos os requisitos abaixo saem
de defeitos observados rodando a ferramenta contra um ERP .NET real de 206
arquivos — nenhum foi imaginado.

## ADDED

### REQ-CFG-010 — Project root is the directory holding `.specd/`

**Capability.** config

**Statement.** The specd CLI SHALL treat as the project root the nearest directory at or above the working directory that contains `.specd/`.

**Acceptance.**
- Rodar de um subdiretório resolve a mesma raiz que rodar da raiz
- Raiz não depende de existir repositório git
- Raiz não depende de o diretório ser ignorado por um repositório pai
- Ausência de `.specd/` em qualquer ancestral sai com código 2

Havia duas definições concorrentes de raiz dentro do mesmo comando: o passo 3 da
escada resolvia caminho a partir do `cwd` e o passo 5 listava arquivos a partir
do toplevel do git. Elas divergem exatamente no caso que motivou esta change — um
projeto specd dentro de uma árvore ignorada pelo repositório pai. Projeto specd é
definido por ter `.specd/`, e nada mais.

```yaml anchors
- file: src/core/root.ts
  symbol: "export function findProjectRoot"
```

### REQ-ANC-009 — Listing falls back to the filesystem

**Capability.** anchors

**Statement.** IF listing the repository with git yields no file, THEN the specd anchor resolver SHALL walk the filesystem from the project root instead.

**Acceptance.**
- Git que falha cai para a caminhada
- Git que sucede e devolve zero arquivos também cai para a caminhada
- Git que devolve ao menos um arquivo é usado, e `.gitignore` continua respeitado
- A caminhada pula `.git`, `node_modules` e diretórios de build

Git sucedendo com zero resultados não é repositório vazio: é o listador cego. Em
diretório ignorado pelo repositório pai, `git ls-files` sai 0 e devolve nada, e a
escada perdia o passo 5 inteiro sem que nada acusasse.

```yaml anchors
- file: src/anchors/search.ts
  symbol: "export function listRepository"
```

### REQ-ANC-010 — A match is an identifier, not a substring

**Capability.** anchors

**Statement.** The specd anchor resolver SHALL consider a symbol matched only where it is delimited by characters that cannot belong to an identifier.

**Acceptance.**
- `TenantAccessor` não casa `TenantAccessorRegisterMiddleware`
- `Enrollment` não casa `EnrollmentRepository`
- Símbolo seguido de `(`, `:`, espaço, aspas ou fim de linha casa
- A regra vale igualmente no passo 3 e na busca do passo 5

Substring era a escolha implícita, e ela colide com prefixo de identificador
mais longo. O caso não é hipotético: num repositório real, `public class
TenantAccessor` casava também `public class TenantAccessorRegisterMiddleware`, e
a escada recusava sugestão por ambiguidade que não existia — acertando o
resultado pelo motivo errado.

```yaml anchors
- file: src/anchors/strategies/grep.ts
  symbol: "export const grepStrategy"
```

### REQ-ANC-011 — Suggestion discards terms that match too widely

**Capability.** anchors

**Statement.** The specd anchor suggester SHALL discard any candidate term that matches more files than the configured ceiling.

**Acceptance.**
- Termo que casa acima do teto não aparece no relatório
- O relatório diz quantos termos foram descartados e por quê
- Termo descartado nunca vira sugestão, mesmo sem alternativa

Um termo que casa cento e dezenove arquivos não é símbolo, é namespace. Num
repositório onde o nome do produto é a raiz de todo namespace, o extrator
produzia quinze candidatas e nenhuma utilizável — relatório que ninguém lê é
pior que relatório vazio, porque custa a leitura antes de ser descartado.

```yaml anchors
- file: src/anchors/suggest.ts
  symbol: "TERM_FILE_CEILING"
```

### REQ-VER-012 — The anchors layer reports how the repository was listed

**Capability.** verify

**Statement.** The specd verifier SHALL record in the anchors layer report which listing mode was used and how many files it saw.

**Acceptance.**
- O relatório nomeia o modo, `git` ou `walk`
- O relatório traz a contagem de arquivos enxergados
- Zero arquivos enxergados produz warning, mesmo com toda âncora resolvendo
- A mensagem diz que o passo 5 não pode sugerir nada nesse estado

absence-is-not-compliance. Verde não pode significar duas coisas diferentes: "toda âncora resolve" e
"toda âncora resolve, e se uma quebrasse eu saberia onde procurar" são estados
distintos, e o relatório não os separava.

```yaml anchors
- file: src/verify/layers/anchors.ts
  symbol: "export const anchorsLayer"
- file: src/verify/report.ts
  symbol: "export interface LayerReport"
```

## MODIFIED

### REQ-ANC-001 — Anchor shape

**Statement.** The specd anchor resolver SHALL accept anchors composed of a required `file` path and an optional `symbol` string.

**Acceptance.**
- `{file}` sem `symbol` é válido
- `{symbol}` sem `file` reprova
- `file` é resolvido a partir da raiz do projeto, como REQ-CFG-010 a define

```yaml anchors
- file: src/anchors/model.ts
  symbol: "export interface Anchor"
```

### REQ-CFG-004 — Init writes complete defaults

**Statement.** The specd init command SHALL write a configuration file containing every supported section with recommended default values and inline comments.

**Acceptance.**
- Arquivo gerado não é esqueleto vazio
- Rodar `verify` logo após `init` não produz erro de configuração
- `verify.levels` lista todas as camadas de `LAYER_ORDER`, sem omitir nenhuma implementada
- Os diretórios criados são exatamente `.specd/specs/`, `.specd/changes/` e `.specd/changes/archive/`

O terceiro critério é gatilhável: um teste compara o template com `LAYER_ORDER`
e reprova quando divergem. O quarto corrige diretório órfão — `init` criava
`.specd/archive/`, que nenhum comando lê, enquanto `archive` escreve dentro de
`changes/`.

```yaml anchors
- file: src/init/config-template.ts
  symbol: "export const DEFAULT_CONFIG"
```

### REQ-CFG-005 — Init detects the stack

**Statement.** The specd init command SHALL propose a `validation_command` matching the build manifests found in the repository, naming any manifest it recognised without knowing a command for it.

**Acceptance.**
- Presença de `package.json` propõe comando de teste do npm
- Presença de `pyproject.toml` propõe pytest
- Presença de `.sln` ou `.csproj` propõe `dotnet test`
- Presença de `Makefile` propõe o alvo de verificação encontrado nele
- Manifesto reconhecido sem comando conhecido deixa o campo comentado e **nomeia o manifesto encontrado**
- Nenhum manifesto encontrado deixa o campo comentado e diz isso

A honestidade sobre a falha faz parte da mesma cláusula, e não de um segundo
`SHALL`: propor e dizer o que se encontrou ao não conseguir propor são o mesmo
comportamento. Separá-los deixaria o gate aceitar uma mensagem falsa desde que o
campo ficasse comentado — que é exatamente o que acontecia, com `init` afirmando
"no build manifest recognised" num repositório com um `.sln` na raiz e doze
`.csproj`.

```yaml anchors
- file: src/init/detect-stack.ts
  symbol: "export function detectStack"
```

## REMOVED

Nenhum.
