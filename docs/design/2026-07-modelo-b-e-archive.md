# Design — Modelo B e a capability `archive`

Estado: desenho aprovado nas decisões 1, 3 e 6. Nenhuma change aberta.
Escopo: o que `parseDelta` e `archive` precisam saber para serem escritos.

## Aviso de procedência

Duas justificativas citadas na decisão — `REQ-SPEC-011` (archive substitui seção
e aposenta removidos) e `REQ-MEM-005` (memória é efêmera e vai junto para o
archive) — não existem em `.specd/specs/` nem em qualquer arquivo deste
repositório. São da proposta original do produto, documento externo, já
registrada como spec-sombra no proposal de `delta-format-and-package-identity`.

Este desenho assume que os dois dizem o que a decisão afirma. Se o documento
externo divergir, os pontos afetados são REQ-ARC-003/004/005 (aplicação por
seção) e REQ-ARC-008 (memória).

---

# Parte 1 — Modelo B

## 1.1 A mudança

```
MODELO A (praticado por acidente)      MODELO B (decidido)
─────────────────────────────────      ───────────────────
autor escreve em specs/                autor escreve em delta.md
delta lista IDs                        delta carrega texto completo
archive move a change                  archive aplica e move
specs/ = verdade + proposta            specs/ = só verdade realizada
```

## 1.2 O delta é um overlay, não um arquivo paralelo

A formulação que faz o resto do desenho colapsar em pouca coisa:

> A spec efetiva é `specs/` com os deltas das changes abertas aplicados por
> cima. `verify` roda sobre a spec efetiva. `archive` persiste o overlay.

```
                    ┌──────────────────────────────┐
 .specd/specs/ ────▶│                              │
                    │   effectiveSpecs()           │──▶ Requirement[]
 changes/*/delta ──▶│   specs ⊕ ADDED              │    cada um com
                    │         ⊕ MODIFIED (substitui)│    origin: "specs"
                    │         ⊖ REMOVED             │          | "delta"
                    └──────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
              verify: roda as               archive: escreve
              camadas sobre o               em disco o mesmo
              resultado                     resultado
```

Três consequências que valem o desenho inteiro:

**a) `archive` vira "persistir o que `verify` já calcula".** A lógica de
aplicação é escrita uma vez, exercitada em toda rodada do gate, e o comando que
a persiste é fino. O modo de falha "archive aplicou diferente do que o verify
validou" deixa de existir por construção.

**b) O requisito em modificação não fica quebrado nos dois lugares.** Sem
overlay, uma change que MODIFICA REQ-X deixa duas cópias vivas: a antiga em
`specs/`, com âncora que quebra assim que o símbolo se move, e a nova no delta.
A antiga viraria erro incondicional e o gate ficaria vermelho pela duração
inteira da change. Com overlay, a cópia do delta **sombreia** a de `specs/` — só
o texto novo é checado.

**c) REMOVED some da spec efetiva.** Âncora de requisito em remoção não é
checada. Correto: ele está saindo.

## 1.3 Política de âncora — bifurca por origem, não por lookup de ID

REQ-ANC-006 hoje pergunta "este ID está no delta da change ativa?". Sob overlay
a pergunta desaparece: cada requisito da spec efetiva já carrega de onde veio.

```
origin = "specs"   → âncora pendurada é ERRO. sempre.
                     specs/ é realizado por definição.
origin = "delta"   → graduated: warning. é trabalho em voo.
```

As três políticas sobrevivem, com definições novas:

| policy      | origin=specs | origin=delta | caso de uso                                       |
| ----------- | ------------ | ------------ | ------------------------------------------------- |
| `strict`    | erro         | erro         | CI em `main`                                      |
| `graduated` | erro         | warning      | padrão                                            |
| `lenient`   | warning      | warning      | adoção em repo legado, junto com `anchor suggest` |

**Isto rebaixa o bug do `readActiveChange`.** No relatório anterior chamei o
raio de alcance dele de pior dos quatro, porque um delta encerrado silenciava 44
requisitos. Sob Modelo B a política de âncora não consulta mais change nenhuma,
e esse modo de falha morre com o Modelo A. O bug continua e continua primeiro na
ordem — `coverage`, `evidence`, `archive` e `status` ainda precisam saber de qual
change estão falando — mas o argumento "corrompe o diferencial" caduca. Registro
a correção porque a decisão de ordem foi tomada com ele na mesa.

## 1.4 Changes abertas no plural

A ambiguidade "qual é a change ativa" era um problema porque a política de
âncora exigia escolher uma. Não exige mais. O que sobra é mais simples:

```
readOpenChanges(root): Change[]     ← todas, excluindo archive/
  └─ anchors:   união de todas. um requisito em qualquer delta é warning.
  └─ coverage:  por change, independente.
  └─ evidence:  por change, independente.
  └─ archive:   change nomeada por argumento explícito. no-guessing-on-conflict.
  └─ status:    agrupa por change.
```

Nenhum consumidor precisa que exista uma única change ativa. Duas changes
abertas simultâneas passam a ser estado legítimo, não conflito — e o desenho
**depende** disso, ver 1.6.

`listChanges` precisa excluir `archive/` explicitamente. Hoje ele filtra só por
`isDirectory()` e sobrevive por acidente alfabético (`2` < `a`).

## 1.5 Os 10 requisitos a migrar — a lista fecha

Medido com `specd verify --fast` neste repositório:

| #   | requisito   | severidade hoje | por que não está realizado                   |
| --- | ----------- | --------------- | -------------------------------------------- |
| 1   | REQ-ANC-007 | erro            | `src/archive/index.ts` não existe            |
| 2   | REQ-ANC-008 | erro            | `src/anchors/fix.ts` não existe              |
| 3   | REQ-VER-004 | erro            | `src/verify/layers/coverage.ts` não existe   |
| 4   | REQ-VER-005 | erro            | `src/verify/layers/evidence.ts` não existe   |
| 5   | REQ-FMT-004 | warning         | `checkRetiredReuse` nunca escrito            |
| 6   | REQ-FMT-005 | warning         | `src/parser/delta.ts` não existe             |
| 7   | REQ-FMT-006 | warning         | idem                                         |
| 8   | REQ-FMT-007 | warning         | `src/parser/task.ts` não existe              |
| 9   | REQ-VER-003 | warning         | `src/verify/layers/provenance.ts` não existe |
| 10  | REQ-EXP-007 | warning         | âncora aponta para o mesmo `provenance.ts`   |

4 erros + 6 warnings = 10. Fecha.

Mas os 10 não são uma classe só, e tratar como classe só quebra o Modelo B:

**Classe I — vão para o delta da change `archive-cycle-and-effective-specs`** (8): ANC-007, ANC-008, VER-004,
VER-005, FMT-004, FMT-005, FMT-006, FMT-007. Todos implementados pela change `archive-cycle-and-effective-specs`.

**Classe II — não têm change que os implemente** (1): VER-003. Provenance saiu
do escopo da change `archive-cycle-and-effective-specs` porque, como está escrito, ele reprova qualquer change sem
`explore/manifest.json` — e a change `archive-cycle-and-effective-specs` não é dirigida por card, logo reprovaria a
si mesma. Ele espera a change `provenance-and-mcp-transport` junto com o transporte MCP.

**Classe III — não é falta de implementação** (1): EXP-007. O requisito é
negativo — _"SHALL NOT validate the content of `draft.md`"_ — e está satisfeito
hoje, vacuamente, porque nada valida draft. A âncora aponta para
`src/verify/layers/provenance.ts`, que não existe. Isto é âncora errada, não
comportamento ausente. anchor-necessary-not-sufficient em forma pura: a âncora não sabe responder "onde" para
um requisito cujo conteúdo é "em lugar nenhum".

### O problema que a Classe II abre

Sob Modelo B, `specs/` só contém realizado. VER-003 não é realizado e nenhuma
change da change `archive-cycle-and-effective-specs` o reivindica. Ele não tem casa. Quatro saídas:

| saída                                                                               | resultado                                                                                          |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| fica em `specs/`                                                                    | erro incondicional. change `archive-cycle-and-effective-specs` nunca fica verde.                   |
| entra no delta da change `archive-cycle-and-effective-specs`                        | change `archive-cycle-and-effective-specs` não pode arquivar: REQ-ANC-007 exige âncora resolvendo. |
| REMOVED + reintroduzido depois                                                      | REQ-FMT-004 proíbe reuso de ID aposentado. Fatal.                                                  |
| **entra no delta da change `provenance-and-mcp-transport`, aberta e não arquivada** | funciona                                                                                           |

A quarta funciona porque REQ-ANC-007 fala em _"any anchor of any affected
requirement"_ — afetado pela change que está sendo arquivada. As âncoras
penduradas da change `provenance-and-mcp-transport` não bloqueiam o archive da change `archive-cycle-and-effective-specs`, e são warnings pela
regra de origem.

**Consequência de projeto, não detalhe:** o Modelo B exige changes abertas
concorrentes. A change `provenance-and-mcp-transport` tem que existir como diretório com `delta.md` antes de a
change `archive-cycle-and-effective-specs` fechar. Não é dívida — é o que 1.4 já assumiu.

EXP-007 (Classe III) não migra. Corrige-se a âncora dele: aponta para
`src/verify/index.ts:LAYER_ORDER`, o lugar onde a ausência de uma camada que
validaria draft é observável, ou perde a âncora. Decisão em aberto, item 17.

## 1.6 Requisitos de `.specd/specs/` que o Modelo B altera

Você listou REQ-FMT-005 e REQ-ANC-006. Faltam cinco.

**REQ-FMT-005 — MODIFIED.** ADDED e MODIFIED passam a carregar texto completo;
REMOVED continua só identificadores. Ganha também o que hoje o delta da `verify-gate-and-anchor-ladder`
faz sem requisito: subseções por capability dentro de ADDED e MODIFIED. São
necessárias porque REQ-FMT-002 permite prefixo divergente do nome da capability
— `REQ-FMT-*` mora em `spec-format.md` — logo o ID não determina o destino, e
`archive` precisa saber em qual arquivo escrever.

**REQ-FMT-006 — MODIFIED.** Hoje diz "WHEN a requirement appears under
MODIFIED". Generaliza para ADDED e MODIFIED, senão o que é "texto completo" num
ADDED fica indefinido. É o requisito que carrega a definição — statement,
acceptance e anchors presentes, nenhuma sintaxe de patch interpretada.

**REQ-ANC-006 — MODIFIED.** Severidade por origem, tabela de 1.3. Encolhe: some
a referência a "the active change delta".

**REQ-ANC-008 — MODIFIED.** Decisão 3, exit 2.

**REQ-CLI-001 — MODIFIED.** Não listado por você e é o mais delicado. `archive`
vai recusar operação quando `coverage` ou `evidence` reprovarem. Isso é juízo de
qualidade, e single-gate reserva o exit 1 ao `verify`. Regra que resolve os dois casos —
`anchor fix` e `archive` — com uma frase:

> **Exit 1 é veredito. Exit 2 é recusa de agir.**
> `verify` emite veredito. Todo outro comando que não pode agir porque a
> qualidade não permite sai com 2 e nomeia `specd verify` como o lugar onde ver
> o veredito.

O critério de aceite de REQ-CLI-001 ganha isso explicitamente. Sem essa frase,
REQ-ARC-002 e REQ-ANC-008 contradizem REQ-CLI-001 em silêncio.

**REQ-CFG-006 / novo REQ-CFG-007 — ADDED.** Endereço de requisito deixa de ser
estável. O ID continua estável, o arquivo não. `specd status` precisa responder
onde um ID mora.

```
### REQ-CFG-007 — Requirement location is reported

Statement. The specd status command SHALL report, for every requirement
identifier, the file that currently holds it and whether it is realized or in
flight.

Acceptance.
- ID em specs/ reportado como realizado, com caminho da capability
- ID em delta de change aberta reportado como em voo, com caminho e nome da change
- ID presente nos dois reportado como em modificação, com os dois caminhos
- ID desconhecido é reportado como tal, sem exit code diferente de zero (REQ-CFG-006)

anchors:
- file: src/status/locate.ts
  symbol: "export function locateRequirement"
```

**Requisitos que sobrevivem sem mudança de texto, mas com escopo ampliado:**
REQ-FMT-001, REQ-FMT-003, REQ-FMT-004 e todos os REQ-EARS-\* passam a valer
também sobre blocos de requisito dentro de `delta.md`. O texto de cada um já diz
"any requirement", então nenhum precisa de MODIFIED — mas a camada `schema`
precisa passar a ler os deltas, e **nenhum requisito define o que a camada
`schema` lê.** Ver item 15.

**Reaproveitamento que o Modelo B ganha de graça:** um bloco de requisito no
delta tem exatamente a forma de um bloco em capability. `parseDelta` = separador
de seções + `parseRequirement` já existente. Não é parser novo, é enquadramento
novo do mesmo parser.

---

# Parte 2 — Capability `archive`

Arquivo novo: `.specd/specs/archive.md`, prefixo `REQ-ARC-*`.
Prefixo verificado contra a regra de abreviação: `A`,`R`,`C` é subsequência de
`ARCHIVE`. Sem warning de divergência.

## REQ-ARC-001 — Change is named explicitly

**Statement.** The specd archive command SHALL require the name of the change to
archive as an explicit argument.

**Acceptance.**

- Comando sem argumento sai com código 2 e lista as changes abertas
- Nome inexistente sai com código 2
- Nenhuma inferência a partir de data, ordem ou quantidade de changes abertas

Com changes concorrentes (1.4), inferir é adivinhar. no-guessing-on-conflict.

```yaml anchors
- file: src/archive/index.ts
  symbol: "export async function archive"
```

## REQ-ARC-002 — Preconditions gate the operation

**Statement.** The specd archive command SHALL exit with code 2 without writing
anything when the change fails the coverage, evidence or anchor preconditions.

**Acceptance.**

- Requisito em ADDED ou MODIFIED sem task apontando aborta (REQ-VER-004)
- Task `done` com `evidence.commits` vazio aborta (REQ-VER-005)
- Âncora pendurada de requisito afetado aborta, qualquer que seja a policy (REQ-ANC-007)
- Nenhum arquivo é escrito e nenhum diretório é movido quando aborta
- Mensagem nomeia `specd verify` como o lugar do veredito

Código 2 e não 1 pela regra de REQ-CLI-001 revisado: recusa de agir, não
veredito.

```yaml anchors
- file: src/archive/index.ts
  symbol: "assertArchivable"
```

## REQ-ARC-003 — ADDED inserts a new section

**Statement.** WHEN a requirement appears under ADDED, the specd archive command
SHALL insert its full text as a new section in the capability file named by its
subsection.

**Acceptance.**

- Seção aparece no arquivo da capability indicada pela subseção do delta
- Texto inserido é idêntico ao do delta, incluindo bloco de âncoras
- ID já presente como seção ativa aborta (REQ-FMT-004 e no-guessing-on-conflict)

```yaml anchors
- file: src/archive/apply.ts
  symbol: "insertRequirement"
```

## REQ-ARC-004 — MODIFIED replaces the whole section

**Statement.** WHEN a requirement appears under MODIFIED, the specd archive
command SHALL replace the entire existing section with the delta text.

**Acceptance.**

- Nenhuma parte da seção antiga sobrevive à substituição
- Posição da seção no arquivo é preservada
- ID ausente da capability aborta

```yaml anchors
- file: src/archive/apply.ts
  symbol: "replaceRequirement"
```

## REQ-ARC-005 — REMOVED deletes the section and retires the identifier

**Statement.** WHEN an identifier appears under REMOVED, the specd archive
command SHALL delete its section and append the identifier to the `retired` list
of the capability frontmatter.

**Acceptance.**

- Seção desaparece do arquivo
- ID passa a constar em `retired`
- ID já em `retired` aborta

Três requisitos e não um, deliberadamente. Um único statement coordenando
inserir, substituir e apagar passaria REQ-EARS-003 pela contagem de `SHALL` e
seria exatamente o caso que aquele requisito admite não detectar.

```yaml anchors
- file: src/archive/apply.ts
  symbol: "retireRequirement"
```

## REQ-ARC-006 — Archive destination preserves the change name

**Statement.** The specd archive command SHALL move the change directory to
`.specd/changes/archive/` preserving its directory name.

**Acceptance.**

- `2026-07-28-verify-gate-and-anchor-ladder` vira `.specd/changes/archive/2026-07-28-verify-gate-and-anchor-ladder`
- Nenhum prefixo de data é acrescentado
- Destino já existente aborta sem mover nada

Sem prefixo de data porque os nomes de change do specd já carregam data;
prefixar produziria `2026-07-28-2026-07-28-verify-gate-and-anchor-ladder`. Divergência consciente do
OpenSpec, cujos nomes não carregam.

```yaml anchors
- file: src/archive/index.ts
  symbol: "archiveDestination"
```

## REQ-ARC-007 — No commit is created

**Statement.** The specd archive command SHALL leave every file it writes and
moves unstaged.

**Acceptance.**

- Nenhum commit é criado
- Nenhum `git add` é executado
- Saída instrui revisar o diff antes de commitar

Simétrico com REQ-ANC-008. `archive` reescreve a spec; a spec é o contrato; no-guessing-on-conflict
exige revisão humana entre a máquina propor e o repositório aceitar.

```yaml anchors
- file: src/archive/index.ts
  symbol: "export async function archive"
```

## REQ-ARC-008 — Memory travels with the change

**Statement.** The specd archive command SHALL move the change's `memory/`
directory along with the change, without copying any of its content into the
capability files.

**Acceptance.**

- `memory/` acompanha o diretório arquivado
- Nenhum conteúdo de memória aparece em `.specd/specs/`
- Ausência de `memory/` não é erro

**Confirmo o comportamento reportado em REQ-MEM-005, com leitura de memory-is-ephemeral:**
efêmera significa _não autoritativa_, não _destruída_. Apagar é irreversível e
não compra nada — o git já guarda. Carregar preserva a trilha de auditoria a
custo zero. O que memory-is-ephemeral exige é que nada de `memory/` vire contrato, e é isso que o
segundo critério de aceite trava.

```yaml anchors
- file: src/archive/index.ts
  symbol: "export async function archive"
```

## REQ-ARC-009 — Validation precedes every write

**Statement.** The specd archive command SHALL compute and validate the new
content of every affected capability file before writing any of them, and move
the change directory last.

**Acceptance.**

- Conflito em qualquer capability impede a escrita de todas
- O movimento do diretório é a última operação
- Falha de I/O em uma capability não deixa outra pela metade

Atomicidade real entre N arquivos exige journal, que não vale o custo aqui. Esta
formulação reduz a janela de falha ao nível do sistema de arquivos e garante que
nenhuma falha _lógica_ — que é a provável — produza estado parcial.

```yaml anchors
- file: src/archive/apply.ts
  symbol: "planApplication"
```

## REQ-ARC-010 — Reapplication is idempotent by content

**Statement.** IF a capability already contains a requirement the delta declares
under ADDED with byte-identical text, THEN the specd archive command SHALL treat
it as already applied instead of aborting.

**Acceptance.**

- Rerodada depois de falha no movimento do diretório conclui a operação
- Texto divergente com o mesmo ID aborta como conflito (no-guessing-on-conflict)
- Nenhuma seção é duplicada

É o par de REQ-ARC-009: sem ele, uma falha depois de escrever as capabilities e
antes de mover o diretório deixa o operador sem caminho de volta que não seja
`git checkout`, e REQ-ARC-003 abortaria por ID duplicado na segunda tentativa.

```yaml anchors
- file: src/archive/apply.ts
  symbol: "alreadyApplied"
```

---

# Parte 3 — Condição de saída do OpenSpec

A change `archive-cycle-and-effective-specs` é a última change rastreada nos dois sistemas.

```
hoje            change `archive-cycle-and-effective-specs`                  depois
────            ───────                  ──────
OpenSpec:       OpenSpec: rastreia       OpenSpec: nada.
  changes/        a implementação        arquivo histórico
  archive/                               em changes/archive/
                .specd/changes/:
.specd/changes/   delta real,            .specd/changes/:
  `verify-gate-and-anchor-ladder`         arquivado por            único rastreador.
  (sem archive)   specd archive            ciclo fechado.
```

Condição concreta de saída, verificável: **`specd archive 2026-07-28-archive-cycle-and-effective-specs` sai 0
e `specd verify` fica verde sem warning depois disso.** A partir daí abrir change
em `openspec/changes/` é regressão, não conveniência.

Motivo de não sair antes: enquanto `archive` não existir, uma change do `.specd`
não pode ser fechada, e rastrear trabalho num sistema que não fecha é pior que
duplicar.

---

# Parte 4 — Respostas

## 4.1 O Modelo B quebra requisito que você não listou?

Cinco, detalhados em 1.6:

| requisito   | por quê                                                                      | gravidade             |
| ----------- | ---------------------------------------------------------------------------- | --------------------- |
| REQ-FMT-006 | "texto completo" só definido para MODIFIED                                   | bloqueia `parseDelta` |
| REQ-CLI-001 | `archive` recusando por qualidade colide com single-gate                     | bloqueia REQ-ARC-002  |
| REQ-ANC-008 | já na decisão 3, mas a regra geral é nova                                    | consistência          |
| REQ-CFG-006 | endereço instável precisa de relatório                                       | usabilidade           |
| REQ-EXP-007 | âncora aponta para arquivo inexistente; sob Modelo B vira erro incondicional | bloqueia gate verde   |

Mais um vazio, não um requisito quebrado: **nenhum requisito define o que a
camada `schema` lê.** Hoje não importa; sob overlay, "o `schema` valida os
requisitos do delta também?" é decisão de comportamento sem dono.

## 4.2 A migração cabe numa change?

Não. E não por tamanho — por gramática.

Mover REQ-VER-004 de `specs/` para um delta não é ADDED (já existe), não é
MODIFIED (o texto não muda) e não é REMOVED (não está saindo do produto). **O
delta não tem palavra para "desarquivar".** Usar REMOVED aposentaria o ID, e
REQ-FMT-004 proíbe reuso — fatal, não inconveniente.

Nem se deve inventar uma quarta seção: você acabou de gastar uma change inteira
removendo uma.

Logo a migração é edição manual fora da gramática do delta, documentada em
proposal — mesma classe de `delta-format-and-package-identity`. E isso dá o corte natural:

```
CHANGE A — "migracao-modelo-b"          CHANGE B — "`archive-cycle-and-effective-specs`"
zero código                              todo o código
─────────────────────────                ────────────────────
move os 8 da Classe I para o             implementa readOpenChanges,
delta da change `archive-cycle-and-effective-specs`                         exclusão de archive/, passagem
abre change `provenance-and-mcp-transport` com VER-003                 vazia, parseDelta, parseTask,
corrige a âncora de EXP-007              coverage, evidence, archive,
MODIFIED de FMT-005/006, ANC-006,        anchor fix
ANC-008, CLI-001; ADDED CFG-007
escreve .specd/specs/archive.md          critério: arquiva a `verify-gate-and-anchor-ladder`,
como texto do delta da change `archive-cycle-and-effective-specs`           depois se arquiva, depois
                                         verify verde sem warning
gate verde ao fim: os 10 saíram
de specs/
```

A Change A **é** o `propose` da change `archive-cycle-and-effective-specs`, feito à mão porque `propose` não
existe. A Change B é o `apply`. O delta que a B implementa já foi revisado
quando a A foi revisada — que é exatamente o ciclo que o produto vende.

Tamanho da A: ~26 blocos de requisito, ~550 linhas. Metade da spec restatada.
Grande, mas o diff é majoritariamente movimento, e revisar 550 linhas de texto
uma vez é mais barato que revisar código e spec entrelaçados no mesmo commit.

Ambas rastreadas no OpenSpec — a A porque não há `archive`, a B porque é a
última antes da saída.

## 4.3 O que continua aberto das 12

**Fechadas (7):**

| #   | item                       | fechado por                                           |
| --- | -------------------------- | ----------------------------------------------------- |
| 1   | modelo do delta            | decisão 1                                             |
| 2   | o que é "change ativa"     | overlay + plural: ninguém precisa escolher uma        |
| 3   | exit code do `anchor fix`  | decisão 3, generalizada em "1 é veredito, 2 é recusa" |
| 5   | quem aposenta o REMOVED    | REQ-ARC-005                                           |
| 6   | capability `archive`       | Parte 2                                               |
| 7   | `listChanges` e `archive/` | exclusão explícita, 1.4                               |
| 11  | memória no archive         | REQ-ARC-008                                           |

**Abertas (5):**

| #   | item                                  | proposta minha                                                                 |
| --- | ------------------------------------- | ------------------------------------------------------------------------------ |
| 4   | o que conta como "task referenciando" | só `req:` do frontmatter; task `pending` conta; só tasks da própria change     |
| 8   | `evidence` sem git                    | não-validável = 2; validado-e-ausente = 1                                      |
| 9   | `evidence` e squash merge             | sem proposta. o fluxo mata todo SHA no merge e a camada inteira é hostil a ele |
| 10  | formato do diretório de tasks         | `tasks/NNN-*.md`, como `src/status/tasks.ts` já assume                         |
| 5b  | REMOVED precisa de task?              | não                                                                            |

**Abertas novas que este desenho cria (6):**

| #   | item                                                                                                      | proposta minha                                                                         |
| --- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 13  | onde ADDED insere na capability                                                                           | acrescenta ao fim. determinístico. arquivos saem da ordem de ID, e `verify.md` já está |
| 14  | subseções por capability no delta                                                                         | obrigatórias em ADDED e MODIFIED; o prefixo do ID não determina destino                |
| 15  | o que a camada `schema` lê                                                                                | spec efetiva inteira, `specs/` e deltas                                                |
| 16  | exit code de `archive` por precondição                                                                    | 2, com REQ-CLI-001 revisado                                                            |
| 17  | âncora de EXP-007                                                                                         | `src/verify/index.ts:LAYER_ORDER`, ou requisito negativo sem âncora                    |
| 18  | change `provenance-and-mcp-transport` aberta antes de a change `archive-cycle-and-effective-specs` fechar | sim, é o que dá casa a VER-003                                                         |

Saldo: 12 → 11. Praticamente estável em número, mas as que restam são todas
locais — nenhuma trava `parseDelta` nem `archive`. As duas que travavam
fecharam.

O maior risco remanescente é o item 9. `archive` passa a exigir `evidence`
verde, `evidence` exige SHA vivo, e squash merge mata SHA. Se algum cliente real
usar squash, `archive` fica inutilizável para ele — e isso é descoberto tarde,
depois da change `archive-cycle-and-effective-specs` pronta. Vale um spike de meia hora antes da Change A: decidir
se `evidence` valida SHA contra o histórico ou contra alguma coisa que sobreviva
ao merge.
