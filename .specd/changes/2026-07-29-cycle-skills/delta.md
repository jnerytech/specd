---
change: 2026-07-29-cycle-skills
target: [effective-spec, skills, config, spec-format, explore, sync, archive]
---

# Delta — cycle-skills

O ciclo passa a ter skills próprias, e o CLI ganha os quatro comandos e campos
que elas precisariam inventar sozinhas.

## ADDED

### REQ-EFF-001 — The effective spec is a command, not a reconstruction

**Capability.** effective-spec

**Statement.** The specd spec command SHALL emit every requirement of the effective specification, being the capabilities under `.specd/specs/` with the deltas of the open changes applied over them.

**Acceptance.**

- Requisito presente só em `.specd/specs/` aparece uma vez
- Requisito de `ADDED` de change aberta aparece
- Requisito de `MODIFIED` aparece com o texto do delta, e não com o de `.specd/specs/`
- Identificador listado em `REMOVED` não aparece
- Diretório sem `.specd/` sai 2 nomeando o caminho procurado

`effectiveSpecs` já existe e já é a fonte de `verify`, `status`, `sync` e
`anchor fix`. O que falta é a saída. Sem ela, quem precisa da spec efetiva lê os
arquivos soltos e aplica o overlay de cabeça — e passa a existir uma segunda
implementação da regra, na camada que não é determinística.

```yaml anchors
- file: src/spec/index.ts
  symbol: "export function specReport"
```

### REQ-EFF-002 — Every requirement says where it is written

**Capability.** effective-spec

**Statement.** The specd spec command SHALL report, for every requirement it emits, whether it comes from the capabilities or from a delta, and the path of the file it was read from.

**Acceptance.**

- `origin` pertence a `specs | delta`
- `origin: delta` acompanha o nome da change que o declara
- `source` é caminho relativo à raiz do projeto
- `--json` carrega a mesma informação que a saída de texto

Origem não é metadado decorativo: é o que decide se âncora pendurada é erro ou
warning. Quem consome a spec efetiva sem saber a origem de cada requisito não
consegue distinguir drift de trabalho em voo, e a distinção é o produto.

```yaml anchors
- file: src/spec/index.ts
  symbol: "export interface SpecRecord"
```

### REQ-EFF-003 — The spec command informs and never judges

**Capability.** effective-spec

**Statement.** The specd spec command SHALL exit 0 whenever it can read the specification, regardless of anchors, coverage or evidence.

**Acceptance.**

- Âncora pendurada não muda o código de saída
- Nenhuma requisição de rede é feita
- Falha de leitura sai 2, nunca 1

Mesma disciplina do `status`: comando que resume estado precisa ser seguro de
rodar dentro de hook, de prompt e de skill. Um segundo comando capaz de sair 1
quebra single-gate mesmo que ninguém o coloque no CI — porque alguém coloca.

```yaml anchors
- file: test/spec/exit-contract.test.ts
  symbol: "spec informs and never judges"
```

### REQ-CFG-012 — The board declares whether a card is required

**Capability.** config

**Statement.** The specd configuration SHALL accept `board.card` with the values `required` and `optional`, defaulting to `required` when a board is configured.

**Acceptance.**

- Valor fora do conjunto é erro de configuração
- Sem `[board]` configurado, a chave não é exigida e não tem efeito
- O default só se aplica quando há board; repositório sem board não passa a exigir card
- A chave aparece no template do `init`, por REQ-CFG-011

O modo é lido, nunca inferido. Uma skill que olha o repositório e conclui
"parece que aqui tem board" está tomando decisão de ciclo por semelhança, que é
o que no-guessing-on-conflict proíbe.

O default é `required` porque board configurado e change sem card é a situação
que produz trabalho invisível para quem acompanha pelo board — e ausência de
dado não é conformidade.

```yaml anchors
- file: src/config/schema.ts
  symbol: "BOARD_CARD_MODES"
```

### REQ-FMT-011 — Change frontmatter declares its board card

**Capability.** spec-format

**Statement.** The specd parser SHALL require every change to declare `change` and `status` in the frontmatter of `proposal.md`, and to declare `card` with a board reference and a URL wherever `board.card` is `required`.

**Acceptance.**

- `proposal.md` ausente, ou sem `change`, reprova
- `card` com `ref` e sem `url`, ou o contrário, reprova
- `board.card = "optional"` aceita change sem `card`
- `card` declarado é aceito em qualquer modo

A ligação com o board vive na frontmatter da spec, por REQ-SYNC-007, e é por
item — capability, requisito ou task. Nada dizia de qual card a change nasceu.
Sem esse campo, a identidade externa da change existe só no manifest do bundle,
que é registro de coleta e não declaração de quem a change serve.

```yaml anchors
- file: src/parser/change.ts
  symbol: "ChangeFrontmatterSchema"
```

### REQ-EXP-010 — The exploration notes sit beside the bundle and are never validated

**Capability.** explore

**Statement.** The specd explore command SHALL leave `explore/notes.md` untouched whenever it writes or rewrites a bundle.

**Acceptance.**

- Duas execuções seguidas não apagam nem reescrevem `notes.md`
- `notes.md` não entra no manifest
- Nenhuma camada do gate lê `notes.md`

A prosa da exploração e o bundle de máquina dividem o diretório porque são a
mesma exploração vista de dois lados. Dividir por diretório separaria coisas que
se leem juntas; dividir por dono deixa claro quem escreve o quê.

Não validar é escolha, e é a mesma de REQ-EXP-007: rascunho que precisa passar
por schema deixa de ser rascunho, e a exploração perde o único momento do ciclo
em que se pode escrever errado de propósito.

```yaml anchors
- file: src/explore/paths.ts
  symbol: "NOTES_FILE"
```

### REQ-EXP-011 — A card that contradicts the change stops the run

**Capability.** explore

**Statement.** IF the change declares a `card` and the argument of the specd explore command names a different card, THEN specd SHALL exit 2 naming both.

**Acceptance.**

- Card igual ao declarado prossegue
- Card diferente sai 2 citando o declarado e o recebido
- Change sem `card` declarado prossegue, e o comando não grava card por conta própria

Coletar contexto de um card e guardá-lo na change de outro é a forma mais barata
de produzir bundle que justifica trabalho que ninguém pediu. O comando não
escolhe qual dos dois vale, e não corrige a frontmatter: os dois lados foram
escritos por gente, e adivinhar qual está certo é adivinhar.

```yaml anchors
- file: src/explore/card-ref.ts
  symbol: "assertCardMatchesChange"
```

### REQ-SYNC-017 — An archival transition is declared and proved

**Capability.** sync

**Statement.** WHERE `board.mapping.archived_status` is configured, the specd board adapter SHALL move the item to that status and re-read the item to prove the transition was applied.

**Acceptance.**

- O alvo vem do nome configurado; nome que o board não tem sai 2 listando os status existentes
- Resposta de sucesso sem a transição aplicada sai 2 citando o status atual
- Sem `archived_status` configurado, nenhuma transição é tentada
- A transição não fecha o item; fechar continua sendo REQ-SYNC-014

O adaptador só sabia matar. Board com `Em homologação` e `Aguardando Deploy`
entre `Em curso` e `Fechada` não tem onde receber "pronto para homologar", e a
alternativa era fechar cedo — o que apaga do board o trabalho que ainda tem
etapa pela frente.

A releitura é a mesma de REQ-SYNC-014, pela mesma razão medida: o Redmine
aceita `status_id`, responde 204 e não aplica. Resposta de sucesso não é prova
de que a escrita aconteceu; quem confirma é a releitura.

```yaml anchors
- file: src/sync/adapters/redmine.ts
  symbol: "async transition"
- file: src/sync/adapter.ts
  symbol: "export interface BoardAdapter"
```

### REQ-ARC-014 — Archive hands the item over, it does not bury it

**Capability.** archive

**Statement.** WHERE the `--sync` flag is given and `board.mapping.archived_status` is configured, the specd archive command SHALL transition every synced item of the archived change to that status.

**Acceptance.**

- Itens ligados aos requisitos da change transicionam
- Item ligado a requisito de outra change aberta não é tocado
- Sem `archived_status`, a reconciliação de conteúdo acontece, nenhuma transição é tentada, e a saída diz isso
- Falha da transição cai em REQ-ARC-012: a spec avança, o board não, e a mensagem manda rodar `specd sync`

`sync` reconcilia a spec efetiva inteira, e isso é correto para conteúdo — dois
lados divergentes são um conflito onde quer que estejam. Transição é diferente:
ela afirma que aquele trabalho terminou, e só terminou o da change que está
sendo arquivada.

```yaml anchors
- file: src/archive/index.ts
  symbol: "export function transitionArchivedItems"
```

### REQ-SKL-001 — The package ships the skills of the cycle

**Capability.** skills

**Statement.** The specd package SHALL include the skill sources of the explore, propose, apply and archive steps in its published tarball.

**Acceptance.**

- `npm pack` lista um diretório por skill, cada um com `SKILL.md`
- `files` do `package.json` inclui a árvore das skills
- Nenhuma skill referencia caminho fora do pacote
- O tarball continua sem `.env`, `.specd/`, `sandbox/` e `test/`

Skill que mora só neste repositório serve a este repositório. O ciclo é o
produto, e produto que só o autor consegue rodar não foi entregue.

```yaml anchors
- file: package.json
  symbol: "\"files\""
- file: skills/specd-explore/SKILL.md
```

### REQ-SKL-002 — Installing the skills is asked for and never silent

**Capability.** skills

**Statement.** WHERE the `--skills` flag is given, the specd init command SHALL write the packaged skills into `.claude/skills/` and report every path it wrote.

**Acceptance.**

- Sem a flag, nenhuma skill é escrita
- Arquivo existente com conteúdo diferente do empacotado não é sobrescrito sem `--force`
- Arquivo idêntico é reportado como inalterado e não reescrito
- Cada caminho escrito aparece na saída

Escrita fora de `.specd/` é escrita no território de outra ferramenta. Ela para
e nomeia a escolha, ou deixa o resultado onde a revisão passa antes de virar
história — que é costly-ops-are-not-silent. Sobrescrever skill que alguém
editou sem perguntar é as duas coisas erradas de uma vez.

```yaml anchors
- file: src/init/skills.ts
  symbol: "export function installSkills"
```

### REQ-SKL-003 — A skill declares the CLI version it needs

**Capability.** skills

**Statement.** IF the installed specd executable is older than the minimum version a skill declares, THEN the skill SHALL stop before acting.

**Acceptance.**

- A frontmatter de cada `SKILL.md` declara `requires_specd`
- O primeiro passo de cada skill lê `specd --version` e para se a versão for menor
- Versão maior ou igual prossegue
- A mensagem de parada nomeia a versão instalada e a exigida

A skill viaja no pacote e o pacote é instalado em versão qualquer. Skill nova
citando comando que a CLI instalada não tem falha de um jeito específico e
ruim: o comando não existe, a skill improvisa, e improvisar aqui significa
reconstruir a spec efetiva por conta própria.

```yaml anchors
- file: src/init/skills.ts
  symbol: "SKILL_MANIFEST"
```

### REQ-SKL-004 — A skill reads the spec through the CLI

**Capability.** skills

**Statement.** Every specd skill SHALL obtain the effective specification from the specd spec command.

**Acceptance.**

- Nenhum `SKILL.md` instrui a ler `.specd/specs/` e os deltas para montar o overlay
- Cada skill que precisa da spec efetiva cita `specd spec --json`
- Ler um arquivo que `specd spec` apontou continua permitido; reconstruir o overlay não

A fronteira entre as duas camadas é esta linha. A skill prepara material e lê o
veredito; ela não recalcula o que o CLI decide. Overlay reconstruído por LLM é
decisão de LLM no caminho do ciclo, com a agravante de ser invisível — ninguém
vê que a spec que a skill leu não é a que o gate lê.

```yaml anchors
- file: skills/specd-explore/SKILL.md
```

### REQ-SKL-005 — A decision goes to the author through the question tool

**Capability.** skills

**Statement.** WHEN a specd skill reaches a decision it cannot take from the configuration or from the CLI, the skill SHALL ask the author through the host's question tool.

**Acceptance.**

- Cada `SKILL.md` nomeia a ferramenta de pergunta do host nos seus pontos de decisão
- Nenhuma skill instrui a escolher o candidato mais provável
- Card ambíguo, duas changes abertas sobre o mesmo requisito e delta que contradiz a capability param o ciclo e viram pergunta

Pergunta em prosa no meio de uma resposta longa se perde e volta respondida pela
metade. A ferramenta força opções mutuamente exclusivas e registra a escolha —
e o que não é apresentado para decisão explícita não foi decidido, foi assumido.

```yaml anchors
- file: skills/specd-propose/SKILL.md
```

### REQ-SKL-006 — A configured board that cannot be reached stops the skill

**Capability.** skills

**Statement.** IF a board is configured and cannot be reached, THEN the specd skill SHALL stop and report the failure.

**Acceptance.**

- Cada `SKILL.md` do passo que fala com o board declara a parada
- Nenhuma skill instrui a seguir como se não houvesse board configurado
- Falha de credencial, falha de rede e card não encontrado têm o mesmo desfecho
- A rodada hostil da validação prova a parada

Board configurado e inalcançável é falha, não ausência. Cair para o modo sem
board transforma "não consegui verificar" em "verifiquei e está tudo certo", que
são resultados diferentes e um deles nunca é verde.

```yaml anchors
- file: skills/specd-archive-change/SKILL.md
```
