# Formato dos arquivos

Referência dos três arquivos que se escreve à mão: capability, delta e task.

Os exemplos abaixo não são ilustrativos. Um teste os extrai deste arquivo e os
passa pelos mesmos parsers que o `specd verify` usa — se um parser mudar e
invalidar um exemplo publicado, o gate reprova. É a única coisa que impede esta
página de envelhecer em silêncio.

## Onde cada arquivo mora

```
.specd/
  config.toml
  specs/<capability>.md        # verdade realizada
  changes/<change>/
    delta.md                   # ADDED / MODIFIED / REMOVED
    tasks/NNN-nome.md          # uma tarefa por arquivo
    explore/                   # bundle do `specd explore`
    archive/                   # changes encerradas
```

**O delta é a superfície de escrita.** Requisito de comportamento que ainda não
existe em código mora no `delta.md` de uma change aberta, com texto completo, e
só entra em `specs/` quando `specd archive` o aplica. Escrever requisito novo
direto em `specs/` promete código que não existe.

## Capability

Frontmatter com `capability` e `retired`, depois um bloco `###` por requisito.

`retired` lista identificadores aposentados por changes passadas. Nunca são
reutilizados, e `archive` acrescenta a ela todo identificador sob REMOVED.

````markdown
---
capability: enrollment
retired: []
---

### REQ-ENR-001 — Enrollment creation

**Statement.** WHEN a valid enrollment request is received, the enrollment service SHALL persist the enrollment.

**Acceptance.**

- matrícula válida é persistida
- matrícula duplicada é rejeitada

Prosa livre depois dos critérios. É onde mora o porquê, e ela não é parseada.

```yaml anchors
- file: src/enrollment/service.ts
  symbol: "export function createEnrollment"
```
````

Um `SHALL` por requisito. Dois no mesmo statement reprovam — a regra existe
porque um requisito com dois comportamentos não tem como ser testado por um
critério.

`status` **não** aparece aqui. Estado pertence à tarefa que realiza o requisito,
nunca ao requisito.

Depois de um `specd sync`, o frontmatter ganha um bloco `board` com a ligação de
cada item. Ele é escrito pela ferramenta; não se edita à mão, exceto para
declarar uma renomeação.

## Delta

Frontmatter com `change`. Três seções, exatamente estas, e nada mais.

`ADDED` e `MODIFIED` carregam o **requisito completo**, na mesma forma que a
capability usa, mais um campo `**Capability.**` dizendo onde ele vai morar. O
bloco é movido inteiro quando o `archive` roda. `REMOVED` aceita só
identificadores.

Seção deliberadamente vazia se escreve com `Nenhum`. Seção com conteúdo que o
parser não consegue ler é erro, não vazio — ler nada como conformidade é como
`archive` já saiu 0 tendo verificado coisa nenhuma.

````markdown
---
change: add-cancellation
---

# Delta — cancelamento de matrícula

## ADDED

### REQ-ENR-002 — Enrollment cancellation

**Capability.** enrollment

**Statement.** WHEN a cancellation request is received for an active enrollment, the enrollment service SHALL mark the enrollment cancelled.

**Acceptance.**

- matrícula ativa vira cancelada
- matrícula já cancelada não muda de estado

```yaml anchors
- file: src/enrollment/service.ts
  symbol: "export function cancelEnrollment"
```

## MODIFIED

Nenhum.

## REMOVED

Nenhum.
````

## Task

Frontmatter com cinco campos, todos obrigatórios.

| Campo              | O que é                                                 |
| ------------------ | ------------------------------------------------------- |
| `id`               | igual ao nome do arquivo sem `.md`, **entre aspas**     |
| `change`           | nome do diretório da change                             |
| `req`              | lista não vazia de identificadores que a tarefa realiza |
| `status`           | `pending`, `in_progress`, `done` ou `blocked`           |
| `evidence.commits` | lista de SHAs, possivelmente vazia                      |

`id: 001` sem aspas é lido pelo YAML como o número 1, e os zeros somem. Por isso
o parser recusa em vez de converter.

`evidence.commits` vazia é declaração legítima de "sem evidência ainda"; ausente
é task malformada. Tarefa em `done` sem SHA reprova o gate.

```markdown
---
id: "001-cancel"
change: add-cancellation
req: [REQ-ENR-002]
status: pending
evidence:
  commits: []
---

## Objetivo

Implementar o cancelamento de matrícula.

## Escopo

`cancelEnrollment` em `src/enrollment/service.ts`, mais o endpoint que o expõe.

## Restrições

- Cancelar matrícula já cancelada é no-op, não erro
- Todo critério de aceite do requisito vira teste
```

Todo requisito declarado sob ADDED ou MODIFIED precisa de pelo menos uma task
citando o identificador em `req`, senão a camada `coverage` reprova. É por isso
que renomear um requisito num delta custa editar os dois arquivos.

## O ciclo

```
escrever delta + tasks  ->  implementar  ->  specd verify  ->  specd archive
```

`specd verify` roda em qualquer ponto e diz o que falta. `specd archive <change>`
aplica o delta às capabilities, aposenta os identificadores removidos e move o
diretório para `changes/archive/`. Nada é estagiado nem commitado — o que a
ferramenta escreveu é para ser lido antes de virar história.
