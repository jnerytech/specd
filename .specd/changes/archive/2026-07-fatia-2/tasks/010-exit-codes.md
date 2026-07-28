---
id: "010-exit-codes"
change: 2026-07-fatia-2
req: [REQ-CLI-001, REQ-CLI-004]
status: done
evidence:
  commits: ["2b946a9d5ecac77814c81b037ded658d31404909"]
---

## Objetivo

Exit 1 é veredito, exit 2 é recusa de agir

## Escopo

`archive` e `anchor fix` recusam com 2 e nomeiam `specd verify` como o lugar do veredito.

## Restrições

- Nenhum comando além do `verify` retorna 1
- Recusa por precondição de qualidade retorna 2
