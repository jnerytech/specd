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

O repositório é público em `github.com/jnerytech`, então o escopo natural seria `@jnerytech/specd`. Mas o nome `specd` está livre sem escopo, e `npx specd` é melhor que `npx @jnerytech/specd`.

**Publique sem escopo e registre o escopo como reserva.** Um `npm publish` de um pacote `0.0.0` vazio já garante o nome, e leva dois minutos:

```bash
npm publish --dry-run          # confirme o que vai subir
npm publish                    # reserva 'specd'
npm publish --access public    # depois, se quiser reservar @jnerytech/specd
```

Fazer isso antes de anunciar evita a situação em que o nome é tomado entre a publicação do repositório e a primeira release utilizável.

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

```markdown
### REQ-AUTH-003 — Refresh token rotation

**Statement.** WHEN a valid refresh token is presented to the renewal endpoint,
the authentication service SHALL issue a new access+refresh pair.

```yaml anchors
- file: src/Auth/TokenService.php
  symbol: "function rotate"
```
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
explore  →  propose  →  apply  →  archive
   ↑                       ↓
   └────  specd verify  ───┘
```

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
```

## Requisitos são EARS

Cinco padrões, validados por parser. Keywords em inglês são sintaxe; a prosa fica no idioma que você configurar.

| Padrão | Forma |
|---|---|
| Ubíquo | `The <sistema> SHALL <resposta>` |
| Evento | `WHEN <gatilho> the <sistema> SHALL <resposta>` |
| Estado | `WHILE <estado> the <sistema> SHALL <resposta>` |
| Indesejado | `IF <condição> THEN the <sistema> SHALL <resposta>` |
| Opcional | `WHERE <feature> the <sistema> SHALL <resposta>` |

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

| Fatia | Escopo | Status |
|---|---|---|
| 1 | `init` · `explore` · `verify` · `status` | Especificada |
| 2 | `propose` · `sync` | Especificada parcialmente |
| 3 | `apply` · memória | Especificada parcialmente |
| 4 | hooks · `archive` | Especificada parcialmente |

## Nota de desambiguação

Existe um projeto não relacionado chamado SpecD publicado em `@specd/cli` por outros autores. Não há afiliação entre os dois.

## Licença

MIT
