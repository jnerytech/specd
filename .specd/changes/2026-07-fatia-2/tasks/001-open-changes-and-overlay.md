---
id: "001-open-changes-and-overlay"
change: 2026-07-fatia-2
req: [REQ-ANC-006]
status: done
evidence:
  commits: ["2b946a9d5ecac77814c81b037ded658d31404909"]
---

## Objetivo

Changes abertas no plural e a spec efetiva

## Escopo

`readOpenChanges` devolve toda change não arquivada, excluindo `archive/` explicitamente. `effectiveSpecs()` aplica os deltas sobre `.specd/specs/` e marca a origem de cada requisito.

## Restrições

- Nenhum consumidor escolhe uma única change ativa; escolher era adivinhar, e P4 proíbe
- Âncora pendurada em `specs/` é erro; em delta de change aberta é warning
- Requisito sob MODIFIED sombreia a cópia realizada, em vez de coexistir com ela
