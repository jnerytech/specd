---
capability: sync
retired: []
---

### REQ-SYNC-001 — Sync is manual and never runs from a hook

**Statement.** The specd sync command SHALL write to the board only when invoked directly by a person.

**Acceptance.**

- `specd sync` existe como comando e escreve no board
- Nenhum evento de hook instalado por `specd hooks install` invoca `sync`
- Teste de arquitetura: nada alcançável a partir de `src/hooks/run.ts` importa `src/sync/`
- Falha de `sync` sai 2, nunca 1 — só `verify` reprova

Hook roda sem ninguém olhando. Escrita em sistema de terceiro sem ninguém
olhando é como se apaga o trabalho de outra pessoa e se descobre uma semana
depois. O gate é obrigatório porque é leitura; `sync` é manual porque é escrita.

```yaml anchors
- file: src/sync/index.ts
  symbol: "export async function sync"
```

### REQ-SYNC-002 — The adapter interface is the whole coupling surface

**Statement.** The specd sync core SHALL reach a board only through the adapter interface.

**Acceptance.**

- A interface declara `create`, `update`, `link` e `close` como escritas
- A interface declara `read` e `describeFields` como leituras, porque merge e P8 não existem sem elas
- Nenhum módulo fora de `src/sync/adapters/` cita Redmine, endpoint ou verbo HTTP
- Trocar de adaptador não toca merge, hash, mapeamento nem ligação

Quatro escritas foi o desenho pedido e quatro escritas bastaram — `link` no
Redmine é `parent_issue_id` num `update`, que é uma delegação de três linhas, e
no Azure DevOps é recurso próprio. A generalidade fica do lado certo.

As duas leituras são a falta que o desenho de quatro não cobria, e não há como
contorná-la: merge de três vias precisa do estado remoto, e recusar por P8
precisa da definição do campo.

```yaml anchors
- file: src/sync/adapter.ts
  symbol: "export interface BoardAdapter"
```

### REQ-SYNC-003 — Field ownership is declared, not negotiated

**Statement.** The specd sync command SHALL write to the board only the fields the spec owns, with closing an archived item as the single declared exception.

**Acceptance.**

- Spec possui título, conteúdo e hierarquia; board possui situação, responsável e iteração
- Campo do board alterado fora da lista da spec nunca é sobrescrito
- Campo que nenhum dos dois lados possui não entra na projeção nem no hash
- `close` é a única escrita de situação, e só ocorre para item arquivado
- `close` relê e confirma que a situação mudou de fato, e falha quando não mudou

Não existe categoria "ambos possuem": é o nome bonito de "o último que escreveu
ganha". A fronteira é entre o que se decide escrevendo e o que se decide
trabalhando.

A releitura no `close` não é zelo: um tracker do Redmine sem linha de workflow
aceita `status_id`, responde **204** e não aplica nada. Medido. Escrita que
reporta sucesso sem ter acontecido é o P8 chegando pelo lado do board, então a
única escrita de situação que o specd faz é também a única que ele confere.

```yaml anchors
- file: src/sync/merge.ts
  symbol: "export const FIELD_OWNERSHIP"
```

### REQ-SYNC-004 — The hash is computed over a normalized projection

**Statement.** The specd sync command SHALL compute the synced hash over a canonical normalized projection rather than over the raw board payload.

**Acceptance.**

- Campo simples vazio (`null`), multivalorado vazio (`[]`) e string vazia normalizam para ausente
- Campo multivalorado vazio e campo simples vazio produzem o mesmo hash
- Ordem das chaves no payload não altera o hash
- Ordem dos valores de um campo multivalorado é preservada, porque é conteúdo

O Redmine devolve `null` para campo simples não preenchido e `[]` para
multivalorado não preenchido. Hash sobre payload bruto muda quando o servidor
muda a forma sem o conteúdo mudar, e hash que muda sozinho transforma todo sync
em conflito falso — que é exatamente o ruído que faz gente desligar a
ferramenta.

```yaml anchors
- file: src/sync/hash.ts
  symbol: "export function normalizeProjection"
```

### REQ-SYNC-005 — Both sides changed is a conflict, and conflicts are never resolved

**Statement.** IF the spec projection and the board projection both differ from the recorded synced hash and differ from each other, THEN the specd sync command SHALL exit with code 2 listing every conflicting item without writing to either side.

**Acceptance.**

- Um lado alterado escreve; nenhum lado alterado não escreve
- Os dois lados alterados para o mesmo valor convergem e só atualizam a ligação
- Os dois lados alterados de formas diferentes saem 2, listam item, campo e os dois valores
- Nada é escrito no board nem na spec quando há conflito, nem para os itens sem conflito

P4 na forma mais literal que o produto tem. Um sync que escolhe por você é um
sync cujo resultado verde não significa nada — e board é onde o custo de estar
errado é mais alto, porque outra pessoa já agiu sobre o que estava lá.

Falha parcial também não serve: escrever os itens sem conflito deixaria o board
num estado que nem a spec nem o board descrevem, e ninguém saberia qual metade
foi.

```yaml anchors
- file: src/sync/merge.ts
  symbol: "export function mergeThreeWay"
```

### REQ-SYNC-006 — Spec level maps to item type, with an explicit collapse rule

**Statement.** WHERE the configuration maps a spec level to a board item type, the specd sync command SHALL create one board item per element of that level, folding every collapsed level into the item of its nearest mapped ancestor.

**Acceptance.**

- Nível mapeado vira item do tipo configurado
- Nível listado em `collapse` não vira item e seu conteúdo entra no ancestral mapeado
- Nível sem mapeamento e sem colapso sai 2 nomeando o nível — ausência de regra não é regra
- Hierarquia entre itens criados usa `link`, não recriação

Colapso é a diferença entre um board legível e um board com trezentos cards de
uma linha. Que ele seja configurável é P5 atendido de verdade: dois clientes
reais divergem porque um planeja por capability e outro por requisito.

```yaml anchors
- file: src/sync/mapping.ts
  symbol: "export function planBoardItems"
```

### REQ-SYNC-007 — The link lives in the spec frontmatter

**Statement.** The specd sync command SHALL record `ref`, `url`, `synced_at` and `synced_hash` for every synced item in the frontmatter of the capability file that declares it.

**Acceptance.**

- Item novo grava as quatro chaves; item já ligado atualiza `synced_at` e `synced_hash`
- O corpo do arquivo de capability permanece byte-idêntico
- Comentários e ordem das chaves existentes no frontmatter são preservados
- Ligação ausente significa "nunca sincronizado", nunca "sincronizado e sem mudança"

A ligação mora junto do que ela liga. Arquivo à parte se perde, diverge, e
transforma "este requisito está no board?" numa consulta a um segundo lugar que
ninguém lembra de versionar.

`synced_hash` ausente e `synced_hash` igual são resultados diferentes — P8
outra vez, agora no formato de arquivo.

```yaml anchors
- file: src/sync/link.ts
  symbol: "export function writeBoardLinks"
```

### REQ-SYNC-008 — Board credentials come only from the environment

**Statement.** The specd sync command SHALL read the board credential only from the environment variable named by `board.token_env`.

**Acceptance.**

- Token literal em `config.toml` já é rejeitado no load, e o `sync` herda isso
- Variável não definida sai 2 antes de qualquer requisição
- A mensagem nomeia a variável e não imprime valor algum
- O token não aparece em relatório, log ou erro

Mesma regra do `explore`, e pela mesma razão: a única forma de um segredo não
vazar num arquivo versionado é ele nunca ter estado lá.

```yaml anchors
- file: src/sync/adapters/redmine.ts
  symbol: "export function createRedmineAdapter"
```

### REQ-SYNC-009 — A field is named by id and by name, and divergence is a conflict

**Statement.** IF a configured field declares both an id and a name and the board reports a different name for that id, THEN the specd sync command SHALL exit with code 2 naming both values without writing.

**Acceptance.**

- Só `id` resolve; só `name` resolve
- `id` e `name` concordantes resolvem e o `id` é o usado
- `id` e `name` divergentes saem 2 mostrando o configurado e o reportado
- Campo configurado que não existe no board sai 2 nomeando o campo

`id` é estável e ilegível; `name` é legível e sobrevive à recriação do board.
Aceitar os dois é o que permite revisar a configuração sem consultar o banco.
Divergência entre eles são dois estados possíveis sem base para escolher, que é
P4 — e adivinhar aqui escreve num campo errado do cliente.

```yaml anchors
- file: src/sync/fields.ts
  symbol: "export function bindFields"
```

### REQ-SYNC-010 — Unreadable field definitions refuse, never assume

**Statement.** IF the board does not return the field definitions the configuration depends on, THEN the specd sync command SHALL exit with code 2 reporting that it could not verify them.

**Acceptance.**

- Definições inacessíveis saem 2 com mensagem que distingue "não consegui verificar" de "campo não existe"
- Nenhuma escrita ocorre no board quando a definição não pôde ser lida
- Configuração sem nenhum campo declarado não consulta definição e não é bloqueada por isto
- A mensagem cita o status devolvido pelo board

Medido, não presumido: `/custom_fields.json` do Redmine devolve **403 com corpo
vazio** para membro comum de projeto, enquanto `/trackers.json` e
`/issue_statuses.json` respondem 200 para o mesmo token. Um adaptador com token
de cliente real lê a issue e não lê o que os campos significam.

P8 inteiro: não conseguir verificar é o terceiro resultado, e ele nunca é
verde. O modo de falha alternativo — assumir `string` — grava valor errado em
campo obrigatório do cliente e ninguém investiga, porque a operação reportou
sucesso.

```yaml anchors
- file: src/sync/errors.ts
  symbol: "export class FieldDefinitionsUnavailableError"
```

### REQ-SYNC-011 — A board refusal is relayed verbatim, never interpreted

**Statement.** IF the board rejects a write, THEN the specd sync command SHALL report the server's message unchanged together with the local item identifier.

**Acceptance.**

- Mensagem do servidor aparece literal no relatório
- O item local é nomeado ao lado da mensagem
- Nenhuma comparação por substring decide o comportamento do `sync`
- Status HTTP é reportado junto, porque ele é estruturado e a mensagem não

O `422` do Redmine é `{"errors":["Cliente cannot be blank"]}` — prosa
localizada pelo idioma da instância, sem código e sem nome de campo
estruturado. Casar por substring é frágil por construção e erra em instância
pt-BR.

Então não se casa nada. O `sync` mostra; quem entende é a pessoa.

```yaml anchors
- file: src/sync/errors.ts
  symbol: "export class BoardRefusedError"
```

### REQ-SYNC-012 — Running twice changes nothing

**Statement.** WHEN neither the spec projection nor the board projection has changed since the recorded synced hash, the specd sync command SHALL perform no write to the board and no write to the spec.

**Acceptance.**

- Segunda execução seguida não cria item duplicado
- Segunda execução seguida não emite `update`, e o relatório diz `unchanged`
- `synced_at` não é reescrito quando nada mudou, porque reescrevê-lo suja o diff sem informar
- O relatório distingue `created`, `updated`, `restored` e `unchanged`

Mesma disciplina do `hooks install`. Comando que suja o diff a cada execução
ensina a ignorar o diff, e o diff é onde a revisão acontece.

Não reescrever `synced_at` é decisão consciente: ele registra quando o conteúdo
foi sincronizado, não quando alguém rodou o comando.

```yaml anchors
- file: src/sync/index.ts
  symbol: "export function planActions"
```

### REQ-SYNC-013 — Board timestamps filter the scan and decide nothing

**Statement.** The specd sync command SHALL use board-reported modification timestamps only to narrow which items to fetch.

**Acceptance.**

- Decisão de mudança vem do `synced_hash`, nunca do timestamp
- Reordenação de hierarquia move o timestamp do pai e não produz conflito
- Item cujo timestamp moveu sem mudar a projeção é reportado `unchanged`
- O filtro de varredura é opcional: sem ele o resultado é idêntico, só mais lento

Medido no run 004: o `updated_on` do pai move quando um filho é anexado ou
excluído, e **não** move quando o conteúdo do filho muda. É "esta linha mudou",
não "o conteúdo mudou".

Usá-lo como base de três vias produz conflito fantasma toda vez que alguém
mexe na hierarquia — e num board que colapsa pai-filho, mexer na hierarquia é
rotina, não exceção.

```yaml anchors
- file: src/sync/adapters/redmine.ts
  symbol: "export function scanFilter"
```
