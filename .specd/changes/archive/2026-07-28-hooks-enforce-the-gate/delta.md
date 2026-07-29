---
change: 2026-07-28-hooks-enforce-the-gate
target: [hooks, anchors]
---

# Delta — hooks-enforce-the-gate

Hooks: tornar o gate obrigatório sem torná-lo caro. Uma capability nova escrita do
zero, e a inversão do `anchor suggest`.

## ADDED

### REQ-HOOK-001 — Install merges into the existing settings file

**Capability.** hooks

**Statement.** The specd hooks install command SHALL preserve every existing entry of `.claude/settings.json` when adding its own.

**Acceptance.**
- Hook de terceiro no mesmo evento continua presente e inalterado
- Chaves fora de `hooks` são preservadas
- Arquivo inexistente é criado contendo só as entradas do specd
- O arquivo fica escrito e fora do índice do git

O `settings.json` é do usuário, não nosso. Reescrevê-lo inteiro seria a mesma
doença do `archive` que sobrescreve capability: a ferramenta assumindo que o que
ela sabe escrever é tudo o que existe ali.

```yaml anchors
- file: src/hooks/settings.ts
  symbol: "export function mergeHookEntries"
```

### REQ-HOOK-002 — Reinstall over a divergent entry refuses

**Capability.** hooks

**Statement.** IF `.claude/settings.json` already holds a specd hook entry whose command differs from the one being installed, THEN the specd hooks install command SHALL exit with code 2 without writing.

**Acceptance.**
- Entrada idêntica não escreve nada, reporta "already installed" e sai 0
- Rodar `specd hooks install` duas vezes seguidas não duplica entrada
- Entrada divergente aborta mostrando o comando existente e o pretendido
- `--force` substitui a entrada divergente

Idempotente-ou-aborta é dicotomia falsa. Entrada idêntica é no-op porque não há
nada a decidir; entrada divergente é dois estados possíveis sem base para
escolher, que é no-guessing-on-conflict canônico.

```yaml anchors
- file: src/hooks/install.ts
  symbol: "export function installHooks"
```

### REQ-HOOK-003 — Malformed settings are never overwritten

**Capability.** hooks

**Statement.** IF `.claude/settings.json` cannot be read as the expected JSON shape, THEN the specd hooks commands SHALL exit with code 2 leaving the file untouched.

**Acceptance.**
- JSON inválido sai 2 e o arquivo permanece byte-idêntico
- `hooks` presente com formato inesperado sai 2
- Mensagem nomeia o arquivo e o que foi encontrado no lugar do esperado
- `--force` não contorna este caminho

`--force` autoriza substituir configuração que conseguimos ler. Forçar escrita
sobre arquivo ilegível destrói configuração que não sabemos qual é, e a ferramenta
não tem como reportar o que apagou.

```yaml anchors
- file: src/hooks/settings.ts
  symbol: "export function readSettings"
```

### REQ-HOOK-004 — Uninstall removes only specd entries

**Capability.** hooks

**Statement.** The specd hooks uninstall command SHALL remove from `.claude/settings.json` only the entries whose command invokes `specd hooks run`.

**Acceptance.**
- Hook de terceiro no mesmo evento sobrevive
- Contêiner que ficou vazio por causa da remoção é removido
- Contêiner que já estava vazio antes da remoção é preservado
- Não havendo nada a remover, sai 0 dizendo isso

A distinção entre os dois últimos critérios é a regra inteira: só se remove
estrutura que a própria remoção esvaziou. Array vazio preexistente é configuração
do usuário, ainda que não configure nada.

```yaml anchors
- file: src/hooks/uninstall.ts
  symbol: "export function uninstallHooks"
```

### REQ-HOOK-005 — The adapter speaks the host protocol, not specd's

**Capability.** hooks

**Statement.** The specd hooks run command SHALL report its outcome using the host hook exit-code convention instead of the specd exit-code contract.

**Acceptance.**
- Gate limpo sai com o código de liberação do host
- Gate reprovado sai com o código de bloqueio do host, nunca 1
- A mensagem legível vai para stderr, que é o canal que o host devolve ao agente
- O payload JSON no stdout enriquece a mensagem e não é o mecanismo de bloqueio
- Nenhum módulo do adaptador importa o `EXIT` do specd
- Erro carregando `exitCode` do specd é traduzido pelo adaptador, nunca propagado

Os dois contratos colidem invertidos: o 1 do specd é o veredito que deveria
bloquear e o host o trata como aviso; o 2 do specd é ferramenta quebrada e o host
o trata como bloqueio. O adaptador existe para que a fronteira entre eles tenha
um lugar, e o teste de arquitetura existe para que ela não vaze.

Os dois últimos critérios são um só em duas metades. "Nenhum módulo alcançável"
seria falso por desenho — o adaptador chama `verify`, que chama
`requireProjectRoot`, que lança `OperationalError`, que carrega o 2 do specd. O
que precisa valer é que o adaptador **traduz** esse erro em vez de deixá-lo
escapar: o 2 dele e o 2 do host são o mesmo número por razões não relacionadas, e
deixar um passar pelo outro seria acertar por coincidência.

```yaml anchors
- file: src/hooks/protocol.ts
  symbol: "export const HOOK_EXIT"
```

### REQ-HOOK-006 — Inability to verify blocks

**Capability.** hooks

**Statement.** IF the specd hooks run command cannot complete the gate, THEN it SHALL block with a message naming the reason.

**Acceptance.**
- Diretório sem `.specd/` em nenhum ancestral bloqueia dizendo que não é projeto specd
- Configuração inválida bloqueia nomeando o erro de configuração
- Exceção inesperada bloqueia em vez de liberar
- Nenhum desses caminhos sai com o código de liberação

absence-is-not-compliance. O adaptador tem três resultados — verificou e passou, verificou e reprovou,
não conseguiu verificar — e só o primeiro libera. Um hook que libera quando quebra
é indistinguível de um hook desinstalado, e ninguém investiga silêncio.

```yaml anchors
- file: src/hooks/run.ts
  symbol: "export async function runHook"
```

### REQ-HOOK-007 — Both events run the fast gate by default

**Capability.** hooks

**Statement.** WHERE `--full-on-stop` is absent, the specd hooks install command SHALL write the fast gate as the command of both the PostToolUse and the Stop entry.

**Acceptance.**
- Sem a flag, os dois comandos escritos carregam `--fast`
- `--full-on-stop` escreve o comando do `Stop` sem `--fast`
- A escolha fica legível no `settings.json`, e não em `config.toml`
- O matcher do `PostToolUse` cobre só ferramentas que escrevem arquivo

`--fast` pula uma camada, e é a única que não verifica nada do specd: `project`
delega para o comando de build do projeto, que o CI já roda. Quem desliga o hook
por causa dela perde junto a detecção de drift, que custa milissegundos.

```yaml anchors
- file: src/hooks/install.ts
  symbol: "export function hookCommand"
```

### REQ-ANC-012 — Suggest lists the declarations of a named file

**Capability.** anchors

**Statement.** WHERE `--file` names a path, the specd anchor suggest command SHALL list the declarations that path contains instead of searching for terms lifted from requirement prose.

**Acceptance.**
- Cada declaração sai com o número da linha e com o texto pronto para colar em `symbol`
- A ordem é a do arquivo, e repetir o comando sobre árvore inalterada dá a mesma saída
- Extensão sem padrão de declaração conhecido reporta isso, e não devolve lista vazia
- Nenhum nome é composto: só é listado texto que aparece literalmente no arquivo
- O modo sem `--file` continua com o comportamento atual

O extrator de termos falha porque o requisito descreve comportamento em prosa e o
símbolo tem outro nome — `Suspended` contra `SuspendedState`. Inverter a pergunta
elimina o palpite: em vez de adivinhar o símbolo a partir do requisito, lista-se o
que o arquivo declara e o autor escolhe. Compor `SuspendedState` a partir de
palavras adjacentes seria inventar nome, e no-guessing-on-conflict proíbe.

```yaml anchors
- file: src/anchors/declarations.ts
  symbol: "export function listDeclarations"
```

## MODIFIED

## REMOVED
