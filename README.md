# specd

**Spec-driven development com detecção de drift.**

A maioria das ferramentas de SDD trata a spec como prompt: ela guia o agente na hora de escrever o código e depois apodrece. O `specd` faz a spec quebrar o build quando ela deixa de descrever o código.

```
REQ-AUTH-003: âncora pendurada
  esperado:   src/Auth/TokenService.php :: function rotate
  encontrado: src/Auth/RefreshService.php :: function rotate
  → specd anchor fix REQ-AUTH-003
```

> **Status:** especificação completa, implementação não iniciada. As specs em `.specd/specs/` são o contrato; o código vem depois.

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

Quando o `verify` existir, o primeiro repositório que ele valida é este.

## Roadmap

| Fatia | Escopo                                                      | Status                    |
| ----- | ----------------------------------------------------------- | ------------------------- |
| 1     | `init` · `explore` · `verify` · `status` · `anchor suggest` | Entregue                  |
| 2     | `archive` · `anchor fix` · camadas coverage e evidence      | Entregue                  |
| 3     | camada provenance · transporte MCP                          | Entregue                  |
| 4     | `propose` · `apply` · `sync` · memória · hooks              | Especificada parcialmente |

A Fatia 2 fechou o ciclo `change → verify → archive`: uma change do specd passa a poder ser encerrada pela própria ferramenta, que aplica o delta às capabilities e arquiva o diretório.

## Documento de proposta original

O documento que originou o produto **foi superado e não será reconciliado**. Ele usa identificadores com prefixo `REQ-` que não correspondem aos de `.specd/specs/` — `REQ-SPEC-*`, `REQ-BOARD-*`, `REQ-MEM-*`, `REQ-SEC-*` — e citá-lo já produziu quatro referências a requisitos que não existem aqui.

**O contrato é `.specd/specs/` mais o `delta.md` das changes abertas, e nada além disso.** Identificador que não aparece nesses dois lugares não obriga este repositório. O que aquele documento cobre e ainda não virou capability está enumerado em `docs/history/README.md` com prefixo `BL-`, deliberadamente fora do espaço `REQ-`.

## Nota de desambiguação

Existe um projeto não relacionado chamado SpecD publicado em `@specd/cli` por outros autores. Não há afiliação entre os dois.

## Licença

MIT
