# specd

**Spec-driven development com detecção de drift.**

A maioria das ferramentas de SDD trata a spec como prompt: ela guia o agente na hora de escrever o código e depois apodrece. O `specd` faz a spec quebrar o build quando ela deixa de descrever o código.

```
REQ-AUTH-003: âncora pendurada
  esperado:   src/Auth/TokenService.php :: function rotate
  encontrado: src/Auth/RefreshService.php :: function rotate
  → specd anchor fix REQ-AUTH-003
```

> **Status:** Fatias 1 a 6 entregues. As specs em `.specd/specs/` são o contrato, e o `specd verify` que valida este repositório é o mesmo que você roda no seu.

## Rodar

`specd` ainda **não está publicado no npm**, então `npx specd` responde 404. Até
a primeira publicação, o caminho é o clone:

```bash
git clone https://github.com/jnerytech/specd.git
cd specd
npm install
npm run build
node dist/cli.js --help
```

Para usar contra outro repositório, chame o caminho absoluto de lá:

```bash
cd /caminho/do/seu/projeto
node /caminho/do/specd/dist/cli.js init
```

Ou registre o binário no PATH uma vez, e aí `specd` funciona como nos exemplos
deste README:

```bash
cd /caminho/do/specd && npm link
```

Depois de publicado, `npx specd <comando>` passa a ser o caminho de quem instala
e nada mais nesta página muda.

## Primeiros passos

### 1. Reservar o nome no npm

O repositório é público em `github.com/jnerytech`, então o escopo natural seria `@jnerytech/specd`. Mas o nome `specd` está livre sem escopo, e `npx specd` é melhor que `npx @jnerytech/specd`. **Decisão tomada: sem escopo.** `package.json` já declara `name = "specd"`.

Declarar o nome não é o mesmo que reservá-lo. Enquanto não houver publicação, `npx specd` resolve para qualquer pacote que ocupe esse nome no registry — possivelmente de outro autor. Um `npm publish` de um `0.0.0` já garante o nome, e leva dois minutos:

```bash
npm publish --dry-run          # confirme o que vai subir
npm publish                    # reserva 'specd'
```

Fazer isso antes de anunciar evita a situação em que o nome é tomado entre a publicação do repositório e a primeira release utilizável. Reservar `@jnerytech/specd` como escopo defensivo é opcional e independente.

Por que isso não é critério de aceite de REQ-CLI-006: que `npx specd` alcance este pacote é fato de registry, não propriedade do código. Verificável só publicando. O que os testes cobrem, offline, é o tarball instalar e expor um binário `specd` funcional.

### 2. Implementar a Fatia 1

O escopo está em `.specd/changes/2026-07-fatia-1/`. Comece pela tarefa `002-config-resolver` — o resolver de configuração é dependência de quase tudo e é onde se descobre mais rápido se a spec tem detalhe suficiente para o agente trabalhar sem inventar.

```
Leia AGENTS.md e .specd/. Implemente a tarefa 002-config-resolver
seguindo os requisitos REQ-CFG-001, 002 e 003 em .specd/specs/config.md.
Trate os critérios de aceite como especificação de teste.
```

Se o agente voltar pedindo uma decisão que a spec deveria ter tomado, o ajuste é na spec — não no prompt. Isso é o dogfooding funcionando.

## A ideia

Cada requisito declara **âncoras** — onde ele é realizado no código:

````markdown
### REQ-AUTH-003 — Refresh token rotation

**Statement.** WHEN a valid refresh token is presented to the renewal endpoint,
the authentication service SHALL issue a new access+refresh pair.

```yaml anchors
- file: src/Auth/TokenService.php
  symbol: "function rotate"
```
````

```

`specd verify` resolve cada âncora contra o working tree. Âncora que não resolve é drift, e drift retorna exit code 1.

Isso transforma a spec de documentação opcional em artefato load-bearing — a única condição sob a qual specs sobrevivem em equipe.

## Princípios

| | |
|---|---|
| **P1** | A CLI nunca chama LLM no caminho de decisão |
| **P2** | Um único gate: só `specd verify` reprova |
| **P3** | O gate nunca acessa a rede |
| **P4** | Nunca adivinhar em conflito — erro e diagnóstico, jamais auto-resolução |
| **P5** | Botão de configuração só existe se dois clientes reais divergirem |
| **P6** | Memória é efêmera; verdade durável vai para spec ou ADR |

P1 e P3 têm testes de arquitetura que quebram o CI se violados.

## Ciclo

```

explore → propose → apply → archive
↑ ↓
└──── specd verify ───┘

````

| Fase | O que faz |
|---|---|
| `explore` | Reúne contexto de fontes configuradas (board, ADRs, MCP) e grava um bundle auditável. Fonte marcada obrigatória que falha impede o início do trabalho |
| `propose` | Converte o draft em `delta.md` e tarefas; sincroniza com o board |
| `apply` | Modifica o código, uma tarefa por vez, com o verify fechando o loop |
| `archive` | Incorpora o delta às capabilities, aposenta IDs removidos |

## O gate

Seis camadas ordenadas, cada uma desligável:

| Camada | Checa |
|---|---|
| `provenance` | O contexto obrigatório foi realmente coletado |
| `schema` | IDs, gramática EARS, referências |
| `coverage` | Todo requisito tem tarefa |
| `anchors` | **Toda âncora resolve** |
| `evidence` | Tarefa concluída tem commit |
| `project` | Shell-out ao comando de validação do projeto |

As cinco primeiras rodam offline em milissegundos e não conhecem sua stack. A última delega:

```toml
[verify]
validation_command = ["make", "lint"]
````

## Sincronizar com o board

`specd sync` reconcilia a spec com o board. Manual, nunca por hook: o gate é
obrigatório porque lê, e o `sync` é manual porque escreve em sistema de
terceiro.

```toml
[board]
provider = "redmine"
url = "https://redmine.exemplo/"
project = "meu-projeto"
token_env = "SPECD_BOARD_TOKEN"

[board.mapping]
capability = "Epic"
requirement = "Story"
collapse = ["task"]

[[board.fields]]
name = "Cliente"
constant = "ACME"
```

| Lado  | Possui                          |
| ----- | ------------------------------- |
| spec  | título, conteúdo, hierarquia    |
| board | situação, responsável, iteração |

A decisão de "o que mudou" vem de um merge de três vias sobre o `synced_hash`
gravado no frontmatter da capability — nunca do carimbo de tempo do board, que
se move por evento estrutural. Os dois lados alterados de formas diferentes
saem 2, listam o conflito e não resolvem nada.

## Validar

```bash
npm run verify            # format, lint, testes, build — offline, sem Docker
npm run test:integration  # sobe um Redmine, roda a suíte de integração, derruba
```

Os dois são separados de propósito. O gate do specd não pode exigir Docker,
senão as camadas offline deixam de ser offline. Receita do container em
`test/integration/redmine/`.

## Requisitos são EARS

Cinco padrões, validados por parser. Keywords em inglês são sintaxe; a prosa fica no idioma que você configurar.

| Padrão     | Forma                                               |
| ---------- | --------------------------------------------------- |
| Ubíquo     | `The <sistema> SHALL <resposta>`                    |
| Evento     | `WHEN <gatilho> the <sistema> SHALL <resposta>`     |
| Estado     | `WHILE <estado> the <sistema> SHALL <resposta>`     |
| Indesejado | `IF <condição> THEN the <sistema> SHALL <resposta>` |
| Opcional   | `WHERE <feature> the <sistema> SHALL <resposta>`    |

Um comportamento por requisito. Dois `SHALL` no mesmo statement reprovam.

## Estrutura

```
.specd/
  config.toml
  specs/                      # a verdade: o que o sistema faz hoje
  changes/<id>/
    explore/                  # bundle de contexto + manifest
    delta.md                  # ADDED / MODIFIED / REMOVED
    tasks/
    memory/
  archive/
```

Tudo versionado no repositório. Nada em `~/`.

## Dogfooding

O `specd` é especificado no próprio formato. `.specd/specs/` tem 7 capabilities e 48 requisitos descrevendo a ferramenta, com âncoras apontando para os módulos que a implementarão.

O primeiro repositório que o `verify` valida é este, a cada commit e a cada `Stop` do agente.

## Roadmap

| Fatia | Escopo                                                        | Status           |
| ----- | ------------------------------------------------------------- | ---------------- |
| 1     | `init` · `explore` · `verify` · `status` · `anchor suggest`   | Entregue         |
| 2     | `archive` · `anchor fix` · camadas coverage e evidence        | Entregue         |
| 3     | camada provenance · transporte MCP                            | Entregue         |
| 4     | raiz do projeto · listagem com fallback · `detect-stack` .NET | Entregue         |
| 5     | hooks · `anchor suggest --file`                               | Entregue         |
| 6     | `sync` · adaptador Redmine                                    | Entregue         |
| 7     | `propose` · `apply` · memória                                 | Não especificada |

A Fatia 2 fechou o ciclo `change → verify → archive`: uma change do specd passa a poder ser encerrada pela própria ferramenta, que aplica o delta às capabilities e arquiva o diretório.

## Documento de proposta original

O documento que originou o produto **foi superado e não será reconciliado**. Ele usa identificadores com prefixo `REQ-` que não correspondem aos de `.specd/specs/` — `REQ-SPEC-*`, `REQ-BOARD-*`, `REQ-MEM-*`, `REQ-SEC-*` — e citá-lo já produziu quatro referências a requisitos que não existem aqui.

**O contrato é `.specd/specs/` mais o `delta.md` das changes abertas, e nada além disso.** Identificador que não aparece nesses dois lugares não obriga este repositório. O que aquele documento cobre e ainda não virou capability está enumerado em `docs/history/README.md` com prefixo `BL-`, deliberadamente fora do espaço `REQ-`.

## Nota de desambiguação

Existe um projeto não relacionado chamado SpecD publicado em `@specd/cli` por outros autores. Não há afiliação entre os dois.

## Licença

MIT
