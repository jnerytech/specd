---
id: "003-task-parser"
change: 2026-07-28-archive-cycle-and-effective-specs
req: [REQ-FMT-007]
status: done
evidence:
  commits: ["2b946a9d5ecac77814c81b037ded658d31404909"]
---

## Objetivo

Parser de task

## Escopo

Frontmatter validado: `id`, `change`, `req`, `status`, `evidence`.

## Restrições

- `req` é lista não vazia de identificadores válidos
- `evidence.commits` é lista, possivelmente vazia
- `id` numérico não é coagido: `001` viraria `1` e deixaria de casar com o arquivo
