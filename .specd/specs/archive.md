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

Com changes abertas concorrentes, inferir é adivinhar. no-guessing-on-conflict.

```yaml anchors
- file: src/archive/index.ts
  symbol: "export async function archive"
```

### REQ-ARC-002 — Preconditions gate the operation

**Statement.** The specd archive command SHALL exit with code 2 without writing anything when the change fails any offline layer listed in `verify.levels`.

**Acceptance.**

- Requisito em `ADDED` ou `MODIFIED` sem task apontando aborta, por REQ-VER-004
- Task `done` com `evidence.commits` vazio aborta, por REQ-VER-005
- Âncora pendurada de requisito afetado aborta, por REQ-ANC-007
- Change sem manifesto de explore aborta onde o projeto declara fonte obrigatória, por REQ-VER-003
- Change cuja frontmatter ou delta não passa no schema aborta, por REQ-FMT-011
- Camada ausente de `verify.levels` não é exigida, por REQ-VER-002
- A camada `project` nunca é exigida, mesmo listada em `verify.levels`
- A recusa por âncora pendurada vale mesmo com `anchors` fora de `verify.levels`, porque REQ-ANC-007 independe da política
- Requisito que a retomada já aplicou palavra por palavra não aborta, por REQ-ARC-010
- Nenhum arquivo é escrito e nenhum diretório é movido quando aborta
- Mensagem nomeia `specd verify` como o lugar do veredito

Arquivar promove requisito de `origin: delta` para `origin: specs`, e com isso
transforma warning de âncora em erro. É a operação mais cara do ciclo. Fazê-la
com três das seis camadas lidas é assumir dívida de manutenção sobre coisa que
ninguém verificou — e a run 013 mediu o caso: uma change sem manifesto de explore
foi arquivada enquanto o `verify`, no mesmo repositório e no mesmo instante,
reprovava por ela.

A lista vem de `verify.levels` em vez de ser escrita aqui de novo. Duas listas
das mesmas camadas são duas chances de discordar, e exigir no `archive` uma
camada que o projeto desligou seria um segundo portão entrando por outra porta —
o que single-gate proíbe.

REQ-ARC-010 continua valendo por cima desta checagem, e a implementação mediu por
quê: um `archive` interrompido entre escrever a capability e mover o diretório
deixa a change de volta em aberto com o requisito já em `.specd/specs/` — estado
que a camada `schema` reporta como "ADDED mas já existe". Ler o schema sem essa
exceção tornaria toda retomada impossível, trocando um defeito por outro pior.
O diagnóstico é dispensado só para o identificador cujo texto já está aplicado
palavra por palavra, que é o mesmo conjunto que REQ-ARC-010 chama de
`alreadyApplied`.

A âncora continua sendo checada por REQ-ANC-007 e não pela camada `anchors`: a
camada gradua por origem e devolve warning para requisito de delta, que é
exatamente o caso de toda change sendo arquivada. A checagem do `archive` é mais
dura de propósito, e por isso não depende de a camada estar ligada.

`project` fica fora, e fica fora por decisão. Ela executa o `validation_command`
do projeto: dentro do `archive` isso duplicaria o `verify` inteiro, cobraria
minutos numa operação que já é cara, e daria ao comando a única forma de falhar
que não é sobre a spec. Quem quer o veredito completo roda `specd verify`, que é
onde ele mora.

```yaml anchors
- file: src/archive/index.ts
  symbol: "export async function assertArchivable"
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
- `2026-07-28-verify-gate-and-anchor-ladder` vira `.specd/changes/archive/2026-07-28-verify-gate-and-anchor-ladder`
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

`archive` reescreve o contrato. no-guessing-on-conflict exige revisão humana entre a máquina propor e
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

Efêmera por memory-is-ephemeral significa não-autoritativa, não destruída. Apagar é irreversível
e não compra nada; carregar preserva a trilha a custo zero. O que memory-is-ephemeral exige é que
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
externa continua declarada, que é costly-ops-are-not-silent.

A flag existe em vez de só um aviso porque o modo de falha do aviso é esquecer,
e esquecer é o caso comum. Ela transforma dois comandos num ato deliberado sem
transformar nenhum ato em automático.

Não existe `--no-sync` porque duas flags para um booleano é botão sem dois
clientes divergindo, que é config-only-on-divergence.

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
causa de uma falha de rede, e é exatamente a decisão silenciosa que costly-ops-are-not-silent proíbe.

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
defeito que esta change inteira ataca. Requisito com critério de aceite é a
diferença entre um lembrete que se apaga e um comportamento que se testa.

A contagem não consulta o board de propósito. `archive` sem `--sync` não toca a
rede, e um relatório que precisasse dela falharia offline — informação sobre
sincronia virando motivo para não conseguir arquivar.

```yaml anchors
- file: src/archive/index.ts
  symbol: "export function countUnsyncedItems"
```

### REQ-ARC-015 — The precondition reads this change and what it rewrites

**Statement.** The specd archive command SHALL evaluate its preconditions over the diagnostics of the change being archived and of the capabilities its delta rewrites, ignoring the diagnostics of every other open change.

**Acceptance.**

- Delta ilegível de outra change aberta não impede este arquivamento
- Capability de destino ilegível impede, porque é nela que a escrita acontece
- Diagnóstico do diretório da change impede, qualquer que seja o arquivo dentro dele
- O corte compara caminhos normalizados, e um caminho absoluto casa com o mesmo caminho relativo à raiz

`assertArchivable` já entrega um contexto com uma change só, e `provenance` e a
checagem de card iteram a lista de changes — as duas escapam limpo. O que não
escapa é `effective.diagnostics`, que carrega o que os parsers acharam em todo
lugar. Passado como está, um delta quebrado numa change que ninguém está
arquivando bloqueia este arquivamento, e isso não é rigor: é acoplamento entre
trabalhos que o Modelo B deixou deliberadamente independentes.

O corte é simétrico ao que o comando faz. Ele escreve nas capabilities de destino
e move o diretório desta change; então exige que esses arquivos estejam legíveis,
e não julga os que não toca.

A normalização está no critério porque `Diagnostic.file` admite caminho absoluto
ou relativo à raiz, e comparar prefixo sem normalizar é a forma silenciosa de o
corte errar — deixando passar o que devia bloquear.

```yaml anchors
- file: src/archive/index.ts
  symbol: "export function scopedDiagnostics"
```

### REQ-ARC-014 — Archive hands the item over, it does not bury it

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
  symbol: "export async function transitionArchivedItems"
```

### REQ-ARC-016 — Archiving requires the proposal record

**Statement.** IF the change carries no readable proposal record, THEN the specd archive command SHALL exit with code 2 without writing anything.

**Acceptance.**

- Change sem `propose.json` sai 2 nomeando o comando que o grava
- Registro presente arquiva, mesmo quando a lista de requisitos está vazia
- Registro ilegível, ou de versão desconhecida, recusa igual e nomeia o arquivo
- Nenhum arquivo é escrito e nenhum diretório é movido quando aborta
- A recusa acontece junto das outras pré-condições, antes de qualquer escrita

O `archive` caía para recorte largo quando o marco faltava. É o comportamento
certo diante da ausência, e é o que tornava a ausência indolor — fallback seguro
que ninguém sente é fallback que vira permanente. A saída escolhida para o marco
decaía sozinha para a que tinha sido descartada, por erosão e não por decisão.

Isso já aconteceu, e o registro dessa change não existirá nunca: a
`2026-07-31-usable-vacuous` foi arquivada sem marco, e a janela dela fechou antes
de alguém notar.

A cobrança não é "o marco era possível", é "não há marco" — porque com
REQ-SKL-009 toda change grava, inclusive a que não tem o que registrar. Predicado
composto seria uma segunda regra a manter sincronizada com a do
`propose-record`, e a assimetria entre as duas é onde o furo voltaria.

Registro ilegível recusa junto com registro ausente porque "não consegui ler" e
"não existe" são a mesma informação para quem depende dele — e tratar o primeiro
como se fosse marco válido seria `absence-is-not-compliance` na direção
perigosa.

Sem flag de dispensa. A válvula é por onde o descuido volta, e foi a razão de
descartar a recusa dura sem condição.

```yaml anchors
- file: src/archive/index.ts
  symbol: "export function assertProposalRecord"
```
