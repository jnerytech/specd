---
capability: cli
retired: []
---

# CLI — superfície e contrato de execução

Comandos, códigos de saída e regras invioláveis de comportamento da CLI `specd`.

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

### REQ-CLI-002 — No LLM in the decision path

**Statement.** The specd CLI SHALL NOT invoke any language model when computing the result of `verify`.

**Acceptance.**
- Nenhum módulo alcançável a partir de `verify()` importa cliente de LLM
- Teste automatizado falha se `src/verify/**` importar de `src/llm/**`

```yaml anchors
- file: src/verify/index.ts
  symbol: "export async function verify"
- file: test/architecture/no-llm-in-verify.test.ts
  symbol: "no-llm-in-verify"
```

### REQ-CLI-003 — Never guess on conflict

**Statement.** IF specd encounters an ambiguous or conflicting state, THEN specd SHALL exit non-zero with a diagnostic listing the conflict instead of resolving it automatically.

**Acceptance.**
- Âncora com múltiplos candidatos não é reescrita automaticamente
- Conflito de sync interrompe a operação e lista os itens afetados

```yaml anchors
- file: src/core/conflict.ts
  symbol: "class ConflictError"
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

### REQ-CLI-005 — Offline gate

**Statement.** The specd CLI SHALL NOT perform network access during `verify`.

**Acceptance.**
- Teste de arquitetura falha se `src/verify/**` importar módulo de rede
- `verify` roda com sucesso sem conectividade

```yaml anchors
- file: src/verify/index.ts
  symbol: "export async function verify"
- file: test/architecture/no-network-in-verify.test.ts
  symbol: "no-network-in-verify"
```

### REQ-CLI-006 — Zero-install distribution

**Statement.** The specd package SHALL expose a `specd` binary executable via `npx` without prior installation.

**Acceptance.**
- `package.json` declara `bin.specd` e inclui `dist` em `files`
- O tarball empacotado instala e expõe um binário `specd` funcional
- Nenhuma dependência nativa ou passo de build no cliente
- Nenhuma gramática WASM entra no bundle

Que `npx specd` resolva para este pacote depende de reservar o nome sem escopo no registry. É fato de registry, não propriedade do código: verificável só publicando, e por isso está no pré-requisito operacional da change, não aqui.

```yaml anchors
- file: package.json
  symbol: "\"bin\""
```

### REQ-CLI-007 — The README names an invocation that works before publication

**Statement.** The README SHALL document how to build and run specd from a clone, for as long as the package is absent from the registry.

**Acceptance.**

- README mostra a sequência que leva de clone a comando funcionando
- O caminho do executável citado é o mesmo que `package.json` declara em `bin`
- Teste falha se `bin` mudar e o README não acompanhar
- `npx specd` continua documentado como o caminho de quem instala, com a ressalva de que ainda não está publicado

É a única parede absoluta do onboarding e está no primeiro passo: `npx specd`
devolve 404 e nenhum documento diz o que fazer em vez disso. Quem para no
primeiro comando não vira usuário, e o produto morre onde ninguém olha.

O acoplamento com `bin` é o pedaço que dá para verificar. O resto continua sendo
prosa, e está declarado como tal no proposal.

```yaml anchors
- file: test/distribution/readme.test.ts
  symbol: "README names the bin path"
```

### REQ-CLI-008 — Help and version print and never judge

**Statement.** The specd CLI SHALL treat `--help`, `-h`, `help`, `--version` and `-v` as a surface that prints and exits 0, performing no filesystem write, no network access and no gate evaluation.

**Acceptance.**

- `specd` sem argumento, `specd --help`, `specd -h` e `specd help` imprimem o mesmo texto em stdout e saem 0
- `specd --version` e `specd -v` imprimem a versão declarada em `package.json` e saem 0
- Nenhum desses caminhos lê `.specd/`, escreve arquivo ou abre conexão
- Nenhum deles retorna 1 em circunstância alguma
- Comando desconhecido continua saindo 2 com o texto de uso em stderr
- A linha `Usage: specd <command> [options]` continua presente no texto

Este requisito não muda comportamento. Ele reivindica código que já roda e que
requisito nenhum apontava — a direção de drift que o specd não detecta, e que
CLAUDE.md nomeia ao proibir `/feature-dev` aqui. O caso é instrutivo porque o
código não está errado: está certo e não-declarado, e portanto invisível para o
gate que valida este próprio repositório.

O critério de exit 0 é P2 escrito como obrigação e não como observação. Help é
onde alguém um dia acrescenta validação, e o único gate ganharia uma segunda
porta sem que a mudança parecesse uma mudança.

O critério de não tocar disco nem rede é P3 no mesmo espírito: `verify` não
acessa a rede porque é o gate, e help não acessa porque não precisa. Declarar
custa uma linha e impede que o caminho mais rodado do produto adquira
dependência que ninguém pediu.

```yaml anchors
- file: src/cli.ts
  symbol: "export async function main"
```

### REQ-CLI-009 — The usage text is rendered from the registered surface

**Statement.** The specd CLI SHALL render the command list of its usage text from the registered command table, and the global option list from the entry points handled before dispatch.

**Acceptance.**

- Toda chave de `registerCommands()` aparece no texto de uso acompanhada do seu `summary`
- `--help`, `-h`, `--version` e `-v` aparecem no texto de uso
- Comando acrescentado ao mapa aparece no help sem que texto algum seja editado
- Cabeçalho, rodapé e a ressalva sobre `hooks run` permanecem prosa escrita à mão
- Os blocos `Options for ...` deixam o texto global
- Teste falha se algum nome registrado, ou alguma opção global, estiver ausente do texto renderizado

`Command.summary` estava definido em nove comandos e era lido em nenhum. O texto
de uso era uma string literal de 44 linhas ao lado da tabela que dispara os
comandos. Duas descrições da mesma superfície, sem nada ligando uma à outra.

O drift já havia acontecido e ninguém tinha visto: `--version` e `-h` funcionam
e não estavam no texto. A causa é precisa e é o motivo de este requisito cobrir
opção global e não só comando — os dois são tratados em `main()` antes do
dispatch, então geração a partir do mapa sozinha continuaria sem pegá-los. Os
pontos de entrada que escapam da tabela foram exatamente os que derivaram.

**Híbrido e não geração total, deliberadamente.** O rodapé explica por que
`hooks run` responde no contrato de exit code do host e não no do specd. Isso é
julgamento, não enumeração, e metadata nenhuma o produziria. Gera-se o que é
lista; escreve-se o que é argumento.

**O limite está declarado.** Com a lista gerada, "todo comando registrado
aparece no help" passa a ser verdade por construção, e o teste que a afirma é em
parte tautológico. Ele não guarda o invariante — guarda a costura: alguém
revertendo para literal, ou acrescentando ponto de entrada em `main()` sem
registrá-lo. É rede menor que a de um teste sobre código não-gerado, e está dito
aqui para não ser confundida com rede maior, na disciplina de REQ-SYNC-014.

```yaml anchors
- file: src/cli/usage.ts
  symbol: "export function renderUsage"
```

### REQ-CLI-010 — Every scope answers --help

**Statement.** WHEN `--help` or `-h` appears among the arguments of a specd command or subcommand, the specd CLI SHALL print that scope's usage text on stdout and exit 0 without performing the command's work.

**Acceptance.**

- `specd verify --help`, `specd init --help`, `specd status --help`, `specd explore --help`, `specd sync --help` e `specd archive --help` saem 0 com o uso do próprio escopo
- `specd anchor suggest --help` e `specd anchor fix --help` imprimem textos distintos
- `specd hooks install --help`, `specd hooks uninstall --help` e `specd hooks run --help` imprimem textos distintos
- `-h` faz o mesmo que `--help` em todo escopo, como já faz no global
- `--help` precede a validação de opções: `specd verify --nope --help` sai 0 e imprime a ajuda
- Nenhum trabalho do comando ocorre quando `--help` está presente — nenhuma spec é lida, nenhum arquivo escrito, nenhuma conexão aberta
- Nenhum escopo retorna 1 por causa de `--help`
- A recusa por uso incorreto continua saindo 2

Hoje `specd verify --help` sai 2 com `Unknown option "--help"`. A convenção mais
universal que uma CLI tem está quebrada em todos os subcomandos, e no ponto em
que o usuário novo chega primeiro: ele tenta o que sempre funciona e recebe um
erro que sugere que ele digitou errado.

`--help` vencer opção inválida na mesma linha é escolha, e é a barata: nada foi
aprovado e nenhum trabalho aconteceu, então não há silêncio apresentado como
aprovação. Quem pede ajuda depois de errar a flag está pedindo ajuda por causa
do erro.

O critério de não executar trabalho não é zelo. `sync` e `explore` tocam a rede
e `archive` reescreve as capabilities; um `--help` avaliado tarde demais seria a
única forma de essa fatia custar alguma coisa, e P9 diz que operação que custa
não acontece de passagem.

```yaml anchors
- file: src/cli/usage.ts
  symbol: "export function renderScopeHelp"
```

### REQ-CLI-011 — A scope's usage text has one source

**Statement.** The specd CLI SHALL store exactly one usage text per scope, read both when help is requested and when that scope refuses a usage error.

**Acceptance.**

- O texto impresso por `--help` num escopo é literalmente o mesmo que a `UsageError` daquele escopo nomeia
- Cada escopo declara seu texto uma vez; nenhum escopo tem segunda cópia
- Os blocos `Options for ...` deixam de existir no texto global e passam a viver no escopo a que pertencem
- Teste falha se algum escopo com `--help` não tiver texto declarado, ou se o texto da recusa divergir do texto da ajuda

A forma vem de uma constatação e não de uma preferência: **o texto por escopo já
está escrito**, dentro dos `throw`. `"Usage: specd explore <card> --change
<name> — exactly one card identifier or URL."` é a ajuda de `explore`, com outro
nome, alcançável só errando. Nove strings na mesma condição.

Daí uma fonte e dois caminhos de saída — pedida sai 0 em stdout, violada sai 2
em stderr. Duas cópias divergem, e a divergência de duas cópias é o mecanismo de
REQ-CLI-009 aplicado a um objeto menor: lá eram a tabela e o literal, aqui são o
`throw` e a ajuda. Os blocos `Options for ...` do texto global eram a terceira
cópia, e é por isso que eles saem de lá em vez de serem mantidos em dia.

Este requisito é separável de REQ-CLI-010 e vale sozinho. REQ-CLI-010 diz que
existe ajuda; este diz que ela não pode ser um segundo texto. Uma implementação
que satisfizesse só o primeiro entregaria a convenção e recriaria o buraco no
escopo menor.

```yaml anchors
- file: src/cli/usage.ts
  symbol: "export const SCOPE_USAGE"
```
